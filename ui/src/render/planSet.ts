// The plan set as PDF: floor plan, elevations, equipment list and an optional 3D image on sheets
// of a chosen paper size, each with frame and title block. The drawings are the same primitives
// as on screen and in the other exports (`drawing.ts`), placed in paper millimetres at a true
// scale: a sheet at 1:50 printed at 100 % measures 1:50.

import { elevationDrawing, WALL_CUT_DEPTH, type ElevationCut } from "../model/elevation";
import { dimensionsText, drainText, equipmentRows, equipmentTotals, formatNumber, waterText, type EquipmentRow } from "../model/equipment";
import { planDrawing } from "../model/plan";
import { FACINGS, type Facing, type Item, type Project, type ProjectInfo, type Vec2 } from "../model/types";
import type { Box } from "../model/geometry";
import { formatDate, t, type Lang, type TKey } from "../lib/i18n";
import { drawingBounds, expandDim, TEXT, type Drawing, type Fill, type Pen, type Shape, type TextShape } from "./drawing";
import { PdfDocument, fitText, type PdfImage, type PdfPage, type Rgb, type StrokeStyle } from "./pdf";
import { PAPER, PEN_STYLE } from "./style";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS, type DrawingAtScale } from "./svg";

// ---- Options

export type PaperSize = "A4" | "A3" | "A2" | "A1" | "A0";
export const PAPER_SIZES: readonly PaperSize[] = ["A4", "A3", "A2", "A1", "A0"];
/** ISO 216 sizes in landscape (width, height in mm). */
const PAPER_MM: Record<PaperSize, readonly [number, number]> = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
export type Orientation = "landscape" | "portrait";

/** Scales a planner picks from, the most detailed first; "auto" takes the first that fits. */
export const PLAN_SCALES = [20, 25, 50, 75, 100, 200] as const;
export type ScaleChoice = "auto" | (typeof PLAN_SCALES)[number];

export interface PlanSetOptions {
  paper: PaperSize;
  orientation: Orientation;
  scale: ScaleChoice;
  plan: boolean;
  /** The elevations to print, in FACINGS order. */
  elevations: Facing[];
  list: boolean;
  /** A page with the 3D view (only when a 3D view can be captured). */
  view3d: boolean;
  /** Item names in the floor plan, independent of the view's setting (positions always). */
  names: boolean;
}

export const DEFAULT_PLAN_SET: PlanSetOptions = { paper: "A3", orientation: "landscape", scale: "auto", plan: true, elevations: [...FACINGS], list: true, view3d: false, names: false };

/** Options read back from storage: anything unknown falls back to the default. */
export function sanitizePlanSetOptions(v: unknown): PlanSetOptions {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const d = DEFAULT_PLAN_SET;
  const bool = (x: unknown, def: boolean) => (typeof x === "boolean" ? x : def);
  return {
    paper: PAPER_SIZES.includes(o.paper as PaperSize) ? (o.paper as PaperSize) : d.paper,
    orientation: o.orientation === "portrait" || o.orientation === "landscape" ? o.orientation : d.orientation,
    scale: o.scale === "auto" || PLAN_SCALES.includes(o.scale as never) ? (o.scale as ScaleChoice) : d.scale,
    plan: bool(o.plan, d.plan),
    elevations: Array.isArray(o.elevations) ? FACINGS.filter((f) => (o.elevations as unknown[]).includes(f)) : [...d.elevations],
    list: bool(o.list, d.list),
    view3d: bool(o.view3d, d.view3d),
    names: bool(o.names, d.names),
  };
}

// ---- Sheet layout (paper mm, origin top left)

/** Frame margins (ISO 5457: 20 mm filing margin on the left, 10 mm elsewhere). */
const FRAME_LEFT = 20;
const FRAME_OTHER = 10;
/** Title block width (ISO 7200: 180 mm), its rows and the free space around the drawing. */
const TITLE_W = 180;
const TITLE_ROW = 9;
const TITLE_ROWS = 5;
const DRAWING_PADDING = 8;

export interface SheetFrame {
  /** Paper size (mm). */
  width: number;
  height: number;
  frame: Box;
  title: Box;
  /** Where the drawing goes. */
  area: Box;
}

export function sheetFrame(paper: PaperSize, orientation: Orientation): SheetFrame {
  const [a, b] = PAPER_MM[paper];
  const [width, height] = orientation === "landscape" ? [a, b] : [b, a];
  const frame = { minX: FRAME_LEFT, minY: FRAME_OTHER, maxX: width - FRAME_OTHER, maxY: height - FRAME_OTHER };
  const title = { minX: frame.maxX - TITLE_W, minY: frame.maxY - TITLE_ROW * TITLE_ROWS, maxX: frame.maxX, maxY: frame.maxY };
  const area = { minX: frame.minX + DRAWING_PADDING, minY: frame.minY + DRAWING_PADDING, maxX: frame.maxX - DRAWING_PADDING, maxY: title.minY - DRAWING_PADDING };
  return { width, height, frame, title, area };
}

export interface ScaledDrawing {
  /** Drawing units per paper mm (50 for 1:50). */
  scale: number;
  drawing: Drawing;
  fits: boolean;
}

/** Whether a drawing laid out for `scale` fits into `area` at that scale. */
function fitsAt(drawing: Drawing, scale: number, area: Box): boolean {
  const b = drawingBounds(drawing, scale);
  return (b.maxX - b.minX) / scale <= area.maxX - area.minX + 1e-6 && (b.maxY - b.minY) / scale <= area.maxY - area.minY + 1e-6;
}

/**
 * The drawing at the chosen scale, or for "auto" at the most detailed scale of PLAN_SCALES it fits
 * (the coarsest when none fits). `fits` says whether it fits: the sheet never clips a drawing,
 * the caller refuses to export instead.
 */
export function scaleDrawing(at: DrawingAtScale, area: Box, choice: ScaleChoice): ScaledDrawing {
  if (choice !== "auto") {
    const drawing = at(choice);
    return { scale: choice, drawing, fits: fitsAt(drawing, choice, area) };
  }
  let last: ScaledDrawing | null = null;
  for (const s of PLAN_SCALES) {
    const drawing = at(s);
    last = { scale: s, drawing, fits: fitsAt(drawing, s, area) };
    if (last.fits) return last;
  }
  return last as ScaledDrawing;
}

// ---- Sheets of a plan set

export interface PlanSetContext {
  lang: Lang;
  /** The elevations' cut depth (the one set in the app). */
  cut: ElevationCut;
}

interface DrawingSheetSource {
  kind: "drawing";
  title: string;
  at: DrawingAtScale;
}

/** The drawing sheets the options ask for, in print order. */
function drawingSources(project: Project, opts: PlanSetOptions, ctx: PlanSetContext): DrawingSheetSource[] {
  const out: DrawingSheetSource[] = [];
  const tr = (k: TKey, vars?: Record<string, string | number>) => t(k, vars, ctx.lang);
  if (opts.plan) out.push({ kind: "drawing", title: tr("view.plan"), at: (ps) => planDrawing(project, { showNames: opts.names, showDims: true, paperScale: ps }) });
  const cutName = tr(`view.cut.${ctx.cut}`, { m: WALL_CUT_DEPTH / 1000 });
  for (const facing of FACINGS) {
    if (!opts.elevations.includes(facing)) continue;
    const view = tr("view.elevation", { facing: tr(`facing.${facing}`) });
    out.push({ kind: "drawing", title: tr("planSet.elevationTitle", { view, cut: cutName }), at: (ps) => elevationDrawing(project, facing, { showDims: true, cut: ctx.cut, paperScale: ps }) });
  }
  return out;
}

export interface SheetFit {
  title: string;
  scale: number;
  fits: boolean;
}

export interface PlanSetCheck {
  /** Each drawing sheet with its scale and whether it fits. */
  sheets: SheetFit[];
  /** Pages of the equipment list (0 when not printed). */
  listPages: number;
  /** All sheets including list and 3D pages. */
  total: number;
  /** With a fixed scale that does not fit: the most detailed coarser scale at which all fit. */
  fittingScale?: number;
  /** When something does not fit: the smallest paper (same orientation and scale choice) where all fit. */
  fittingPaper?: PaperSize;
}

function fitAll(project: Project, opts: PlanSetOptions, ctx: PlanSetContext): SheetFit[] {
  const { area } = sheetFrame(opts.paper, opts.orientation);
  return drawingSources(project, opts, ctx).map((s) => {
    const r = scaleDrawing(s.at, area, opts.scale);
    return { title: s.title, scale: r.scale, fits: r.fits };
  });
}

/** What the plan set dialog shows before exporting: scales, page count and what would fit instead. */
export function checkPlanSet(project: Project, opts: PlanSetOptions, ctx: PlanSetContext, view3d = opts.view3d): PlanSetCheck {
  const sheets = fitAll(project, opts, ctx);
  const listPages = opts.list ? paginateList(project, opts, ctx.lang).length : 0;
  const check: PlanSetCheck = { sheets, listPages, total: sheets.length + listPages + (view3d ? 1 : 0) };
  if (sheets.every((s) => s.fits)) return check;
  if (opts.scale !== "auto") {
    const coarser = PLAN_SCALES.filter((s) => s > (opts.scale as number));
    check.fittingScale = coarser.find((s) => fitAll(project, { ...opts, scale: s }, ctx).every((r) => r.fits));
  }
  const larger = PAPER_SIZES.slice(PAPER_SIZES.indexOf(opts.paper) + 1);
  check.fittingPaper = larger.find((p) => fitAll(project, { ...opts, paper: p }, ctx).every((r) => r.fits));
  return check;
}

// ---- Rendering

const hex = (c: string): Rgb => {
  const h = c.replace("#", "");
  const full = h.length === 3 ? [...h].map((x) => x + x).join("") : h;
  return [parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255];
};

const FILL_RGB: Record<Exclude<Fill, "none">, Rgb> = {
  wall: hex(PAPER.wallFill),
  item: hex(PAPER.itemFill),
  "item-dark": hex(PAPER.itemDarkFill),
  glass: hex(PAPER.glassFill),
  warning: hex(PAPER.warningFill),
};
const LINE = hex(PAPER.line);
/** Labels in the title block and the table header: printed grey, the values black. */
const LABEL_GREY: Rgb = [0.35, 0.35, 0.35];
const RULE_GREY: Rgb = [0.6, 0.6, 0.6];

const pen = (p: Pen): StrokeStyle => ({ width: PEN_STYLE[p].width, dash: PEN_STYLE[p].dash, color: LINE });
const fillOf = (f: Fill | undefined): Rgb | undefined => (f && f !== "none" ? FILL_RGB[f] : undefined);

/**
 * Draws a drawing on a page: its centre on the area's centre, `scale` drawing units per paper
 * mm. Pens and text sizes are paper mm already.
 */
export function drawDrawing(page: PdfPage, drawing: Drawing, scale: number, area: Box) {
  const b = drawingBounds(drawing, scale);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const ax = (area.minX + area.maxX) / 2;
  const ay = (area.minY + area.maxY) / 2;
  const P = (p: Vec2): Vec2 => ({ x: ax + (p.x - cx) / scale, y: ay + (p.y - cy) / scale });

  const text = (s: TextShape) => {
    const p = P(s.p);
    if (s.circled) {
      // As in the SVG export: the circle's centre a fixed fraction of the size above the
      // baseline, turned with the text.
      const a = ((s.angle ?? 0) * Math.PI) / 180;
      const rise = s.size * CIRCLE_CENTER_RISE;
      page.circle({ x: p.x + rise * Math.sin(a), y: p.y - rise * Math.cos(a) }, s.size * CIRCLE_RADIUS, { fill: FILL_RGB.item, stroke: pen("detail") });
    }
    page.text(s.text, p, { size: s.size, anchor: s.anchor, angle: s.angle, color: LINE });
  };

  for (const s of drawing.shapes as Shape[]) {
    switch (s.t) {
      case "poly":
        page.path(s.pts.map(P), s.closed, { stroke: pen(s.pen), fill: s.closed ? fillOf(s.fill) : undefined });
        break;
      case "circle":
        page.circle(P(s.c), s.r / scale, { stroke: pen(s.pen), fill: fillOf(s.fill) });
        break;
      case "arc":
        page.arc(P(s.c), s.r / scale, s.a0, s.a1, pen(s.pen));
        break;
      case "text":
        text(s);
        break;
      case "dim": {
        const e = expandDim(s, scale);
        for (const [a, c] of e.lines) page.line(P(a), P(c), pen("dim"));
        text(e.text);
        break;
      }
    }
  }
}

interface SheetInfo {
  title: string;
  /** Drawing units per paper mm; null for sheets without a scale (list, 3D image). */
  scale: number | null;
  n: number;
  m: number;
}

/** Frame and title block (ISO 7200 layout, 180 mm wide, bottom right). */
export function drawFrame(page: PdfPage, frame: SheetFrame, info: ProjectInfo, sheet: SheetInfo, lang: Lang) {
  const tr = (k: TKey, vars?: Record<string, string | number>) => t(k, vars, lang);
  const heavy = pen("frame");
  const thin: StrokeStyle = { width: PEN_STYLE.detail.width, color: LINE };
  const { frame: fr, title: tb } = frame;
  page.rect(fr.minX, fr.minY, fr.maxX - fr.minX, fr.maxY - fr.minY, { stroke: heavy });
  page.rect(tb.minX, tb.minY, TITLE_W, tb.maxY - tb.minY, { fill: [1, 1, 1], stroke: heavy });

  const x = (col: number) => tb.minX + col * (TITLE_W / 6);
  const y = (row: number) => tb.minY + row * TITLE_ROW;
  for (let r = 1; r < TITLE_ROWS; r++) page.line({ x: tb.minX, y: y(r) }, { x: tb.maxX, y: y(r) }, thin);
  const vline = (col: number, r0: number, r1: number) => page.line({ x: x(col), y: y(r0) }, { x: x(col), y: y(r1) }, thin);
  // Columns in sixths of the width: row 1 halves, rows 2 to 4 thirds.
  vline(3, 1, 2);
  vline(2, 2, 3);
  vline(4, 2, 4);
  vline(2, 4, 5);

  const PAD = 1.5;
  const cell = (c0: number, c1: number, row: number, label: TKey, value: string, bold = false) => {
    const w = x(c1) - x(c0) - 2 * PAD;
    page.text(tr(label), { x: x(c0) + PAD, y: y(row) + PAD + TEXT.small }, { size: TEXT.small, color: LABEL_GREY });
    const size = bold ? TEXT.large : TEXT.normal;
    page.text(fitText(value, w, size, bold ? "bold" : "regular"), { x: x(c0) + PAD, y: y(row + 1) - PAD }, { size, font: bold ? "bold" : "regular" });
  };
  cell(0, 6, 0, "sheet.project", info.name, true);
  cell(0, 3, 1, "sheet.client", info.client);
  cell(3, 6, 1, "sheet.author", info.author);
  cell(0, 2, 2, "sheet.drawingNo", str(info.drawingNo));
  cell(2, 4, 2, "sheet.revision", str(info.revision));
  cell(4, 6, 2, "sheet.date", formatDate(info.date, lang));
  cell(0, 4, 3, "sheet.drawing", sheet.title, true);
  cell(4, 6, 3, "sheet.sheet", tr("sheet.sheetOf", { n: sheet.n, m: sheet.m }));
  cell(0, 2, 4, "sheet.scale", sheet.scale === null ? tr("sheet.notToScale") : `1:${sheet.scale}`);
  const nw = x(6) - x(2) - 2 * PAD;
  page.text(fitText(tr("sheet.dimensionsInMm"), nw, TEXT.normal), { x: x(2) + PAD, y: y(4) + PAD + TEXT.normal }, { size: TEXT.normal });
  page.text(fitText(tr("data.typicalValues"), nw, TEXT.small), { x: x(2) + PAD, y: y(5) - PAD }, { size: TEXT.small, color: LABEL_GREY });
}

/** A text field that may be missing or, in a file from elsewhere, not a string. */
function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

// ---- Equipment list pages

interface ListRow {
  row: EquipmentRow;
  spec: string;
  price?: number;
}

const ROW_H = 6;
const ROW_SPEC_H = 9;
const HEAD_H = 8;
const CELL_PAD = 1.2;

/** The spec line of an item (manufacturer, model, article number); read defensively. */
function specLine(item: Item | undefined, lang: Lang): { spec: string; price?: number } {
  const s = (item?.spec ?? {}) as Record<string, unknown>;
  const parts = [str(s.manufacturer).trim(), str(s.model).trim()].filter(Boolean);
  const article = str(s.article).trim();
  if (article) parts.push(t("planSet.article", { no: article }, lang));
  const price = typeof s.price === "number" && Number.isFinite(s.price) ? s.price : undefined;
  return { spec: parts.join(" · "), price };
}

function listRows(project: Project, lang: Lang): ListRow[] {
  const byId = new Map(project.items.map((it) => [it.id, it]));
  return equipmentRows(project)
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .map((row) => ({ row, ...specLine(byId.get(row.id), lang) }));
}

/** The list rows split into pages that fit the area under the header (the totals on the last). */
function paginateList(project: Project, opts: PlanSetOptions, lang: Lang): ListRow[][] {
  const { area } = sheetFrame(opts.paper, opts.orientation);
  const room = area.maxY - area.minY - HEAD_H;
  const height = (r: ListRow) => (r.spec ? ROW_SPEC_H : ROW_H);
  const rows = listRows(project, lang);
  const pages: ListRow[][] = [[]];
  let used = 0;
  for (const r of rows) {
    if (used + height(r) > room && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(r);
    used += height(r);
  }
  // The last page also holds the totals and the line of water and drain points: when they do
  // not fit, its last row moves on, so the totals never stand on a page of their own.
  const last = pages[pages.length - 1];
  if (last.length > 1 && used + 2 * ROW_H > room) pages.push([last.pop() as ListRow]);
  return pages;
}

interface Column {
  key: TKey;
  width: number;
  align: "start" | "end";
  cell: (r: ListRow) => string;
}

function priceText(v: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function listColumns(rows: ListRow[], width: number, lang: Lang): Column[] {
  const n = (v: number | undefined) => (v === undefined ? "" : formatNumber(v, lang));
  const fixed: Column[] = [
    { key: "list.dimensions", width: 30, align: "end", cell: (r) => dimensionsText(r.row) },
    { key: "list.electric", width: 17, align: "end", cell: (r) => n(r.row.electricKw) },
    { key: "list.voltage", width: 17, align: "end", cell: (r) => n(r.row.voltage) },
    { key: "list.gas", width: 14, align: "end", cell: (r) => n(r.row.gasKw) },
    { key: "list.water", width: 16, align: "start", cell: (r) => waterText(r.row, lang) },
    { key: "list.drain", width: 26, align: "start", cell: (r) => drainText(r.row, lang) },
    { key: "list.exhaust", width: 18, align: "end", cell: (r) => n(r.row.exhaustM3h) },
  ];
  if (rows.some((r) => r.price !== undefined)) fixed.push({ key: "list.price", width: 22, align: "end", cell: (r) => (r.price === undefined ? "" : priceText(r.price, lang)) });
  const pos: Column = { key: "list.pos", width: 10, align: "end", cell: (r) => String(r.row.pos) };
  const rest = width - pos.width - fixed.reduce((s, c) => s + c.width, 0);
  // The note shares the free width with the name when there is room for both.
  const withNote = rest >= 110 && rows.some((r) => r.row.note);
  const nameW = withNote ? rest * 0.6 : rest;
  const cols: Column[] = [pos, { key: "list.name", width: nameW, align: "start", cell: (r) => r.row.name }, ...fixed];
  if (withNote) cols.push({ key: "list.note", width: rest - nameW, align: "start", cell: (r) => r.row.note });
  return cols;
}

function drawListPage(page: PdfPage, area: Box, rows: ListRow[], all: ListRow[], last: boolean, lang: Lang) {
  const width = area.maxX - area.minX;
  const cols = listColumns(all, width, lang);
  const thin: StrokeStyle = { width: PEN_STYLE.dim.width, color: RULE_GREY };
  const head: StrokeStyle = { width: PEN_STYLE.item.width, color: LINE };
  let y = area.minY;
  const cellX = (i: number) => area.minX + cols.slice(0, i).reduce((s, c) => s + c.width, 0);
  const put = (i: number, text: string, baseline: number, size: number, font: "regular" | "bold" = "regular", color?: Rgb) => {
    const c = cols[i];
    const w = c.width - 2 * CELL_PAD;
    const s = fitText(text, w, size, font);
    const x = c.align === "end" ? cellX(i) + c.width - CELL_PAD : cellX(i) + CELL_PAD;
    page.text(s, { x, y: baseline }, { size, font, anchor: c.align, color });
  };

  // Header: labels may need two lines on narrow paper; they are shortened instead.
  cols.forEach((c, i) => put(i, t(c.key, undefined, lang), y + HEAD_H - 2.2, TEXT.small, "bold"));
  y += HEAD_H;
  page.line({ x: area.minX, y }, { x: area.maxX, y }, head);

  for (const r of rows) {
    const h = r.spec ? ROW_SPEC_H : ROW_H;
    const base = y + ROW_H - 1.8;
    cols.forEach((c, i) => put(i, c.cell(r), base, TEXT.normal));
    if (r.spec) put(1, r.spec, base + 3.2, TEXT.small, "regular", LABEL_GREY);
    y += h;
    page.line({ x: area.minX, y }, { x: area.maxX, y }, thin);
  }

  if (!last) return;
  const tot = equipmentTotals(all.map((r) => r.row));
  const n = (v: number) => (v ? formatNumber(v, lang) : "");
  const counted = (pairs: [TKey, number][]) =>
    pairs
      .filter(([, c]) => c > 0)
      .map(([k, c]) => `${c} × ${t(k, undefined, lang)}`)
      .join(", ");
  const priceSum = all.reduce((s, r) => s + (r.price ?? 0), 0);
  const totals: Partial<Record<TKey, string>> = {
    "list.name": t("list.total", undefined, lang),
    "list.electric": n(tot.electricKw),
    "list.gas": n(tot.gasKw),
    "list.exhaust": n(tot.exhaustM3h),
    "list.price": priceSum ? priceText(priceSum, lang) : "",
  };
  page.line({ x: area.minX, y }, { x: area.maxX, y }, head);
  cols.forEach((c, i) => {
    const v = totals[c.key];
    if (v) put(i, v, y + ROW_H - 1.8, TEXT.normal, "bold");
  });
  // The water and drain points are counts by kind, too long for their columns: one line below.
  const points = [
    ["list.water", counted([["list.cold", tot.coldWater], ["list.hot", tot.hotWater]])],
    ["list.drain", counted([["list.drain", tot.drain], ["list.floorDrain", tot.floorDrain]])],
  ] as const;
  const line = points
    .filter(([, v]) => v)
    .map(([k, v]) => `${t(k, undefined, lang)}: ${v}`)
    .join(" · ");
  const x = cellX(1) + CELL_PAD;
  if (line) page.text(fitText(line, area.maxX - x, TEXT.normal), { x, y: y + 2 * ROW_H - 1.8 }, { size: TEXT.normal });
}

// ---- The plan set

export interface PlanSetInput extends PlanSetContext {
  /** PNG of the 3D view for its page (left out when null). */
  image?: Uint8Array | null;
  /** Fixed creation date (tests). */
  date?: Date;
}

/** Thrown when a drawing does not fit its sheet at the chosen scale (the dialog prevents it). */
export class SheetTooSmall extends Error {}

/** The plan set as PDF bytes. */
export async function planSetPdf(project: Project, opts: PlanSetOptions, input: PlanSetInput): Promise<Uint8Array> {
  const { lang } = input;
  const frame = sheetFrame(opts.paper, opts.orientation);
  const drawings = drawingSources(project, opts, input).map((s) => ({ title: s.title, ...scaleDrawing(s.at, frame.area, opts.scale) }));
  const tooBig = drawings.find((d) => !d.fits);
  if (tooBig) throw new SheetTooSmall(t("planSet.tooSmall", { sheet: tooBig.title, scale: tooBig.scale, paper: opts.paper }, lang));
  const listPages = opts.list ? paginateList(project, opts, lang) : [];
  const doc = new PdfDocument();
  doc.info = { title: `${project.info.name} – ${t("planSet.fileName", undefined, lang)}`, author: project.info.author || undefined, subject: t("planSet.fileName", undefined, lang) };
  let image: PdfImage | null = null;
  if (opts.view3d && input.image) image = await doc.addPng(input.image);
  const m = drawings.length + listPages.length + (image ? 1 : 0);
  let n = 0;
  const sheet = (title: string, scale: number | null) => {
    const page = doc.addPage(frame.width, frame.height);
    drawFrame(page, frame, project.info, { title, scale, n: ++n, m }, lang);
    return page;
  };

  for (const d of drawings) drawDrawing(sheet(d.title, d.scale), d.drawing, d.scale, frame.area);
  const all = listPages.flat();
  listPages.forEach((rows, i) => drawListPage(sheet(t("list.title", undefined, lang), null), frame.area, rows, all, i === listPages.length - 1, lang));
  if (image) {
    const page = sheet(t("view.3d", undefined, lang), null);
    const a = frame.area;
    const k = Math.min((a.maxX - a.minX) / image.width, (a.maxY - a.minY) / image.height);
    const w = image.width * k;
    const h = image.height * k;
    page.image(image, (a.minX + a.maxX - w) / 2, (a.minY + a.maxY - h) / 2, w, h);
  }
  return doc.toBytes({ date: input.date });
}
