// The connection list (Anschlussliste): one row per connection point with its place on the plan,
// its distances from the two wall faces a fitter measures from (`wallRefs`), its height above the
// finished floor and its values, and the CSV export for spreadsheets. It follows the equipment
// list's CSV rules: BOM, separator and decimal mark per language, the typical-values note last.

import { csvDocument, csvText, formatNumber } from "./equipment";
import { pointLabel, projectPoints, wallRefs, type ConnectionPoint, type WallRef } from "./points";
import { plugName, tradeName, type PointFilter } from "./trades";
import type { Project } from "./types";
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
