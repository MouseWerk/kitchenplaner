// Where a unit's connection points sit and what their catalog values are, before the planner
// changes anything (`model/points.ts` applies `Item.points` on top). Positions are anchors: so many
// mm from the left, centre or right; from the back, centre or front; and in height from the floor,
// from the unit's lower edge or from its top. A point keeps its distance from that edge when the
// unit is resized.
//
// The defaults come from a chain of sources, the later one winning: a profile by placement (this
// file), then the rules registered with `registerPointRule` (by category or group, by kind, by
// entry: `pointRules.ts`), then the entry's own `points`.
//
// Water follows the fitter's convention for taps and angle valves: hot on the left, cold on the
// right, seen from the front (softened water between them).

import { catalogEntry, kindOf, placementOf } from "../registry";
import { POINT_RULES } from "./pointRules";
import { TRADES } from "../../model/trades";
import type { Item, Plug, Trade } from "../../model/types";
import type { CatalogEntry, Placement } from "../types";

/** x: left, centre or right seen from the front; y: back, centre or front. */
export type Edge = "start" | "centre" | "end";
/** Heights count from the floor, from the unit's lower edge (`elevation`) or from its top. */
export type Level = "floor" | "bottom" | "top";

/**
 * A distance along the width (x) or depth (y). `mm` points into the unit from `start` and `end`
 * (so a negative value from the front lies in front of the unit) and towards `end` from `centre`.
 */
export interface Along {
  from: Edge;
  mm: number;
}

/** A height: `mm` above the level (negative below it). */
export interface Height {
  from: Level;
  mm: number;
}

export interface PointPlace {
  x: Along;
  y: Along;
  z: Height;
}

/** A point's catalog place and values; `dn` may depend on the unit (its width, its variant). */
export interface PointDefault extends PointPlace {
  dn?: number | ((item: Item) => number);
  plug?: Plug;
  greasy?: boolean;
}

/** Changes to the defaults per trade; what is left out stays as the earlier sources gave it. */
export type PointLayout = Partial<Record<Trade, Partial<PointDefault>>>;

export type ProfileId = "back" | "line" | "tall" | "tableTop" | "sink" | "dish" | "tilt" | "wallHung" | "overhead" | "flat";

// Shorthands for the profiles below.
const L = (mm: number): Along => ({ from: "start", mm });
const C = (mm = 0): Along => ({ from: "centre", mm });
const R = (mm: number): Along => ({ from: "end", mm });
const BACK = (mm: number): Along => ({ from: "start", mm });
const FRONT = (mm: number): Along => ({ from: "end", mm });
const floor = (mm: number): Height => ({ from: "floor", mm });
const bottom = (mm: number): Height => ({ from: "bottom", mm });
const top = (mm: number): Height => ({ from: "top", mm });
const at = (x: Along, y: Along, z: Height): PointPlace => ({ x, y, z });

/** A floor drain in front of the unit, as tilting pans and kettles need one. */
const IN_FRONT = at(C(), FRONT(-300), floor(0));
/** Air at the top of the unit: exhaust in the centre, supply to the left of it. */
const EXHAUST_TOP = at(C(), C(), top(0));
const SUPPLY_TOP = at(L(300), C(), top(0));

/** Units standing on the floor with their back to the wall: the connections behind them. */
const BACK_PROFILE: Record<Trade, PointPlace> = {
  electric: at(R(150), BACK(50), floor(300)),
  gas: at(L(150), BACK(50), floor(300)),
  coldWater: at(C(100), BACK(50), floor(400)),
  hotWater: at(C(-100), BACK(50), floor(400)),
  softWater: at(C(0), BACK(50), floor(400)),
  drain: at(C(), BACK(50), floor(200)),
  floorDrain: IN_FRONT,
  exhaust: EXHAUST_TOP,
  supply: SUPPLY_TOP,
  steam: at(L(300), BACK(50), floor(400)),
  refrigeration: at(R(300), BACK(50), floor(300)),
};

/**
 * Every trade of every profile has a place, so a unit with a connection its profile does not
 * expect still gets a point (the planner may tick any connection).
 */
export const PROFILES: Readonly<Record<ProfileId, Readonly<Record<Trade, PointPlace>>>> = {
  back: BACK_PROFILE,
  // The cooking lines: the same anchors as `back`, kept apart so the rules can tune them.
  line: { ...BACK_PROFILE },
  // Fridges, combi ovens: tall, often on a stand; air leaves at the top.
  tall: { ...BACK_PROFILE },
  // On a table or counter: the socket above the counter, water and drain under it.
  tableTop: {
    electric: at(C(), BACK(0), bottom(250)),
    gas: at(L(150), BACK(50), bottom(-300)),
    coldWater: at(C(100), BACK(50), bottom(-300)),
    hotWater: at(C(-100), BACK(50), bottom(-300)),
    softWater: at(C(0), BACK(50), bottom(-300)),
    drain: at(C(), BACK(50), bottom(-400)),
    floorDrain: IN_FRONT,
    exhaust: EXHAUST_TOP,
    supply: SUPPLY_TOP,
    steam: at(L(300), BACK(50), bottom(-300)),
    refrigeration: at(R(300), BACK(50), bottom(-300)),
  },
  // Water under the bowl (the rules know where the bowl is; the centre until then).
  sink: {
    ...BACK_PROFILE,
    coldWater: at(C(100), BACK(50), floor(550)),
    hotWater: at(C(-100), BACK(50), floor(550)),
    softWater: at(C(0), BACK(50), floor(550)),
    drain: at(C(), BACK(50), floor(400)),
    steam: at(L(300), BACK(50), floor(550)),
  },
  // Dish machines: water higher up behind the machine, the drain low.
  dish: {
    ...BACK_PROFILE,
    coldWater: at(C(100), BACK(50), floor(500)),
    hotWater: at(C(-100), BACK(50), floor(500)),
    softWater: at(C(0), BACK(50), floor(500)),
    steam: at(L(300), BACK(50), floor(500)),
  },
  // Tilting pans and kettles: the filling tap's water high on the right, a floor drain in front.
  tilt: {
    ...BACK_PROFILE,
    coldWater: at(R(200), BACK(50), floor(900)),
    hotWater: at(R(400), BACK(50), floor(900)),
    softWater: at(R(300), BACK(50), floor(900)),
  },
  // Hand wash basins, water heaters: hung on the wall, connections just above and below.
  wallHung: {
    electric: at(R(150), BACK(0), top(100)),
    gas: at(L(150), BACK(0), bottom(-100)),
    coldWater: at(C(100), BACK(0), bottom(-100)),
    hotWater: at(C(-100), BACK(0), bottom(-100)),
    softWater: at(C(0), BACK(0), bottom(-100)),
    drain: at(C(), BACK(0), bottom(-150)),
    floorDrain: IN_FRONT,
    exhaust: EXHAUST_TOP,
    supply: SUPPLY_TOP,
    steam: at(L(300), BACK(0), bottom(-100)),
    refrigeration: at(R(300), BACK(0), bottom(-100)),
  },
  // Hoods and ceilings: everything at the top, except the condensate drain at the bottom.
  overhead: {
    electric: at(R(150), C(), top(0)),
    gas: at(L(150), C(), top(0)),
    coldWater: at(C(100), C(), top(0)),
    hotWater: at(C(-100), C(), top(0)),
    softWater: at(C(0), C(), top(0)),
    drain: at(C(), C(), bottom(0)),
    floorDrain: IN_FRONT,
    exhaust: EXHAUST_TOP,
    supply: SUPPLY_TOP,
    steam: at(L(300), C(), top(0)),
    refrigeration: at(R(300), C(), top(0)),
  },
  // Set into the floor: every point in the centre, at the floor.
  flat: Object.fromEntries(TRADES.map((tr) => [tr, at(C(), C(), floor(0))])) as Record<Trade, PointPlace>,
};

/** The profile of each placement, the first source of defaults. */
const PROFILE_BY_PLACEMENT: Readonly<Record<Placement, ProfileId>> = {
  floor: "back",
  tableTop: "tableTop",
  overhead: "overhead",
  flat: "flat",
};

/**
 * Catalog values every unit starts from, whatever its profile: the smallest usual sizes. Gas
 * pipes and ducts are sized by their load in `model/points.ts` unless a rule gives a size.
 */
const BASE_VALUES: PointLayout = {
  coldWater: { dn: 15 },
  hotWater: { dn: 15 },
  softWater: { dn: 15 },
  steam: { dn: 15 },
  drain: { dn: 50 },
  floorDrain: { dn: 100 },
};

/**
 * Values by placement, part of the first source: a table-top unit plugs into a socket
 * (`fitPlug` in model/points.ts makes it a CEE socket or a fixed connection when the load needs it).
 */
const PLACEMENT_VALUES: Readonly<Partial<Record<Placement, PointLayout>>> = {
  tableTop: { electric: { plug: "schuko" } },
};

/** What a rule sees of a unit. */
export interface PointContext {
  item: Item;
  /** Absent for a catalog id this build does not know (a newer file). */
  entry: CatalogEntry | undefined;
  kind: string;
  placement: Placement;
}

/**
 * What one source of defaults decides. A `profile` replaces the profile and every layout decided
 * before it; a `layout` refines what is decided so far.
 */
export interface PointRuleResult {
  profile?: ProfileId;
  layout?: PointLayout;
}

/** A source of defaults after the placement: nothing (undefined) when it has no say on the unit. */
export type PointRule = (ctx: PointContext) => PointRuleResult | undefined;

// The catalog's own rules are registered here rather than by importing `pointRules.ts` for its
// side effect: registry.ts and this file import each other, so a registration from the other
// side could run before `rules` exists, depending on which module is loaded first.
const rules: PointRule[] = [...POINT_RULES];

/**
 * Adds a source of defaults after the catalog's own (`POINT_RULES`: by category or group, by
 * kind, by entry); later ones win. Registering the same function twice has no effect.
 */
export function registerPointRule(rule: PointRule): void {
  if (!rules.includes(rule)) rules.push(rule);
}

/** The defaults of every trade for a unit (the points shown are those of its active trades). */
export function defaultPoints(item: Item): Record<Trade, PointDefault> {
  const entry = catalogEntry(item.catalogId);
  const kind = kindOf(item.catalogId);
  const placement = placementOf(kind);
  const ctx: PointContext = { item, entry, kind, placement };

  let profile: ProfileId = PROFILE_BY_PLACEMENT[placement];
  let layouts: PointLayout[] = [PLACEMENT_VALUES[placement] ?? {}];
  for (const rule of rules) {
    const r = rule(ctx);
    if (!r) continue;
    if (r.profile) {
      profile = r.profile;
      layouts = [];
    }
    if (r.layout) layouts.push(r.layout);
  }
  if (entry?.points) layouts.push(entry.points);

  const out = {} as Record<Trade, PointDefault>;
  for (const tr of TRADES) {
    const d: PointDefault = { ...PROFILES[profile][tr], ...BASE_VALUES[tr] };
    for (const l of layouts) {
      // A key written as undefined leaves the earlier value, as a key left out does.
      for (const [k, v] of Object.entries(l[tr] ?? {})) if (v !== undefined) (d as unknown as Record<string, unknown>)[k] = v;
    }
    if (typeof d.dn === "function") d.dn = d.dn(item);
    out[tr] = d;
  }
  return out;
}

/** The position of an anchor along a length (mm from the start edge). */
export function alongPos(a: Along, length: number): number {
  return a.from === "start" ? a.mm : a.from === "end" ? length - a.mm : length / 2 + a.mm;
}

/** The height of an anchor above the finished floor (mm). */
export function heightPos(h: Height, item: Pick<Item, "elevation" | "height">): number {
  return h.from === "floor" ? h.mm : h.from === "bottom" ? item.elevation + h.mm : item.elevation + item.height + h.mm;
}
