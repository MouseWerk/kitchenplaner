// The installation plan (P1): the floor plan drawn quietly, with the connection points of one trade
// group (or all) on top: a symbol per point, its id and height beside it, two dimensions to the
// wall faces it is set out from, and a legend of the symbols used. The PDF plan set, the exports
// and the plan view with a trade filter all draw this.
//
// Point shapes carry `trade` and `point` but no `itemId`: they belong to no unit's DXF block and
// go on their trade's layer. The height table lists the same numbers and is the authoritative list.

import { EPS, type Box } from "./geometry";
import { around, BoxGrid, boxesMeet, planDrawing, TEXT_ASCENT, TEXT_DESCENT } from "./plan";
import { pointLabel, projectPoints, wallRefs, type ConnectionPoint } from "./points";
import { plugName, tradeCode, tradeName, type PointFilter } from "./trades";
import type { Plug, Project, Vec2 } from "./types";
import { t, type Lang } from "../lib/i18n";
import { drawingBounds, mm, TEXT, type DimShape, type Drawing, type Shape } from "../render/drawing";
import { textWidth } from "../render/pdf";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS } from "../render/svg";
import { SYMBOL_SIZE, SYMBOLS, symbolOf, symbolShapes, symbolTrade, type SymbolId } from "../render/symbols";

export interface InstallationOptions {
  /** The points shown: all, or one trade group. */
  filter: PointFilter;
  /** Drawing units per paper millimetre (50 for 1:50). */
  paperScale: number;
  /** Wall dimensions and the two dimensions of every point. */
  dims: boolean;
  /** The legend of the symbols used, with the note on heights. */
  legend: boolean;
  lang?: Lang;
}

/**
 * The installation plan of a project: `planDrawing` without kind details and with the equipment
 * drawn quietly, the points' dimensions, their symbols and labels on top, and the legend to the
 * right of all that, top-aligned, so it never covers the plan.
 */
export function installationDrawing(project: Project, o: InstallationOptions): Drawing {
  const ps = o.paperScale;
  const plan = planDrawing(project, { showNames: false, showDims: o.dims, paperScale: ps, symbols: false, quiet: true });
  const points = projectPoints(project.items, o.filter);
  const shapes: Shape[] = [...plan.shapes];
  if (o.dims) shapes.push(...dimsOf(project, points));
  shapes.push(...drawPoints(points, ps, o.lang, numberBoxes(plan.shapes, ps)));
  if (o.legend) shapes.push(...legendShapes(points, drawingBounds({ shapes }, ps), ps, o.lang));
  return { shapes };
}

/** The boxes of the circled position numbers of a plan (plan mm), for labels to keep clear of. */
function numberBoxes(shapes: readonly Shape[], ps: number): Box[] {
  const out: Box[] = [];
  for (const s of shapes) {
    if (s.t !== "text" || !s.circled) continue;
    const size = s.size * ps;
    out.push(around({ x: s.p.x, y: s.p.y - CIRCLE_CENTER_RISE * size }, CIRCLE_RADIUS * size));
  }
  return out;
}

// ---- Symbols and labels ----

/** Least gap between a label and another label, a symbol or a position number (paper mm). */
const LABEL_CLEAR = 0.4;
/** Baseline to baseline of the two label lines, in font sizes. */
const LABEL_LINE = 1.2;
/** Rings of places a label tries around its symbol before it gives up and stays beside it. */
const LABEL_RINGS = 80;

/** The height of a point as plans write it: „+300“, „±0“. */
export function heightText(z: number): string {
  const r = Math.round(z);
  return r === 0 ? "±0" : r > 0 ? `+${mm(r)}` : mm(r);
}

/**
 * The symbols and labels of the points the filter lets through. `avoid` lists boxes (plan mm)
 * the labels keep clear of, such as the position numbers of the plan below.
 */
export function pointsDrawing(project: Project, filter: PointFilter, paperScale: number, opts: { lang?: Lang; avoid?: readonly Box[] } = {}): Drawing {
  return { shapes: drawPoints(projectPoints(project.items, filter), paperScale, opts.lang, opts.avoid ?? []) };
}

/** A point's symbol, by trade and, for electric points, connection type. */
export function pointSymbol(p: Pick<ConnectionPoint, "trade" | "values">): SymbolId {
  return symbolOf(p.trade, p.values.plug);
}

/**
 * Symbols at the points, then each label (id over height) at the first free place of a ring
 * search around its symbol: right beside it, then round it clockwise, then on rings further out,
 * with a leader back to the symbol. A place is free when the label keeps `LABEL_CLEAR` from every
 * symbol, every label placed before and every box in `avoid`. Deterministic: the points come in
 * the order of `projectPoints`.
 */
function drawPoints(points: readonly ConnectionPoint[], ps: number, lang: Lang | undefined, avoid: readonly Box[]): Shape[] {
  const shapes: Shape[] = [];
  const half = (SYMBOL_SIZE / 2) * ps;
  const gap = LABEL_CLEAR * ps;
  const h = TEXT.small * ps;
  const height = (TEXT_ASCENT + LABEL_LINE + TEXT_DESCENT) * h;
  const taken = new BoxGrid<Box>(4 * height);
  for (const b of avoid) taken.add(b, b);
  for (const p of points) {
    const b = around(p.at, half);
    taken.add(b, b);
    shapes.push(...symbolShapes(pointSymbol(p), p.at, ps, tagsOf(p)));
  }
  const free = (b: Box) => !taken.some({ minX: b.minX - gap, minY: b.minY - gap, maxX: b.maxX + gap, maxY: b.maxY + gap }, (o) => boxesMeet(b, o, gap));

  for (const p of points) {
    const id = pointLabel(p, lang);
    const z = heightText(p.z);
    const width = Math.max(textWidth(id, TEXT.small), textWidth(z, TEXT.small)) * ps;
    const boxAt = (c: Vec2): Box => ({ minX: c.x - width / 2, maxX: c.x + width / 2, minY: c.y - height / 2, maxY: c.y + height / 2 });
    let box = boxAt(labelPlace(p.at, 1, 0, half + 1.25 * gap, width, height));
    let ring = 0;
    search: for (; ring <= LABEL_RINGS; ring++) {
      const rho = half + 1.25 * gap + ring * height * 0.75;
      const steps = ring === 0 ? 8 : Math.max(8, Math.ceil((2 * Math.PI * rho) / height));
      for (let k = 0; k < steps; k++) {
        const a = (2 * Math.PI * k) / steps;
        const b = boxAt(labelPlace(p.at, Math.cos(a), Math.sin(a), rho, width, height));
        if (free(b)) {
          box = b;
          break search;
        }
      }
    }
    // Nowhere free (a point buried among others at a coarse scale): beside its symbol after all.
    if (ring > LABEL_RINGS) ring = 0;
    taken.add(box, box);
    const tags = tagsOf(p);
    const cx = (box.minX + box.maxX) / 2;
    const base = box.minY + TEXT_ASCENT * h;
    shapes.push({ t: "text", pen: "connection", ...tags, p: { x: cx, y: base }, text: id, size: TEXT.small, anchor: "middle" });
    shapes.push({ t: "text", pen: "connection", ...tags, p: { x: cx, y: base + LABEL_LINE * h }, text: z, size: TEXT.small, anchor: "middle" });
    if (ring > 0) {
      const leader = leaderTo(p.at, half, box);
      // `label`: an annotation like the leaders of position numbers, not part of the symbol.
      if (leader) shapes.push({ t: "poly", pen: "connection", ...tags, label: true, pts: leader, closed: false });
    }
  }
  return shapes;
}

const tagsOf = (p: ConnectionPoint) => ({ trade: p.trade, point: { itemId: p.itemId, trade: p.trade } });

/**
 * The centre of a label of `w` × `h` in direction (cx, cy) from `at`, its near side or corner on
 * the square of half side `rho` around it: a label to the right is vertically centred on the
 * symbol, one at a diagonal touches the square with its corner, and between them it slides along.
 */
function labelPlace(at: Vec2, cx: number, cy: number, rho: number, w: number, h: number): Vec2 {
  const push = (c: number) => Math.max(-1, Math.min(1, c * Math.SQRT2));
  return { x: at.x + push(cx) * (rho + w / 2), y: at.y + push(cy) * (rho + h / 2) };
}

/** A leader from the symbol's edge to the nearest point of the label's box; null when they touch. */
function leaderTo(at: Vec2, half: number, box: Box): Vec2[] | null {
  const near = { x: Math.max(box.minX, Math.min(box.maxX, at.x)), y: Math.max(box.minY, Math.min(box.maxY, at.y)) };
  const d = Math.hypot(near.x - at.x, near.y - at.y);
  if (d <= half + EPS) return null;
  const k = half / d;
  return [{ x: at.x + (near.x - at.x) * k, y: at.y + (near.y - at.y) * k }, near];
}

// ---- Dimensions ----

/**
 * Two dimensions of every point the filter lets through: from the nearest wall face and from the
 * nearest one turned against it (`wallRefs`), each from the foot on the face to the point, on the
 * "connection" pen. A point on a face gets no dimension from it.
 */
export function pointDims(project: Project, filter: PointFilter): DimShape[] {
  return dimsOf(project, projectPoints(project.items, filter));
}

function dimsOf(project: Project, points: readonly ConnectionPoint[]): DimShape[] {
  const out: DimShape[] = [];
  if (project.room.points.length < 3) return out;
  for (const p of points) {
    for (const ref of wallRefs(project.room, p.at)) {
      if (ref.distance < 0.5) continue;
      out.push({ t: "dim", pen: "connection", ...tagsOf(p), a: ref.foot, b: p.at, offset: 0, text: mm(ref.distance) });
    }
  }
  return out;
}

// ---- Legend ----

/** Space between the drawing and the legend, and the height of a legend row (paper mm). */
const LEGEND_GAP = 10;
const LEGEND_ROW = 5;
/** Space between a legend symbol and its text (paper mm). */
const LEGEND_TEXT_GAP = 2;

/** The symbols the points use, in legend order. */
export function usedSymbols(points: readonly Pick<ConnectionPoint, "trade" | "values">[]): SymbolId[] {
  const used = new Set(points.map(pointSymbol));
  return SYMBOLS.filter((s) => used.has(s));
}

/**
 * The legend's text of a symbol: code and trade („KW Kaltwasser“), an electric one with the
 * connection types it stands for, so the CEE ratings in use are named.
 */
export function legendText(id: SymbolId, points: readonly Pick<ConnectionPoint, "trade" | "values">[], lang?: Lang): string {
  const trade = symbolTrade(id);
  const text = `${tradeCode(trade, lang)} ${tradeName(trade, lang)}`;
  if (trade !== "electric") return text;
  const plugs = new Set<Plug>();
  for (const p of points) if (p.trade === "electric" && pointSymbol(p) === id) plugs.add(p.values.plug ?? "fixed");
  const named = (["fixed", "schuko", "cee16", "cee32", "cee63"] as const).filter((pl) => plugs.has(pl)).map((pl) => plugName(pl, lang));
  return named.length > 0 ? `${text}, ${named.join(" / ")}` : text;
}

/**
 * The legend: its title, one row per symbol used (symbol, code and name) and the note that heights
 * are in mm above the finished floor, top-aligned to the right of `beside` (plan mm).
 */
function legendShapes(points: readonly ConnectionPoint[], beside: Box, ps: number, lang?: Lang): Shape[] {
  const shapes: Shape[] = [];
  const x = beside.maxX + LEGEND_GAP * ps;
  let y = beside.minY + TEXT_ASCENT * TEXT.normal * ps;
  shapes.push({ t: "text", pen: "connection", p: { x, y }, text: t("legend.title", undefined, lang), size: TEXT.normal, anchor: "start" });
  y += (TEXT_DESCENT * TEXT.normal + LEGEND_ROW / 2 + 1) * ps;
  for (const id of usedSymbols(points)) {
    const trade = symbolTrade(id);
    const c = { x: x + (SYMBOL_SIZE / 2) * ps, y };
    shapes.push(...symbolShapes(id, c, ps, { trade }));
    // Centred on the symbol the way circled numbers are.
    const p = { x: x + (SYMBOL_SIZE + LEGEND_TEXT_GAP) * ps, y: y + CIRCLE_CENTER_RISE * TEXT.small * ps };
    shapes.push({ t: "text", pen: "connection", trade, p, text: legendText(id, points, lang), size: TEXT.small, anchor: "start" });
    y += LEGEND_ROW * ps;
  }
  shapes.push({ t: "text", pen: "connection", p: { x, y: y + CIRCLE_CENTER_RISE * TEXT.small * ps }, text: t("legend.heights", undefined, lang), size: TEXT.small, anchor: "start" });
  return shapes;
}

