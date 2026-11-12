// DXF export (AutoCAD 2000, AC1015, ASCII, millimetres): the plan and the elevations for a
// planner who goes on in CAD. Each unit is a block reference with its data as attributes, so it
// can be picked, moved and listed there; the layers follow the trades, so the walls, the
// equipment or the electrical data can be shown and hidden on their own. y is flipped (DXF y
// points up). The file format itself is `dxfWriter.ts`; this module maps a Drawing onto it.
//
// Dimensions stay plain lines and text on BEMASSUNG, cut walls stay SOLID triangles: both look
// in every reader exactly as in the app.

import { drawingBounds, expandDim, LAYER_OF, TEXT, type Drawing, type Pen, type Shape, type TextShape } from "./drawing";
import { dxfNumber, writeDxf, type DxfAttDef, type DxfAttrib, type DxfBlock, type DxfEntity, type DxfLayer, type DxfLinetype, type Pt } from "./dxfWriter";
import { PEN_STYLE } from "./style";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS } from "./svg";
import type { Item, Vec2 } from "../model/types";

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
} as const;

/**
 * Every layer of the export: AutoCAD colour index (7 black/white, 8 grey, 4 cyan, 6 magenta,
 * 3 green, 1 red, 30 orange, 5 blue, 34 brown, 140 blue-cyan), line type and lineweight in
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
   * labels) become one block reference carrying its data as attributes; without items every
   * shape is written as plain geometry.
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

  const blocks = new BlockSet();
  const entities: DxfEntity[] = [];
  const inserted = new Set<string>();
  for (const s of drawing.shapes) {
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
];

/** Attribute definitions stacked below the block's base point, small text. */
function attdefs(ps: number): DxfAttDef[] {
  const height = TEXT.small * ps * CAP_HEIGHT_PER_EM;
  return DXF_ATTRIBUTES.map((a, i) => ({ tag: a.tag, prompt: a.prompt, layer: a.layer, p: { x: 0, y: -(i + 1) * height * 1.6 }, height, invisible: true }));
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
