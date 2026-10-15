// The equipment list (Geräteliste): one row per item with its product and connection values, the
// totals an installer needs (plain and with the simultaneity factor), and the CSV export for
// spreadsheets.

import type { Project } from "./types";
import { num, t, type Lang, type TKey } from "../lib/i18n";

export interface EquipmentRow {
  id: string;
  pos: number;
  name: string;
  /** Product of the position ("" when not given). */
  manufacturer: string;
  model: string;
  article: string;
  /** Net price in euros. */
  price?: number;
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
  /** Sum of the net prices given (positions without a price count as 0). */
  price: number;
}

/** One row per item, sorted by position number. */
export function equipmentRows(project: Pick<Project, "items">): EquipmentRow[] {
  const sorted = [...project.items].sort((a, b) => a.pos - b.pos);
  return sorted.map((it) => {
    const c = it.connections;
    const spec = it.spec ?? {};
    return {
      id: it.id,
      pos: it.pos,
      name: it.name,
      manufacturer: spec.manufacturer ?? "",
      model: spec.model ?? "",
      article: spec.article ?? "",
      ...(spec.price !== undefined ? { price: spec.price } : {}),
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
    price: round2(sum((r) => r.price)),
  };
}

/**
 * A connected load (kW) times the simultaneity factor: the peak a supply is sized for when not
 * every appliance runs at full power at once. The plain sum stays the „Anschlussleistung“.
 */
export function withSimultaneity(kw: number, factor: number): number {
  return round2(kw * factor);
}

/** Sums of floats like 15.6 + 22.4 would otherwise show float noise. */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * The electric load for the status bar in the display language: the plain sum, or with a factor
 * below 1 the load times the factor, saying so ("48,0 kW bei Gleichzeitigkeit 0,6").
 */
export function electricStatus(project: Pick<Project, "items" | "settings">): string {
  const sum = project.items.reduce((s, it) => s + (it.connections.electricKw ?? 0), 0);
  const f = project.settings.simultaneity;
  if (f >= 1) return t("data.statusKw", { kw: num(sum, 1) });
  return t("data.statusKwFactored", { kw: num(withSimultaneity(sum, f), 1), f: num(f, 2) });
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

const COLUMNS: readonly TKey[] = [
  "list.pos",
  "list.name",
  "list.manufacturer",
  "list.model",
  "list.article",
  "list.dimensions",
  "list.electric",
  "list.voltage",
  "list.gas",
  "list.water",
  "list.drain",
  "list.exhaust",
  "list.note",
  "list.price",
];

/** UTF-8 byte order mark: Excel only detects UTF-8 in a CSV file with it. */
const BOM = "﻿";
/** RFC 4180 line break. */
const EOL = "\r\n";

/**
 * The equipment list as CSV text for spreadsheets, sorted by position, with a total row, a row
 * with the loads times the project's simultaneity factor and the note that connection values are
 * typical values. German uses semicolons and a decimal comma (what Excel expects in a German
 * locale), English commas and a decimal point. Starts with a BOM so Excel reads it as UTF-8.
 */
export function equipmentCsv(project: Pick<Project, "items" | "settings">, lang: Lang): string {
  const sep = lang === "de" ? ";" : ",";
  const n = (v: number | undefined) => (v === undefined ? "" : formatNumber(v, lang));
  const rows = equipmentRows(project);
  const lines: string[][] = [COLUMNS.map((k) => t(k, undefined, lang))];
  for (const r of rows) {
    // Name, product and note are typed by the user; every other cell is a number or a fixed label.
    lines.push([
      String(r.pos),
      csvText(r.name),
      csvText(r.manufacturer),
      csvText(r.model),
      csvText(r.article),
      dimensionsText(r),
      n(r.electricKw),
      n(r.voltage),
      n(r.gasKw),
      waterText(r, lang),
      drainText(r, lang),
      n(r.exhaustM3h),
      csvText(r.note),
      r.price === undefined ? "" : formatPrice(r.price, lang),
    ]);
  }
  const tot = equipmentTotals(rows);
  const counted = (pairs: [TKey, number][]) =>
    pairs
      .filter(([, c]) => c > 0)
      .map(([k, c]) => `${c} × ${t(k, undefined, lang)}`)
      .join(", ");
  const priced = rows.some((r) => r.price !== undefined);
  lines.push([
    "",
    t("list.total", undefined, lang),
    "",
    "",
    "",
    "",
    n(tot.electricKw),
    "",
    n(tot.gasKw),
    counted([["list.cold", tot.coldWater], ["list.hot", tot.hotWater]]),
    counted([["list.drain", tot.drain], ["list.floorDrain", tot.floorDrain]]),
    n(tot.exhaustM3h),
    "",
    priced ? formatPrice(tot.price, lang) : "",
  ]);
  const f = project.settings.simultaneity;
  const factored = ["", t("list.simultaneous", { f: formatNumber(f, lang) }, lang), "", "", "", "", n(withSimultaneity(tot.electricKw, f)), "", n(withSimultaneity(tot.gasKw, f)), "", "", "", "", ""];
  lines.push(factored);
  lines.push(["", t("data.typicalValues", undefined, lang), "", "", "", "", "", "", "", "", "", "", "", ""]);
  return BOM + lines.map((cells) => cells.map((c) => csvField(c, sep)).join(sep)).join(EOL) + EOL;
}

/** A number for a CSV cell: up to two decimals, no thousands separator, decimal comma in German. */
export function formatNumber(v: number, lang: Lang): string {
  const s = String(round2(v));
  return lang === "de" ? s.replace(".", ",") : s;
}

/** A price for a CSV cell: always two decimals, no thousands separator, decimal comma in German. */
export function formatPrice(v: number, lang: Lang): string {
  const s = (Math.round(v * 100) / 100).toFixed(2);
  return lang === "de" ? s.replace(".", ",") : s;
}

/** Quotes a CSV field when it contains the separator, a quote or a line break (RFC 4180). */
export function csvField(v: string, sep: string): string {
  if (!v.includes(sep) && !/["\r\n]/.test(v)) return v;
  return `"${v.replace(/"/g, '""')}"`;
}

/**
 * Starts of a cell that a spreadsheet runs as a formula (= + - @), or that Excel strips before
 * checking for one (tab, carriage return).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * A free-text cell that opens as text, never as a formula: a leading apostrophe, which
 * spreadsheets hide, defuses a name like "=HYPERLINK(...)" (CSV injection). Only for text the user
 * typed: numbers are written by `formatNumber` and must stay numbers, so a negative value keeps
 * its minus sign.
 */
export function csvText(v: string): string {
  return FORMULA_START.test(v) ? `'${v}` : v;
}
