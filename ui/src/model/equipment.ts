// The equipment list (Geräteliste): one row per item with its connection values, the totals an
// installer needs, and the CSV export for spreadsheets.

import { positions } from "./project";
import type { Project } from "./types";
import { t, type Lang, type TKey } from "../lib/i18n";

export interface EquipmentRow {
  id: string;
  pos: number;
  name: string;
  width: number;
  depth: number;
  height: number;
  electricKw?: number;
  voltage?: number;
  gasKw?: number;
  coldWater: boolean;
  hotWater: boolean;
  drain: boolean;
  floorDrain: boolean;
  exhaustM3h?: number;
  note: string;
}

export interface EquipmentTotals {
  electricKw: number;
  gasKw: number;
  exhaustM3h: number;
  /** Number of cold and hot water, drain and floor drain points. */
  coldWater: number;
  hotWater: number;
  drain: number;
  floorDrain: number;
}

/** One row per item, in position order. */
export function equipmentRows(project: Project): EquipmentRow[] {
  const pos = positions(project);
  return project.items.map((it) => {
    const c = it.connections;
    return {
      id: it.id,
      pos: pos.get(it.id) ?? 0,
      name: it.name,
      width: it.width,
      depth: it.depth,
      height: it.height,
      electricKw: c.electricKw,
      voltage: c.voltage,
      gasKw: c.gasKw,
      coldWater: !!c.coldWater,
      hotWater: !!c.hotWater,
      drain: !!c.drain,
      floorDrain: !!c.floorDrain,
      exhaustM3h: c.exhaustM3h,
      note: it.note ?? "",
    };
  });
}

/** Sums of the connected loads and counts of the water and drain points. */
export function equipmentTotals(rows: readonly EquipmentRow[]): EquipmentTotals {
  const sum = (f: (r: EquipmentRow) => number | undefined) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const count = (f: (r: EquipmentRow) => boolean) => rows.filter(f).length;
  return {
    electricKw: round2(sum((r) => r.electricKw)),
    gasKw: round2(sum((r) => r.gasKw)),
    exhaustM3h: round2(sum((r) => r.exhaustM3h)),
    coldWater: count((r) => r.coldWater),
    hotWater: count((r) => r.hotWater),
    drain: count((r) => r.drain),
    floorDrain: count((r) => r.floorDrain),
  };
}

/** Sums of floats like 15.6 + 22.4 would otherwise show float noise. */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** "1200 × 700 × 900" */
export function dimensionsText(r: Pick<EquipmentRow, "width" | "depth" | "height">): string {
  return [r.width, r.depth, r.height].map((v) => String(Math.round(v))).join(" × ");
}

/** The water cell: "KW, WW" / "Cold, Hot". */
export function waterText(r: Pick<EquipmentRow, "coldWater" | "hotWater">, lang: Lang): string {
  const parts: string[] = [];
  if (r.coldWater) parts.push(t("list.cold", undefined, lang));
  if (r.hotWater) parts.push(t("list.hot", undefined, lang));
  return parts.join(", ");
}

/** The drain cell: the drain label and/or "Bodenablauf". */
export function drainText(r: Pick<EquipmentRow, "drain" | "floorDrain">, lang: Lang): string {
  const parts: string[] = [];
  if (r.drain) parts.push(t("list.drain", undefined, lang));
  if (r.floorDrain) parts.push(t("list.floorDrain", undefined, lang));
  return parts.join(", ");
}

const COLUMNS: readonly TKey[] = ["list.pos", "list.name", "list.dimensions", "list.electric", "list.voltage", "list.gas", "list.water", "list.drain", "list.exhaust", "list.note"];

/** UTF-8 byte order mark: Excel only detects UTF-8 in a CSV file with it. */
const BOM = "﻿";
/** RFC 4180 line break. */
const EOL = "\r\n";

/**
 * The equipment list as CSV text for spreadsheets, with a total row. German uses semicolons and
 * a decimal comma (what Excel expects in a German locale), English commas and a decimal point.
 * Starts with a BOM so Excel reads it as UTF-8.
 */
export function equipmentCsv(project: Project, lang: Lang): string {
  const sep = lang === "de" ? ";" : ",";
  const n = (v: number | undefined) => (v === undefined ? "" : formatNumber(v, lang));
  const rows = equipmentRows(project);
  const lines: string[][] = [COLUMNS.map((k) => t(k, undefined, lang))];
  for (const r of rows) {
    lines.push([String(r.pos), r.name, dimensionsText(r), n(r.electricKw), n(r.voltage), n(r.gasKw), waterText(r, lang), drainText(r, lang), n(r.exhaustM3h), r.note]);
  }
  const tot = equipmentTotals(rows);
  const counted = (pairs: [TKey, number][]) =>
    pairs
      .filter(([, c]) => c > 0)
      .map(([k, c]) => `${c} × ${t(k, undefined, lang)}`)
      .join(", ");
  lines.push([
    "",
    t("list.total", undefined, lang),
    "",
    n(tot.electricKw),
    "",
    n(tot.gasKw),
    counted([["list.cold", tot.coldWater], ["list.hot", tot.hotWater]]),
    counted([["list.drain", tot.drain], ["list.floorDrain", tot.floorDrain]]),
    n(tot.exhaustM3h),
    "",
  ]);
  return BOM + lines.map((cells) => cells.map((c) => csvField(c, sep)).join(sep)).join(EOL) + EOL;
}

/** A number for a CSV cell: up to two decimals, no thousands separator, decimal comma in German. */
export function formatNumber(v: number, lang: Lang): string {
  const s = String(round2(v));
  return lang === "de" ? s.replace(".", ",") : s;
}

/** Quotes a CSV field when it contains the separator, a quote or a line break (RFC 4180). */
export function csvField(v: string, sep: string): string {
  if (!v.includes(sep) && !/["\r\n]/.test(v)) return v;
  return `"${v.replace(/"/g, '""')}"`;
}
