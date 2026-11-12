// The connection list (Anschlussliste): one row per connection point with its place on the plan,
// its distances from the two wall faces a fitter measures from (`wallRefs`), its height above the
// finished floor and its values, and the CSV export for spreadsheets. It follows the equipment
// list's CSV rules: BOM, separator and decimal mark per language, the typical-values note last.
// Also the one text form of a point's values and height that every view and output uses.

import { csvDocument, csvText, formatNumber } from "./equipment";
import { pointLabel, projectPoints, wallRefs, type ConnectionPoint, type WallRef } from "./points";
import { plugName, tradeName, type PointFilter } from "./trades";
import type { Project, Trade } from "./types";
import { t, type Lang, type TKey } from "../lib/i18n";

export interface PointRow {
  /** The point's id („12.E“). */
  no: string;
  pos: number;
  /** The unit's name. */
  name: string;
  point: ConnectionPoint;
  /** The faces the point is measured from: the nearest, then one turned against it (up to two). */
  walls: WallRef[];
}

/** The rows of the points the filter lets through, by position number and trade. */
export function pointRows(project: Pick<Project, "items" | "room">, filter: PointFilter = "all", lang?: Lang): PointRow[] {
  const names = new Map(project.items.map((it) => [it.id, it.name]));
  return projectPoints(project.items, filter).map((p) => ({
    no: pointLabel(p, lang),
    pos: p.pos,
    name: names.get(p.itemId) ?? "",
    point: p,
    walls: wallRefs(project.room, p.at),
  }));
}

// ---- Point values as text ----
//
// One wording for the inspector, the connection table of the plan set, the plan labels and the
// lists, so a point reads the same everywhere. Numbers go through `formatNumber` (decimal comma in
// German, no thousands grouping), as in the CSV.

/** The height of a point as plans and tables write it: „+300“, „±0“, „-20“ (whole mm). */
export function heightText(z: number): string {
  const r = Math.round(z);
  return r === 0 ? "±0" : r > 0 ? `+${r}` : String(r);
}

/** A duct's size is its diameter, a pipe's its DN. */
const DUCT_TRADES: ReadonlySet<Trade> = new Set(["exhaust", "supply"]);

/** The nominal size of a point: „Ø 280“ for a duct, „DN 50“ for a pipe. */
export function sizeText(trade: Trade, dn: number): string {
  return `${DUCT_TRADES.has(trade) ? "Ø" : "DN"} ${Math.round(dn)}`;
}

/**
 * A current: „22,9 A“. A load too small for one decimal (an exit sign's 10 W) reads „< 0,1 A“,
 * not „0 A“, which would look like no load at all.
 */
export function currentText(currentA: number, kw: number | undefined, lang: Lang): string {
  return currentA < 0.05 && (kw ?? 0) > 0 ? `< ${formatNumber(0.1, lang)} A` : `${formatNumber(currentA, lang)} A`;
}

/**
 * The values of a point in one line: an electric one „15,9 kW · 400 V 3N~ · 22,9 A · 25 A ·
 * Festanschluss“ (load, supply, current, fuse, connection type), gas „43 kW · DN 25“, a duct
 * „1200 m³/h · Ø 280“, a drain „DN 50 · fetthaltig“. `withKw: false` leaves out an electric
 * point's load where the unit's connection values already show it (the inspector); the load of a
 * gas or refrigeration point is its main value and always shown.
 */
export function pointValuesText(p: Pick<ConnectionPoint, "trade" | "values">, lang: Lang, opts: { withKw?: boolean } = {}): string {
  const v = p.values;
  const n = (x: number) => formatNumber(x, lang);
  const parts: string[] = [];
  const kw = p.trade === "electric" ? opts.withKw !== false : true;
  if (kw && v.kw) parts.push(`${n(v.kw)} kW`);
  if (v.voltage) parts.push(`${n(v.voltage)} V ${v.phases === 3 ? "3N~" : "1N~"}`);
  if (v.currentA !== undefined) parts.push(currentText(v.currentA, v.kw, lang));
  if (v.fuseA !== undefined) parts.push(`${n(v.fuseA)} A`);
  if (v.plug) parts.push(plugName(v.plug, lang));
  if (v.m3h) parts.push(`${n(v.m3h)} m³/h`);
  if (v.kgH) parts.push(`${n(v.kgH)} kg/h`);
  if (v.dn) parts.push(sizeText(p.trade, v.dn));
  if (v.greasy) parts.push(t("pointList.greasy", undefined, lang));
  return parts.join(" · ");
}

/** „Wand 3“ or „Trennwand 2“, numbered as the inspector counts them. */
export function wallRefName(w: WallRef, lang?: Lang): string {
  return w.kind === "wall" ? t("view.wallName", { n: w.index + 1 }, lang) : t("inspector.partitionShort", { n: w.index + 1 }, lang);
}

const COLUMNS: readonly TKey[] = [
  "pointList.no",
  "list.pos",
  "list.name",
  "pointList.trade",
  "pointList.x",
  "pointList.y",
  "pointList.wallA",
  "pointList.distA",
  "pointList.wallB",
  "pointList.distB",
  "pointList.height",
  "pointList.kw",
  "pointList.voltage",
  "pointList.phases",
  "pointList.current",
  "pointList.fuse",
  "pointList.plug",
  "pointList.dn",
  "pointList.m3h",
  "pointList.kgH",
  "pointList.greasy",
  "pointList.note",
];

/**
 * The connection list as CSV text: lengths in whole mm (X and Y on the plan, distances, height),
 * values as the points resolve them, a greasy drain marked „x“. Like the equipment list, German
 * uses semicolons and a decimal comma, English commas and a decimal point, with a BOM for Excel.
 */
export function pointsCsv(project: Pick<Project, "items" | "room">, lang: Lang, filter: PointFilter = "all"): string {
  const n = (v: number | undefined) => (v === undefined ? "" : formatNumber(v, lang));
  const mm = (v: number | undefined) => (v === undefined ? "" : String(Math.round(v)));
  const lines: string[][] = [COLUMNS.map((k) => t(k, undefined, lang))];
  for (const r of pointRows(project, filter, lang)) {
    const p = r.point;
    const v = p.values;
    const [a, b] = r.walls;
    lines.push([
      r.no,
      String(r.pos),
      csvText(r.name),
      tradeName(p.trade, lang),
      mm(p.at.x),
      mm(p.at.y),
      a ? wallRefName(a, lang) : "",
      mm(a?.distance),
      b ? wallRefName(b, lang) : "",
      mm(b?.distance),
      mm(p.z),
      n(v.kw),
      n(v.voltage),
      v.phases === undefined ? "" : String(v.phases),
      n(v.currentA),
      n(v.fuseA),
      v.plug === undefined ? "" : plugName(v.plug, lang),
      n(v.dn),
      n(v.m3h),
      n(v.kgH),
      v.greasy ? "x" : "",
      csvText(v.note ?? ""),
    ]);
  }
  lines.push(COLUMNS.map((_, i) => (i === 2 ? t("data.typicalValues", undefined, lang) : "")));
  return csvDocument(lines, lang);
}
