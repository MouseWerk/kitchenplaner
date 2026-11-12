// DXF export (AutoCAD 2000, AC1015, ASCII, millimetres): the plan and the elevations for a
// planner who goes on in CAD. Each unit is a block reference with its data as attributes, so it
// can be picked, moved and listed there; the layers follow the trades, so the walls, the
// equipment or the electrical data can be shown and hidden on their own. y is flipped (DXF y
// points up). The file format itself is `dxfWriter.ts`; this module maps a Drawing onto it.
//
// Connection points (the installation plan) are block references too: one block per symbol
// (`KP_<id>`), inserted upright at each point with the point's data as attributes. Everything of a
// trade (symbols, labels, leaders, dimensions, legend rows) lies on that trade's layer, so hiding
// ANSCHLUSS_ELEKTRO hides everything electric.
//
// Dimensions stay plain lines and text on BEMASSUNG, cut walls stay SOLID triangles: both look
// in every reader exactly as in the app.

import { drawingBounds, expandDim, LAYER_OF, TEXT, type Drawing, type Pen, type Shape, type TextShape } from "./drawing";
import { dxfNumber, writeDxf, type DxfAttDef, type DxfAttrib, type DxfBlock, type DxfEntity, type DxfLayer, type DxfLinetype, type Pt } from "./dxfWriter";
import { PEN_STYLE } from "./style";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS } from "./svg";
import { symbolOf, symbolParts, symbolTrade, type SymbolId } from "./symbols";
import { itemHeat } from "../model/heat";
import { itemPoints, pointLabel, type ConnectionPoint } from "../model/points";
import { plugName, tradeName } from "../model/trades";
import type { Item, Trade, Vec2 } from "../model/types";

export { dxfText } from "./dxfWriter";

/** Position numbers, names and their leaders. */
export const LABEL_LAYER = "BESCHRIFTUNG";

/** One layer per trade for the connection values of the units (their attributes). */
export const CONNECTION_LAYER = {
  electric: "ANSCHLUSS_ELEKTRO",
  gas: "ANSCHLUSS_GAS",
  water: "ANSCHLUSS_WASSER",
  drain: "ANSCHLUSS_ABWASSER",
  exhaust: "ANSCHLUSS_LUEFTUNG",
  steam: "ANSCHLUSS_DAMPF",
  refrigeration: "ANSCHLUSS_KAELTE",
} as const;

/** The layer of each trade's points, labels and dimensions: the waters share one, as do drains and air. */
export const TRADE_LAYER: Readonly<Record<Trade, string>> = {
  electric: CONNECTION_LAYER.electric,
  gas: CONNECTION_LAYER.gas,
  coldWater: CONNECTION_LAYER.water,
  hotWater: CONNECTION_LAYER.water,
  softWater: CONNECTION_LAYER.water,
  drain: CONNECTION_LAYER.drain,
  floorDrain: CONNECTION_LAYER.drain,
  exhaust: CONNECTION_LAYER.exhaust,
  supply: CONNECTION_LAYER.exhaust,
  steam: CONNECTION_LAYER.steam,
  refrigeration: CONNECTION_LAYER.refrigeration,
};

/**
 * Every layer of the export: AutoCAD colour index (7 black/white, 8 grey, 4 cyan, 6 magenta,
 * 3 green, 1 red, 30 orange, 5 blue, 34 brown, 140 blue-cyan; 200 violet and 150 light blue keep
 * steam and refrigeration apart from the other trades), line type and lineweight in
 * 1/100 mm. Entities carry their pen's own lineweight; the layer's is the one new lines get.
 */
const LAYERS: DxfLayer[] = [
  { name: "WAENDE", color: 7, ltype: "CONTINUOUS", lineweight: 50 },
  { name: "OEFFNUNGEN", color: 4, ltype: "CONTINUOUS", lineweight: 25 },
  { name: "AUSSTATTUNG", color: 7, ltype: "CONTINUOUS", lineweight: 35 },
  { name: "AUSSTATTUNG_OBEN", color: 6, ltype: "DASHED", lineweight: 18 },
  { name: "DETAILS", color: 8, ltype: "CONTINUOUS", lineweight: 18 },
  { name: LABEL_LAYER, color: 7, ltype: "CONTINUOUS", lineweight: 18 },
  { name: "BEMASSUNG", color: 3, ltype: "CONTINUOUS", lineweight: 13 },
  { name: "RAHMEN", color: 7, ltype: "CONTINUOUS", lineweight: 50 },
  { name: CONNECTION_LAYER.electric, color: 1, ltype: "CONTINUOUS", lineweight: 18 },
  { name: CONNECTION_LAYER.gas, color: 30, ltype: "CONTINUOUS", lineweight: 18 },
  { name: CONNECTION_LAYER.water, color: 5, ltype: "CONTINUOUS", lineweight: 18 },
  { name: CONNECTION_LAYER.drain, color: 34, ltype: "CONTINUOUS", lineweight: 18 },
  { name: CONNECTION_LAYER.exhaust, color: 140, ltype: "CONTINUOUS", lineweight: 18 },
  { name: CONNECTION_LAYER.steam, color: 200, ltype: "CONTINUOUS", lineweight: 18 },
  { name: CONNECTION_LAYER.refrigeration, color: 150, ltype: "CONTINUOUS", lineweight: 18 },
];

/** Line type per pen: the dashed pens get their own DXF line type, the rest CONTINUOUS. */
const LTYPE_OF: Partial<Record<Pen, string>> = { overhead: "DASHED", hidden: "HIDDEN" };

/** DXF TEXT horizontal justification (group 72): 0 left, 1 centre, 2 right; 4 middle (both axes). */
const JUSTIFY = { start: 0, middle: 1, end: 2 } as const;

/** Cap height of the SVG and screen fonts per em: DXF text height is the cap height. */
const CAP_HEIGHT_PER_EM = 0.7;

/** Normalizes an angle in degrees to [0, 360). */
function deg360(a: number): number {
  const r = ((a % 360) + 360) % 360;
  return Math.abs(r - 360) < 1e-9 ? 0 : r;
}

/**
 * Converts an arc of a Drawing (clockwise on screen from a0 to a1, y down) to a DXF ARC
 * (counter-clockwise from start to end, y up). Flipping y mirrors every angle (a → -a) and turns
 * clockwise into counter-clockwise, so the arc now runs from -a1 to -a0.
 */
export function dxfArcAngles(a0: number, a1: number): { start: number; end: number } {
  return { start: deg360(-a1), end: deg360(-a0) };
}

/** The layer names in a stable order, without duplicates (layer 0 not included). */
export function dxfLayers(): string[] {
  return LAYERS.map((l) => l.name);
}

export interface DxfOptions {
  /**
   * The items the drawing shows. Each one's shapes (those with its `itemId`, except texts and
   * labels) become one block reference carrying its data as attributes, and each of its
   * connection points (the shapes of the point's symbol) one reference of the symbol's block
   * carrying the point's data. Without items every shape is written as plain geometry.
   */
  items?: readonly Item[];
  /**
   * Where a block's base point lies. "plan": at the item's centre, the reference turned with
   * the item, so a unit turns about its middle in CAD as in the app. Otherwise (elevations): at
   * the lower left corner of what the drawing shows of it, unturned.
   */
  view?: "plan" | "elevation";
}

/**
 * The drawing as an ASCII DXF file (AutoCAD 2000, AC1015) in millimetres. Text heights and dash
 * lengths are paper sizes times `paperScale`, so the file plots at that scale like the SVG.
 */
export function drawingToDxf(drawing: Drawing, paperScale: number, opts: DxfOptions = {}): string {
  const ps = paperScale;
  const box = drawingBounds(drawing, ps);
  const items = new Map((opts.items ?? []).map((it) => [it.id, it]));

  // The shapes of each known item that go into its block, in drawing order.
  const parts = new Map<string, Shape[]>();
  for (const s of drawing.shapes) {
    if (!s.itemId || !items.has(s.itemId) || isLabel(s)) continue;
    const list = parts.get(s.itemId);
    if (list) list.push(s);
    else parts.set(s.itemId, [s]);
  }

  // The connection point a symbol shape draws, resolved from its item once per point.
  const points = new Map<string, ConnectionPoint | null>();
  const pointOf = (s: Shape): ConnectionPoint | null => {
    if (!s.point || isLabel(s) || s.t === "dim") return null;
    const key = pointKey(s.point);
    let p = points.get(key);
    if (p === undefined) {
      const it = items.get(s.point.itemId);
      const trade = s.point.trade;
      p = (it && itemPoints(it).find((q) => q.trade === trade)) ?? null;
      points.set(key, p);
    }
    return p;
  };

  const blocks = new BlockSet();
  const entities: DxfEntity[] = [];
  const inserted = new Set<string>();
  for (const s of drawing.shapes) {
    const point = pointOf(s);
    if (point) {
      // A symbol's shapes become one reference of its block, where the first of them was.
      const key = pointKey(point);
      if (!inserted.has(key)) {
        inserted.add(key);
        entities.push(pointInsert(point, ps, blocks));
      }
      continue;
    }
    const own = s.itemId !== undefined ? parts.get(s.itemId) : undefined;
    if (own && !isLabel(s)) {
      // The reference goes where the item's first shape was, keeping the drawing order.
      if (!inserted.has(s.itemId!)) {
        inserted.add(s.itemId!);
        entities.push(itemInsert(items.get(s.itemId!)!, own, opts.view, ps, blocks));
      }
      continue;
    }
    entities.push(...shapeEntities(s, MODEL, ps));
  }

  return writeDxf({
    // Flipping y swaps which corner is the minimum.
    extents: { minX: box.minX, minY: -box.maxY, maxX: box.maxX, maxY: -box.minY },
    linetypes: linetypes(ps),
    layers: LAYERS,
    blocks: blocks.list,
    entities,
  });
}

/** Texts and leaders annotate an item; they stay loose on the label layer. */
function isLabel(s: Shape): boolean {
  return s.t === "text" || s.label === true;
}

function linetypes(ps: number): DxfLinetype[] {
  return (Object.entries(LTYPE_OF) as [Pen, string][]).map(([pen, name]) => ({
    name,
    description: "__ __ __",
    // Alternating dash (positive) and gap (negative) lengths in drawing units.
    pattern: (PEN_STYLE[pen].dash ?? []).map((d, i) => (i % 2 === 0 ? d : -d) * ps),
  }));
}

// ---- Frames ----

/**
 * Maps drawing coordinates (y down) into the coordinates an entity is written in: the model
 * space, or a block's own frame. `turn` is the frame's rotation in screen degrees (clockwise),
 * subtracted from every screen angle.
 */
interface Frame {
  map(p: Vec2): Pt;
  turn: number;
}

const MODEL: Frame = { map: (p) => ({ x: p.x, y: -p.y }), turn: 0 };

/** The frame of a unit in the plan: its centre at the origin, turned back by its rotation. */
function itemFrame(it: Item): Frame {
  const a = (-it.rotation * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    map: (p) => {
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      return { x: dx * c - dy * s, y: -(dx * s + dy * c) };
    },
    turn: it.rotation,
  };
}

/** A frame with its origin at `o` (drawing coordinates), unturned. */
function offsetFrame(o: Vec2): Frame {
  return { map: (p) => ({ x: p.x - o.x, y: o.y - p.y }), turn: 0 };
}

/** Rotates a DXF point counter-clockwise by `deg` degrees and moves it by `by`. */
function place(p: Pt, deg: number, by: Pt): Pt {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: by.x + p.x * c - p.y * s, y: by.y + p.x * s + p.y * c };
}

// ---- Shapes ----

function layerOf(s: Shape): string {
  if (s.trade) return TRADE_LAYER[s.trade];
  return s.itemId !== undefined && isLabel(s) ? LABEL_LAYER : LAYER_OF[s.pen];
}

/** Line type and lineweight of a pen, as the SVG draws it. */
function penStyle(pen: Pen): { ltype?: string; lineweight: number } {
  return { ltype: LTYPE_OF[pen], lineweight: Math.round(PEN_STYLE[pen].width * 100) };
}

/** The entities of one shape, in `frame`, on `layer` (its pen's layer unless given). */
function shapeEntities(s: Shape, frame: Frame, ps: number, layer = layerOf(s)): DxfEntity[] {
  const style = { layer, ...penStyle(s.pen) };
  const m = frame.map;
  switch (s.t) {
    case "poly": {
      if (s.pts.length < 2) return [];
      const out: DxfEntity[] = [];
      // Cut walls and columns are filled, as SOLID triangles (every reader fills them alike).
      if (s.closed && s.fill === "wall") {
        for (const [a, b, c] of triangulate(s.pts)) out.push({ type: "SOLID", ...style, ltype: undefined, pts: [m(a), m(b), m(c)] });
      }
      if (s.pts.length === 2 && !s.closed) out.push({ type: "LINE", ...style, a: m(s.pts[0]), b: m(s.pts[1]) });
      else out.push({ type: "LWPOLYLINE", ...style, pts: s.pts.map(m), closed: s.closed });
      return out;
    }
    case "circle":
      return [{ type: "CIRCLE", ...style, c: m(s.c), r: s.r }];
    case "arc": {
      const { start, end } = dxfArcAngles(s.a0 - frame.turn, s.a1 - frame.turn);
      return [{ type: "ARC", ...style, c: m(s.c), r: s.r, start, end }];
    }
    case "text":
      return textEntities(s, frame, ps, layer);
    case "dim": {
      const e = expandDim(s, ps);
      return [...e.lines.map(([a, b]): DxfEntity => ({ type: "LINE", layer, ...penStyle("dim"), a: m(a), b: m(b) })), ...textEntities(e.text, frame, ps, layer)];
    }
  }
}

function textEntities(s: TextShape, frame: Frame, ps: number, layer: string): DxfEntity[] {
  const em = s.size * ps;
  const height = em * CAP_HEIGHT_PER_EM;
  const lineweight = penStyle(s.pen).lineweight;
  if (s.circled) {
    const c = frame.map({ x: s.p.x, y: s.p.y - em * CIRCLE_CENTER_RISE });
    return [
      { type: "CIRCLE", layer, lineweight: penStyle("detail").lineweight, c, r: em * CIRCLE_RADIUS },
      { type: "TEXT", layer, lineweight, p: c, height, text: s.text, halign: 4 },
    ];
  }
  // Screen angles turn clockwise, DXF angles counter-clockwise.
  const rotation = deg360(frame.turn - (s.angle ?? 0));
  return [{ type: "TEXT", layer, lineweight, p: frame.map(s.p), height, text: s.text, rotation, halign: JUSTIFY[s.anchor] }];
}

// ---- Units as blocks ----

/**
 * The blocks of a file, one per catalog variant and drawn size: units that look alike share
 * one, so in CAD a change to the block changes them all. Two units of one variant whose
 * drawings differ (another size, seen from the side) get blocks of their own.
 */
class BlockSet {
  readonly list: DxfBlock[] = [];
  private readonly bySignature = new Map<string, string>();
  private readonly names = new Set<string>();

  /** The name of the block with these entities and attributes, defining it on first use. */
  /** The block of a fixed name (a symbol's), defined on first use from what `make` returns. */
  named(name: string, make: () => Omit<DxfBlock, "name">): string {
    if (this.names.has(name)) return name;
    this.names.add(name);
    this.list.push({ name, ...make() });
    return name;
  }

  use(base: string, entities: DxfEntity[], attdefs: DxfAttDef[]): string {
    const sig = signature(entities);
    const known = this.bySignature.get(`${base}\n${sig}`);
    if (known) return known;
    let name = base;
    for (let i = 2; this.names.has(name); i++) name = `${base}_${i}`;
    this.names.add(name);
    this.bySignature.set(`${base}\n${sig}`, name);
    this.list.push({ name, entities, attdefs });
    return name;
  }
}

/** The geometry of a block as text, rounded so that float noise from turning back does not count. */
function signature(entities: DxfEntity[]): string {
  return JSON.stringify(entities, (_, v: unknown) => (typeof v === "number" ? Math.round(v * 100) / 100 : v));
}

/** Characters a block name may hold in every CAD program; the rest become "_". */
function blockName(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, "_");
}

/** The layer of a unit's reference: building parts with the walls, hanging units on their own. */
function insertLayer(shapes: readonly Shape[]): string {
  const pen = shapes[0].pen;
  return pen === "wall" ? "WAENDE" : pen === "overhead" ? "AUSSTATTUNG_OBEN" : "AUSSTATTUNG";
}

/** One attribute of a unit: its tag, prompt (German, as the layers), layer and value. */
interface AttrSpec {
  tag: string;
  prompt: string;
  layer: string;
  value: (it: Item) => string;
}

const num = (v: number | undefined) => (v === undefined ? "" : dxfNumber(v));
const yes = (v: boolean | undefined) => (v ? "ja" : "nein");
const whole = (v: number) => String(Math.round(v));

/**
 * The attributes every unit carries, in this order: what it is, its size, then its connection
 * values each on the layer of its trade. All invisible: they are the unit's data (for attribute
 * extraction and lists), the plan shows the position number and name as labels already.
 */
export const DXF_ATTRIBUTES: readonly AttrSpec[] = [
  { tag: "POS", prompt: "Pos.", layer: LABEL_LAYER, value: (it) => String(it.pos) },
  { tag: "BEZEICHNUNG", prompt: "Bezeichnung", layer: LABEL_LAYER, value: (it) => it.name },
  { tag: "KATALOG", prompt: "Katalog-Nr.", layer: LABEL_LAYER, value: (it) => it.catalogId },
  { tag: "ENERGIE", prompt: "Energie", layer: LABEL_LAYER, value: (it) => (it.energy === "gas" ? "Gas" : it.energy === "electric" ? "Elektro" : "") },
  { tag: "BREITE", prompt: "Breite (mm)", layer: LABEL_LAYER, value: (it) => whole(it.width) },
  { tag: "TIEFE", prompt: "Tiefe (mm)", layer: LABEL_LAYER, value: (it) => whole(it.depth) },
  { tag: "HOEHE", prompt: "Höhe (mm)", layer: LABEL_LAYER, value: (it) => whole(it.height) },
  { tag: "HERSTELLER", prompt: "Hersteller", layer: LABEL_LAYER, value: (it) => it.spec?.manufacturer ?? "" },
  { tag: "TYP", prompt: "Typ", layer: LABEL_LAYER, value: (it) => it.spec?.model ?? "" },
  { tag: "ARTIKELNR", prompt: "Artikel-Nr.", layer: LABEL_LAYER, value: (it) => it.spec?.article ?? "" },
  { tag: "ELEKTRO_KW", prompt: "Elektro (kW)", layer: CONNECTION_LAYER.electric, value: (it) => num(it.connections.electricKw) },
  { tag: "SPANNUNG_V", prompt: "Spannung (V)", layer: CONNECTION_LAYER.electric, value: (it) => num(it.connections.voltage) },
  { tag: "GAS_KW", prompt: "Gas (kW)", layer: CONNECTION_LAYER.gas, value: (it) => num(it.connections.gasKw) },
  { tag: "KALTWASSER", prompt: "Kaltwasser", layer: CONNECTION_LAYER.water, value: (it) => yes(it.connections.coldWater) },
  { tag: "WARMWASSER", prompt: "Warmwasser", layer: CONNECTION_LAYER.water, value: (it) => yes(it.connections.hotWater) },
  { tag: "ABLAUF", prompt: "Ablauf", layer: CONNECTION_LAYER.drain, value: (it) => yes(it.connections.drain) },
  { tag: "BODENABLAUF", prompt: "Bodenablauf", layer: CONNECTION_LAYER.drain, value: (it) => yes(it.connections.floorDrain) },
  { tag: "ABLUFT_M3H", prompt: "Abluft (m³/h)", layer: CONNECTION_LAYER.exhaust, value: (it) => num(it.connections.exhaustM3h) },
  // Added in 0.3, after all the others: extraction templates read the attributes in this order.
  { tag: "ENTHAERTET", prompt: "Enthärtetes Wasser", layer: CONNECTION_LAYER.water, value: (it) => yes(it.connections.softWater) },
  { tag: "ZULUFT_M3H", prompt: "Zuluft (m³/h)", layer: CONNECTION_LAYER.exhaust, value: (it) => num(it.connections.supplyM3h) },
  { tag: "DAMPF_KGH", prompt: "Dampf (kg/h)", layer: CONNECTION_LAYER.steam, value: (it) => num(it.connections.steamKgH) },
  { tag: "KAELTE_KW", prompt: "Kälte Verbund (kW)", layer: CONNECTION_LAYER.refrigeration, value: (it) => num(it.connections.refrigerationKw) },
  // The heat release sizes the air, so it lies with the ventilation: the planner's value or the estimate.
  { tag: "WAERME_S_KW", prompt: "Wärme sensibel (kW)", layer: CONNECTION_LAYER.exhaust, value: (it) => num(itemHeat(it).sensibleKw) },
  { tag: "WAERME_L_KW", prompt: "Wärme latent (kW)", layer: CONNECTION_LAYER.exhaust, value: (it) => num(itemHeat(it).latentKw) },
];

/** Attribute definitions stacked below the block's base point, small text. */
function attdefs(ps: number, specs: readonly { tag: string; prompt: string; layer: string }[] = DXF_ATTRIBUTES): DxfAttDef[] {
  const height = TEXT.small * ps * CAP_HEIGHT_PER_EM;
  return specs.map((a, i) => ({ tag: a.tag, prompt: a.prompt, layer: a.layer, p: { x: 0, y: -(i + 1) * height * 1.6 }, height, invisible: true }));
}

function itemInsert(it: Item, shapes: readonly Shape[], view: DxfOptions["view"], ps: number, blocks: BlockSet): DxfEntity {
  let frame: Frame;
  let at: Pt;
  let rotation: number;
  let size: string;
  if (view === "plan") {
    frame = itemFrame(it);
    at = MODEL.map(it);
    // Clockwise on screen is counter-clockwise in DXF.
    rotation = deg360(-it.rotation);
    size = `${whole(it.width)}x${whole(it.depth)}`;
  } else {
    const b = drawingBounds({ shapes: [...shapes] }, ps);
    const origin = { x: b.minX, y: b.maxY };
    frame = offsetFrame(origin);
    at = MODEL.map(origin);
    rotation = 0;
    size = `${whole(b.maxX - b.minX)}x${whole(b.maxY - b.minY)}`;
  }
  // Inside the block a unit's own lines go on layer 0, so they take the reference's layer and
  // colour; details keep their own layer, so they can be hidden in every unit at once.
  const entities = shapes.flatMap((s) => shapeEntities(s, frame, ps, s.pen === "detail" || s.pen === "hidden" ? LAYER_OF[s.pen] : "0"));
  const defs = attdefs(ps);
  const variant = it.energy ? `${it.catalogId}_${it.energy}` : it.catalogId;
  const base = blockName(view === "plan" ? `${variant}_${size}` : `${variant}_ANSICHT_${size}`);
  const name = blocks.use(base, entities, defs);
  const attribs: DxfAttrib[] = DXF_ATTRIBUTES.map((a, i) => ({
    tag: a.tag,
    value: a.value(it),
    layer: a.layer,
    p: place(defs[i].p, rotation, at),
    height: defs[i].height,
    rotation,
  }));
  return { type: "INSERT", layer: insertLayer(shapes), block: name, p: at, rotation, attribs };
}

// ---- Connection points as blocks ----

const pointKey = (p: { itemId: string; trade: Trade }) => `${p.itemId}\n${p.trade}`;

/** One attribute of a connection point: tag, prompt and value. It lies on the point's trade layer. */
interface PointAttrSpec {
  tag: string;
  prompt: string;
  value: (p: ConnectionPoint) => string;
}

// German and fixed, like the layers and the unit attributes, whatever the UI language.
const NR: PointAttrSpec = { tag: "NR", prompt: "Nr.", value: (p) => pointLabel(p, "de") };
const POS: PointAttrSpec = { tag: "POS", prompt: "Pos.", value: (p) => String(p.pos) };
const GEWERK: PointAttrSpec = { tag: "GEWERK", prompt: "Gewerk", value: (p) => tradeName(p.trade, "de") };
const HOEHE: PointAttrSpec = { tag: "HOEHE_FFB_MM", prompt: "Höhe ü. FFB (mm)", value: (p) => whole(p.z) };
const kwAttr = (prompt: string): PointAttrSpec => ({ tag: "KW", prompt, value: (p) => num(p.values.kw) });
const DN: PointAttrSpec = { tag: "DN", prompt: "Nennweite (DN)", value: (p) => num(p.values.dn) };
const GREASY: PointAttrSpec = { tag: "FETTHALTIG", prompt: "fetthaltig", value: (p) => yes(p.values.greasy) };
const M3H: PointAttrSpec = { tag: "M3H", prompt: "Luftmenge (m³/h)", value: (p) => num(p.values.m3h) };
const KGH: PointAttrSpec = { tag: "KGH", prompt: "Dampf (kg/h)", value: (p) => num(p.values.kgH) };
const ELECTRIC: readonly PointAttrSpec[] = [
  kwAttr("Elektro (kW)"),
  { tag: "SPANNUNG_V", prompt: "Spannung (V)", value: (p) => num(p.values.voltage) },
  { tag: "PHASEN", prompt: "Phasen", value: (p) => num(p.values.phases) },
  { tag: "STROM_A", prompt: "Strom (A)", value: (p) => num(p.values.currentA) },
  { tag: "SICHERUNG_A", prompt: "Absicherung (A)", value: (p) => num(p.values.fuseA) },
  { tag: "ANSCHLUSSART", prompt: "Anschlussart", value: (p) => (p.values.plug ? plugName(p.values.plug, "de") : "") },
];
const head = (...specs: PointAttrSpec[]): readonly PointAttrSpec[] => [NR, POS, GEWERK, HOEHE, ...specs];

/**
 * The attributes of a point by trade, in this order: which point and how high, then the values a
 * fitter of that trade needs. A symbol stands for one trade, so its block's definitions are fixed.
 */
export const POINT_ATTRIBUTES: Readonly<Record<Trade, readonly PointAttrSpec[]>> = {
  electric: head(...ELECTRIC),
  gas: head(kwAttr("Gas (kW)"), DN),
  coldWater: head(DN),
  hotWater: head(DN),
  softWater: head(DN),
  drain: head(DN, GREASY),
  floorDrain: head(DN, GREASY),
  exhaust: head(M3H, DN),
  supply: head(M3H, DN),
  steam: head(KGH, DN),
  refrigeration: head(kwAttr("Kälte Verbund (kW)")),
};

/** The attribute definitions of a trade's points, on its layer. */
function pointAttdefs(trade: Trade, ps: number): DxfAttDef[] {
  const layer = TRADE_LAYER[trade];
  return attdefs(ps, POINT_ATTRIBUTES[trade].map((a) => ({ tag: a.tag, prompt: a.prompt, layer })));
}

/**
 * The block of a symbol: its parts at the export's paper scale around the base point, y flipped.
 * They lie on layer 0, so they take the trade layer and colour of each reference.
 */
function symbolBlock(id: SymbolId, ps: number): Omit<DxfBlock, "name"> {
  const m = (q: Vec2): Pt => ({ x: q.x * ps, y: -q.y * ps });
  const style = { layer: "0", ...penStyle("connection") };
  const entities = symbolParts(id).map((part): DxfEntity => {
    switch (part.t) {
      case "line":
        if (part.pts.length === 2 && !part.closed) return { type: "LINE", ...style, a: m(part.pts[0]), b: m(part.pts[1]) };
        return { type: "LWPOLYLINE", ...style, pts: part.pts.map(m), closed: part.closed };
      case "circle":
        return { type: "CIRCLE", ...style, c: m(part.c), r: part.r * ps };
      case "arc":
        return { type: "ARC", ...style, c: m(part.c), r: part.r * ps, ...dxfArcAngles(part.a0, part.a1) };
    }
  });
  return { entities, attdefs: pointAttdefs(symbolTrade(id), ps) };
}

/** A point as a reference of its symbol's block: at the point, upright, on its trade's layer. */
function pointInsert(p: ConnectionPoint, ps: number, blocks: BlockSet): DxfEntity {
  const id = symbolOf(p.trade, p.values.plug);
  const block = blocks.named(`KP_${id}`, () => symbolBlock(id, ps));
  const layer = TRADE_LAYER[p.trade];
  const at = MODEL.map(p.at);
  const defs = pointAttdefs(p.trade, ps);
  const attribs: DxfAttrib[] = POINT_ATTRIBUTES[p.trade].map((a, i) => ({
    tag: a.tag,
    value: a.value(p),
    layer,
    p: place(defs[i].p, 0, at),
    height: defs[i].height,
    rotation: 0,
  }));
  return { type: "INSERT", layer, block, p: at, rotation: 0, attribs };
}

/**
 * Triangles covering a simple polygon (ear clipping). Degenerate corners (zero-width seams of a
 * wall ring) are tolerated: a corner whose triangle has no area is cut off without output.
 */
export function triangulate(pts: readonly Vec2[]): [Vec2, Vec2, Vec2][] {
  const crossAt = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const sign = area2 >= 0 ? 1 : -1;
  const idx = pts.map((_, i) => i);
  const out: [Vec2, Vec2, Vec2][] = [];
  // Each pass removes one corner; a polygon that is not simple stops cutting instead of looping.
  let guard = pts.length * pts.length;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const a = pts[idx[(k + idx.length - 1) % idx.length]];
      const b = pts[idx[k]];
      const c = pts[idx[(k + 1) % idx.length]];
      const cr = crossAt(a, b, c) * sign;
      if (cr < 0) continue;
      if (cr > 1e-9) {
        const inside = idx.some((j) => {
          const p = pts[j];
          const same = (q: Vec2) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
          if (same(a) || same(b) || same(c)) return false;
          return crossAt(a, b, p) * sign > 0 && crossAt(b, c, p) * sign > 0 && crossAt(c, a, p) * sign > 0;
        });
        if (inside) continue;
        out.push([a, b, c]);
      }
      idx.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) {
    const [a, b, c] = idx.map((i) => pts[i]);
    if (Math.abs(crossAt(a, b, c)) > 1e-9) out.push([a, b, c]);
  }
  return out;
}
