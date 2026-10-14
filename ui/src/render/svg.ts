// SVG export: a Drawing as a standalone SVG document at true scale (printing at 100 % gives the
// stated scale), and a complete A3 sheet with frame and title block.

import { drawingBounds, expandDim, mm as mmText, TEXT, type Drawing, type Fill, type Pen, type Shape, type TextShape } from "./drawing";
import { PAPER, PEN_STYLE } from "./style";
import type { Box } from "../model/geometry";
import type { ProjectInfo, Vec2 } from "../model/types";
import { formatDate, t, type Lang, type TKey } from "../lib/i18n";

export interface SvgOptions {
  /** Drawing units per paper millimetre (50 for 1:50). */
  paperScale: number;
  /** White space around the drawing (paper mm); default 10. */
  margin?: number;
  /** The area to show (drawing units); default the drawing's extent plus the margin. */
  bounds?: Box;
}

const DEFAULT_MARGIN = 10;
const FONT_FAMILY = "Arial, Helvetica, sans-serif";
/**
 * Circled text: the circle centre sits this fraction of the font size above the baseline and
 * its radius is this fraction of the font size (the same as the on-screen DrawingSvg).
 */
export const CIRCLE_CENTER_RISE = 0.36;
export const CIRCLE_RADIUS = 0.95;

const FILL_COLOR: Record<Fill, string> = {
  none: "none",
  wall: PAPER.wallFill,
  item: PAPER.itemFill,
  "item-dark": PAPER.itemDarkFill,
  glass: PAPER.glassFill,
  warning: PAPER.warningFill,
};

/** Escapes text for XML content and attribute values. */
export function xmlEscape(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);
}

/** A number for SVG output: at most three decimals, no "-0". */
function f(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return String(r === 0 ? 0 : r);
}

function strokeAttrs(pen: Pen, ps: number): string {
  const st = PEN_STYLE[pen];
  let a = ` stroke="${PAPER.line}" stroke-width="${f(st.width * ps)}" stroke-linejoin="round" stroke-linecap="round"`;
  if (st.dash) a += ` stroke-dasharray="${st.dash.map((d) => f(d * ps)).join(" ")}"`;
  return a;
}

/** An SVG path of an arc; angles clockwise on screen from +x, drawn from a0 to a1. */
function arcD(c: Vec2, r: number, a0: number, a1: number): string {
  const sweep = (((a1 - a0) % 360) + 360) % 360 || 360;
  const pt = (a: number) => ({ x: c.x + r * Math.cos((a * Math.PI) / 180), y: c.y + r * Math.sin((a * Math.PI) / 180) });
  if (sweep >= 360) {
    // A full circle cannot be one arc command: two halves.
    const p0 = pt(a0);
    const p1 = pt(a0 + 180);
    return `M${f(p0.x)} ${f(p0.y)}A${f(r)} ${f(r)} 0 1 1 ${f(p1.x)} ${f(p1.y)}A${f(r)} ${f(r)} 0 1 1 ${f(p0.x)} ${f(p0.y)}`;
  }
  const p0 = pt(a0);
  const p1 = pt(a0 + sweep);
  return `M${f(p0.x)} ${f(p0.y)}A${f(r)} ${f(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${f(p1.x)} ${f(p1.y)}`;
}

function textEl(s: TextShape, ps: number): string {
  const size = s.size * ps;
  const rot = s.angle ? ` transform="rotate(${f(s.angle)} ${f(s.p.x)} ${f(s.p.y)})"` : "";
  let out = "";
  if (s.circled) {
    // The baseline stays at p: the rise is half of Arial's cap height (0.716), so the digits sit
    // centred in the circle without dominant-baseline, which not every SVG reader supports.
    const cy = s.p.y - size * CIRCLE_CENTER_RISE;
    out += `<circle cx="${f(s.p.x)}" cy="${f(cy)}" r="${f(size * CIRCLE_RADIUS)}" fill="${PAPER.itemFill}"${strokeAttrs("detail", ps)}/>`;
  }
  out += `<text x="${f(s.p.x)}" y="${f(s.p.y)}" font-size="${f(size)}" text-anchor="${s.anchor}" fill="${PAPER.line}">${xmlEscape(s.text)}</text>`;
  return rot ? `<g${rot}>${out}</g>` : out;
}

function shapeEl(s: Shape, ps: number): string {
  switch (s.t) {
    case "poly": {
      const pts = s.pts.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
      const fill = s.closed ? FILL_COLOR[s.fill ?? "none"] : "none";
      return `<${s.closed ? "polygon" : "polyline"} points="${pts}" fill="${fill}"${strokeAttrs(s.pen, ps)}/>`;
    }
    case "circle":
      return `<circle cx="${f(s.c.x)}" cy="${f(s.c.y)}" r="${f(s.r)}" fill="${FILL_COLOR[s.fill ?? "none"]}"${strokeAttrs(s.pen, ps)}/>`;
    case "arc":
      return `<path d="${arcD(s.c, s.r, s.a0, s.a1)}" fill="none"${strokeAttrs(s.pen, ps)}/>`;
    case "text":
      return textEl(s, ps);
    case "dim": {
      const e = expandDim(s, ps);
      const lines = e.lines.map(([a, b]) => `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}"${strokeAttrs("dim", ps)}/>`);
      return lines.join("") + textEl(e.text, ps);
    }
  }
}

/**
 * A standalone SVG document of a drawing. The viewBox is in drawing units (mm of the kitchen),
 * width and height in paper mm (extent / paperScale), so a print at 100 % has the true scale.
 */
export function drawingToSvg(drawing: Drawing, opts: SvgOptions): string {
  const ps = opts.paperScale;
  let box = opts.bounds;
  if (!box) {
    const b = drawingBounds(drawing, ps);
    const m = (opts.margin ?? DEFAULT_MARGIN) * ps;
    box = { minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m };
  }
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const body = drawing.shapes.map((s) => shapeEl(s, ps)).join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${f(w / ps)}mm" height="${f(h / ps)}mm" viewBox="${f(box.minX)} ${f(box.minY)} ${f(w)} ${f(h)}" font-family="${FONT_FAMILY}">\n` +
    `<rect x="${f(box.minX)}" y="${f(box.minY)}" width="${f(w)}" height="${f(h)}" fill="${PAPER.background}"/>\n` +
    body +
    `\n</svg>\n`
  );
}

// ---- Sheet ----

/** A3 landscape (ISO 216), mm. */
export const SHEET_W = 420;
export const SHEET_H = 297;
/** Frame margins (ISO 5457: 20 mm filing margin on the left, 10 mm elsewhere). */
const FRAME_LEFT = 20;
const FRAME_OTHER = 10;
/** Title block width (ISO 7200: 180 mm) and the height of one of its rows. */
const TITLE_W = 180;
const TITLE_ROW = 9;
const TITLE_ROWS = 4;
/** Free space between the frame and the drawing (paper mm). */
const DRAWING_PADDING = 8;
/** Standard scales offered for sheets, the most detailed first. */
export const SHEET_SCALES = [20, 25, 50, 75, 100, 200, 500] as const;

export interface Sheet {
  /** The drawing placed on the sheet, with frame and title block. */
  drawing: Drawing;
  /** The chosen scale (drawing units per paper mm). */
  paperScale: number;
  /** The paper area in drawing units (for the SVG viewBox). */
  bounds: Box;
}

/**
 * A drawing at a paper scale: position numbers, names and dimension rows are spaced in paper mm,
 * so a drawing laid out for one scale crowds its labels at a coarser one.
 */
export type DrawingAtScale = (paperScale: number) => Drawing;

/**
 * A drawing placed on an A3 landscape sheet at the most detailed standard scale it fits,
 * centred in the area above the title block, with frame and title block as Drawing primitives
 * (so the DXF export can reuse it). Given as a `DrawingAtScale`, the drawing is laid out again
 * for each scale tried, so the sheet carries it laid out for the scale it is printed at.
 */
export function sheetDrawing(source: Drawing | DrawingAtScale, info: ProjectInfo, drawingTitle: string, lang: Lang): Sheet {
  const at = typeof source === "function" ? source : () => source;
  const frame = { minX: FRAME_LEFT, minY: FRAME_OTHER, maxX: SHEET_W - FRAME_OTHER, maxY: SHEET_H - FRAME_OTHER };
  const titleH = TITLE_ROW * TITLE_ROWS;
  const area = { minX: frame.minX + DRAWING_PADDING, minY: frame.minY + DRAWING_PADDING, maxX: frame.maxX - DRAWING_PADDING, maxY: frame.maxY - titleH - DRAWING_PADDING };
  const areaW = area.maxX - area.minX;
  const areaH = area.maxY - area.minY;

  // The most detailed scale it fits, else the coarsest (the last one tried).
  let ps = 0;
  let drawing: Drawing = { shapes: [] };
  for (const s of SHEET_SCALES) {
    ps = s;
    drawing = at(s);
    const b = drawingBounds(drawing, s);
    if ((b.maxX - b.minX) / s <= areaW && (b.maxY - b.minY) / s <= areaH) break;
  }

  // Paper mm → drawing units, the drawing's centre on the area's centre.
  const b = drawingBounds(drawing, ps);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const ax = (area.minX + area.maxX) / 2;
  const ay = (area.minY + area.maxY) / 2;
  const P = (x: number, y: number): Vec2 => ({ x: cx + (x - ax) * ps, y: cy + (y - ay) * ps });

  const shapes: Shape[] = [...drawing.shapes];
  const rect = (x0: number, y0: number, x1: number, y1: number) =>
    shapes.push({ t: "poly", pen: "frame", pts: [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], closed: true });
  const line = (x0: number, y0: number, x1: number, y1: number) => shapes.push({ t: "poly", pen: "frame", pts: [P(x0, y0), P(x1, y1)], closed: false });
  const text = (x: number, y: number, s: string, size: number) => shapes.push({ t: "text", pen: "frame", p: P(x, y), text: s, size, anchor: "start" });

  rect(frame.minX, frame.minY, frame.maxX, frame.maxY);

  // Title block, bottom right: project across the full width, then two columns.
  const tx0 = frame.maxX - TITLE_W;
  const ty0 = frame.maxY - titleH;
  const mid = tx0 + TITLE_W / 2;
  rect(tx0, ty0, frame.maxX, frame.maxY);
  for (let r = 1; r < TITLE_ROWS; r++) line(tx0, ty0 + r * TITLE_ROW, frame.maxX, ty0 + r * TITLE_ROW);
  line(mid, ty0 + TITLE_ROW, mid, frame.maxY);

  const label = (k: TKey) => t(k, undefined, lang);
  const LABEL_PAD = 1.5;
  const cell = (x: number, row: number, key: TKey, value: string, size: number = TEXT.normal) => {
    const top = ty0 + row * TITLE_ROW;
    text(x + LABEL_PAD, top + LABEL_PAD + TEXT.small, label(key), TEXT.small);
    text(x + LABEL_PAD, top + TITLE_ROW - LABEL_PAD, value, size);
  };
  cell(tx0, 0, "sheet.project", info.name);
  cell(tx0, 1, "sheet.client", info.client);
  cell(mid, 1, "sheet.date", formatDate(info.date, lang));
  cell(tx0, 2, "sheet.author", info.author);
  cell(mid, 2, "sheet.scale", `1:${mmText(ps)}`);
  cell(tx0, 3, "sheet.drawing", drawingTitle);
  text(mid + LABEL_PAD, ty0 + TITLE_ROWS * TITLE_ROW - LABEL_PAD, label("sheet.dimensionsInMm"), TEXT.normal);

  const p0 = P(0, 0);
  const p1 = P(SHEET_W, SHEET_H);
  return { drawing: { shapes }, paperScale: ps, bounds: { minX: p0.x, minY: p0.y, maxX: p1.x, maxY: p1.y } };
}

/** A complete A3 sheet as SVG: the drawing at a standard scale with frame and title block. */
export function sheetSvg(drawing: Drawing | DrawingAtScale, info: ProjectInfo, drawingTitle: string, lang: Lang): string {
  const sheet = sheetDrawing(drawing, info, drawingTitle, lang);
  return drawingToSvg(sheet.drawing, { paperScale: sheet.paperScale, bounds: sheet.bounds });
}
