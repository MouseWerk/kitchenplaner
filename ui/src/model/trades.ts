// The trades of connection points (Gewerke) and the series their values are rounded to. A unit has
// a point of a trade exactly when its connection values switch the trade on (`activeTrades`), so
// ticking a connection in the inspector adds the point and there is no second list to keep in
// sync. Names and codes come from the catalogs (`trade.<id>`, `trade.<id>.code`).

import { t, type Lang, type TKey } from "../lib/i18n";
import type { Connections, Plug, Trade } from "./types";

export type { Plug, Trade } from "./types";

/** Every trade, in the order of lists, files, layers and the inspector. */
export const TRADES: readonly Trade[] = ["electric", "gas", "coldWater", "hotWater", "softWater", "drain", "floorDrain", "exhaust", "supply", "steam", "refrigeration"];

/** The groups the installation plan has one sheet and one table for. */
export type TradeGroup = "electric" | "sanitary" | "gas" | "ventilation" | "special";

/** The groups in the order of the plan set: Elektro, Sanitär, Gas, Lüftung, Kälte und Dampf. */
export const TRADE_GROUPS: readonly TradeGroup[] = ["electric", "sanitary", "gas", "ventilation", "special"];

export const TRADE_GROUP: Readonly<Record<Trade, TradeGroup>> = {
  electric: "electric",
  gas: "gas",
  coldWater: "sanitary",
  hotWater: "sanitary",
  softWater: "sanitary",
  drain: "sanitary",
  floorDrain: "sanitary",
  exhaust: "ventilation",
  supply: "ventilation",
  steam: "special",
  refrigeration: "special",
};

/** Which points a view or an export shows: all of them or one group. */
export type PointFilter = "all" | TradeGroup;

/** Does the filter let points of this trade through? */
export function inFilter(trade: Trade, filter: PointFilter): boolean {
  return filter === "all" || TRADE_GROUP[trade] === filter;
}

/** The trades the connection values switch on, in `TRADES` order. */
export function activeTrades(c: Connections): Trade[] {
  const on: Record<Trade, boolean> = {
    electric: (c.electricKw ?? 0) > 0,
    gas: (c.gasKw ?? 0) > 0,
    coldWater: c.coldWater === true,
    hotWater: c.hotWater === true,
    softWater: c.softWater === true,
    drain: c.drain === true,
    floorDrain: c.floorDrain === true,
    exhaust: (c.exhaustM3h ?? 0) > 0,
    supply: (c.supplyM3h ?? 0) > 0,
    steam: (c.steamKgH ?? 0) > 0,
    refrigeration: (c.refrigerationKw ?? 0) > 0,
  };
  return TRADES.filter((tr) => on[tr]);
}

/** Nominal sizes of pipes (DN) and ducts (diameter in mm), smallest first. */
const PIPES = [15, 20, 25, 32, 40, 50] as const;
/** Spiral duct diameters (EN 1506) from 100 to 630 mm. */
const DUCTS = [100, 125, 150, 160, 180, 200, 224, 250, 280, 315, 355, 400, 450, 500, 560, 630] as const;

/**
 * The nominal sizes a trade's point is chosen from. Electric points have none; remote
 * refrigeration lines are sized by the refrigeration planner (in inches), so they have none either.
 */
export const DN_SERIES: Readonly<Partial<Record<Trade, readonly number[]>>> = {
  gas: PIPES,
  coldWater: PIPES,
  hotWater: PIPES,
  softWater: PIPES,
  steam: PIPES,
  drain: [40, 50, 70, 100, 125],
  floorDrain: [100, 125, 150],
  exhaust: DUCTS,
  supply: DUCTS,
};

/** Rated currents of fuses and circuit breakers (A). */
export const FUSE_SERIES: readonly number[] = [10, 13, 16, 20, 25, 32, 35, 40, 50, 63, 80, 100, 125];

/** The plug types, hard-wired first. */
export const PLUGS: readonly Plug[] = ["fixed", "schuko", "cee16", "cee32", "cee63"];

/** The highest current a plug carries (A); no plug limits a fixed connection. */
export const PLUG_RATING: Readonly<Record<Plug, number>> = {
  fixed: Infinity,
  schuko: 16,
  cee16: 16,
  cee32: 32,
  cee63: 63,
};

/** The trade's name („Kaltwasser“). */
export function tradeName(trade: Trade, lang?: Lang): string {
  return t(`trade.${trade}` as TKey, undefined, lang);
}

/** The trade's short code on plans and in point ids („KW“, English “CW”). */
export function tradeCode(trade: Trade, lang?: Lang): string {
  return t(`trade.${trade}.code` as TKey, undefined, lang);
}

/** The group's name („Sanitär“), for sheet titles, tables and the filter. */
export function tradeGroupName(group: TradeGroup, lang?: Lang): string {
  return t(`tradeGroup.${group}` as TKey, undefined, lang);
}

/** The plug type's name („Festanschluss“, „CEE 16 A“). */
export function plugName(plug: Plug, lang?: Lang): string {
  return t(`plug.${plug}` as TKey, undefined, lang);
}
