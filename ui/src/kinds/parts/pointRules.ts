// The catalog's rules for connection points, on top of the profile by placement
// (`parts/points.ts` applies them in the order of `POINT_RULES`): a profile by category or group,
// a profile and a layout by kind, the values a data sheet gives (greasy drains, nominal sizes,
// plugs), and last the few layouts of single entries. `SOFT_WATER_KINDS` switches softened water
// on for new items (`withConnectionRules` in registry.ts).
//
// The places follow the installation drawings of the usual makers where these agree (water and
// electric behind the unit, a tilting unit's floor drain in front of it, a conveyor dishwasher's
// tanks at its inlet and its fresh water at its outlet). All values are typical: the planner checks
// them against the data sheet of the unit actually bought. Values marked "unsure" are own
// estimates without a common source.
//
// This module imports nothing at run time (types only): registry.ts and parts/points.ts both
// import it, and it must be complete before either of them runs.

import type { Item, Plug, Trade } from "../../model/types";
import type { CatalogEntry, CategoryId, GroupId } from "../types";
import type { Along, Edge, Height, PointContext, PointLayout, PointRule, PointRuleResult, ProfileId } from "./points";

// Shorthands for the layouts below (the same as in parts/points.ts).
const L = (mm: number): Along => ({ from: "start", mm });
const C = (mm = 0): Along => ({ from: "centre", mm });
const R = (mm: number): Along => ({ from: "end", mm });
const BACK = (mm: number): Along => ({ from: "start", mm });
const floor = (mm: number): Height => ({ from: "floor", mm });
const bottom = (mm: number): Height => ({ from: "bottom", mm });
const top = (mm: number): Height => ({ from: "top", mm });

/** How far hot and cold water sit left and right of a bowl's centre (mm). */
const WATER_SPREAD = 100;

/**
 * Water and drain under a bowl whose centre lies `mm` from the edge `from` (from the centre:
 * `mm` to the right). Hot on the left, cold on the right, softened water and the drain under the
 * centre.
 */
function underBowl(from: Edge, mm: number): PointLayout {
  // `dx` to the right, seen from the front.
  const along = (dx: number): Along => (from === "end" ? { from, mm: mm - dx } : { from, mm: mm + dx });
  return {
    hotWater: { x: along(-WATER_SPREAD) },
    coldWater: { x: along(WATER_SPREAD) },
    softWater: { x: along(0) },
    drain: { x: along(0) },
  };
}

// ---- 1. By category or group ----

/** Floor units of these groups use the group's profile instead of `back`. */
const PROFILE_BY_GROUP: Readonly<Partial<Record<GroupId, ProfileId>>> = {
  line900: "line",
  line700: "line",
  // Ovens on stands, cook-and-hold cabinets, fridges and blast chillers.
  ovens: "tall",
  coolCabinets: "tall",
  blastChillers: "tall",
  sinks: "sink",
  // Inlet, sorting and outlet tables have a basin with the pre-rinse shower.
  dishLine: "sink",
  dishMachines: "dish",
};

/**
 * The profile by category or group. Overhead units outside ventilation hang on a wall (wash
 * basins, salamanders, water heaters, heat lamps on a bridge): their connections come out of the
 * wall just above or below them, not out of the ceiling as a hood's.
 */
function byGroup({ entry, placement }: PointContext): PointRuleResult | undefined {
  if (!entry) return undefined;
  if (placement === "overhead") return entry.category === "ventilation" ? undefined : { profile: "wallHung" };
  if (placement !== "floor" || !entry.group) return undefined;
  const profile = PROFILE_BY_GROUP[entry.group];
  return profile ? { profile } : undefined;
}

// ---- 2. By kind ----

/** Kinds whose profile differs from their placement's and their group's. */
export const PROFILE_BY_KIND: Readonly<Record<string, ProfileId>> = {
  // Tilting pans and kettles: the filling tap's water high up, the floor drain in front.
  kettle: "tilt",
  kettleIndirect: "tilt",
  kettleMixer: "tilt",
  tiltingPan: "tilt",
  pressurePan: "tilt",
  multiCooker: "tilt",
  brattPan: "tilt",
  // Hung on the wall (the overhead rule says so too; named for the case the placement changes).
  handwash: "wallHung",
  handwashKnee: "wallHung",
  handwashStation: "wallHung",
  waterHeater: "wallHung",
  // Tall units outside the tall groups.
  combiOven: "tall",
  steamer: "tall",
  smoker: "tall",
  proofer: "tall",
  iceMachine: "tall",
  iceDispenser: "tall",
  bottleCooler: "tall",
  multideck: "tall",
  slidingDoorCooler: "tall",
  // Bowls outside the sink group.
  handwashPedal: "sink",
  tableSink: "sink",
  tableHandwash: "sink",
  cocktailStation: "sink",
  // Hangs from the ceiling over the pass: its cable comes from above.
  heatLampPendant: "overhead",
};

/**
 * Conveyor dishwashers (racks and belts run from left to right): the tanks and their drain at
 * the inlet, the fresh water of the final rinse and the exhaust stub at the outlet, the supply
 * from above to the control cabinet on the top (unsure: some machines take it at the bottom).
 */
const CONVEYOR: PointLayout = {
  electric: { x: R(150), y: BACK(50), z: top(0) },
  hotWater: { x: R(500) },
  softWater: { x: R(400) },
  coldWater: { x: R(300) },
  drain: { x: L(400), z: floor(100) },
  exhaust: { x: R(300) },
};

/** Wash basins: angle valves and the trap at the usual heights under a basin (mm above floor). */
const BASIN: PointLayout = {
  hotWater: { z: floor(550) },
  coldWater: { z: floor(550) },
  softWater: { z: floor(550) },
  drain: { z: floor(500) },
};

/** Taps on the wall above a sink or a cleaning point: the wall connection behind the mixer. */
const wallTap = (mm: number): PointLayout => ({ hotWater: { z: bottom(mm) }, coldWater: { z: bottom(mm) }, softWater: { z: bottom(mm) } });

/** Cold rooms take their supply over the ceiling panels, where the evaporator and its control sit. */
const COLD_ROOM: PointLayout = { electric: { z: top(0) }, refrigeration: { z: top(0) } };

/** Supply air outlets: the duct reaches the centre of the outlet from above. */
const SUPPLY_OUTLET: PointLayout = { supply: { x: C() } };

/** Places by kind, on top of the profile. */
export const LAYOUT_BY_KIND: Readonly<Record<string, PointLayout>> = {
  // Bowls at the right end (1200 mm: one 500 mm bowl 50 mm in from the end) or at the left.
  sink: underBowl("end", 300),
  sinkThree: underBowl("end", 300),
  sinkDrainerRight: underBowl("start", 300),
  sinkCentre: underBowl("centre", 0),
  potSink: underBowl("end", 400),
  // The corner bowl sits in the back corner, behind the upstand.
  cornerSinkLeft: underBowl("start", 330),
  cornerSinkRight: underBowl("end", 330),
  tableSink: underBowl("end", 300),
  tableHandwash: underBowl("start", 240),
  cocktailStation: underBowl("start", 200),
  // The basin with the pre-rinse shower lies at the end away from the machine.
  dishInletTable: underBowl("start", 300),
  dishInletTableLeft: underBowl("end", 300),
  sortingTable: underBowl("start", 650),
  sortingTableLeft: underBowl("end", 650),
  rackConveyor: CONVEYOR,
  rackConveyorDryer: CONVEYOR,
  flightDishwasher: CONVEYOR,
  trayWasher: CONVEYOR,
  handwash: BASIN,
  handwashKnee: BASIN,
  handwashStation: BASIN,
  preRinseUnit: wallTap(200),
  cleaningStation: wallTap(100),
  // The connection box itself: angle valves inside it, the drain socket at its bottom.
  waterConnection: {
    hotWater: { x: C(-75), z: bottom(100) },
    coldWater: { x: C(75), z: bottom(100) },
    softWater: { x: C(), z: bottom(100) },
    drain: { x: C(), z: bottom(0) },
  },
  coldRoom: COLD_ROOM,
  coldRoomGlass: COLD_ROOM,
  freezerRoom: COLD_ROOM,
  swirlDiffuser: SUPPLY_OUTLET,
  displacementOutlet: SUPPLY_OUTLET,
  // The fan in the base blows out through the louvre at the bottom (into a floor duct).
  downdraft: { exhaust: { x: C(), y: BACK(50), z: floor(100) } },
};

/** Kinds whose air leaves below their top (the contract test allows them). */
export const AIR_BELOW: ReadonlySet<string> = new Set(["downdraft"]);

function byKind({ kind }: PointContext): PointRuleResult | undefined {
  const profile = PROFILE_BY_KIND[kind];
  const layout = LAYOUT_BY_KIND[kind];
  if (!profile && !layout) return undefined;
  return { ...(profile ? { profile } : {}), ...(layout ? { layout } : {}) };
}

// ---- 3. Values ----

/**
 * Kinds that need softened water besides cold water: their steam generators and boilers scale
 * up otherwise (combi ovens, steamers, coffee machines and boilers). New items of these kinds
 * get `softWater` (`withConnectionRules`); items already placed keep what they have.
 */
export const SOFT_WATER_KINDS: ReadonlySet<string> = new Set(["combiOven", "steamer", "steamerTable", "espressoMachine", "filterCoffee", "hotWaterDispenser"]);

/**
 * Drains that carry greasy water to the grease separator (DIN EN 1825): cooking units, dish
 * machines and dish tables, sinks, bain-maries of serving counters and the kitchen's floor
 * drains. Wash basins, ice machines, condensate and the separator's own outlet carry none.
 */
export const GREASY_DRAIN: {
  readonly categories: ReadonlySet<CategoryId>;
  readonly groups: ReadonlySet<GroupId>;
  readonly kinds: ReadonlySet<string>;
  /** Exceptions in those categories and groups. */
  readonly notKinds: ReadonlySet<string>;
} = {
  categories: new Set<CategoryId>(["cooking"]),
  groups: new Set<GroupId>(["sinks", "dishMachines", "dishLine"]),
  kinds: new Set(["tableSink", "foodCounter", "buffetHot", "floorDrain", "drainChannel", "floorGully", "floorGullyBucket"]),
  // Starch and soil, no fat (a peeler's water goes to a starch separator).
  notKinds: new Set(["vegetableWasher", "bootWasher"]),
};

/** Does the drain of this unit carry greasy water? */
export function greasyDrain(entry: Pick<CatalogEntry, "kind" | "category" | "group"> | undefined): boolean {
  if (!entry || GREASY_DRAIN.notKinds.has(entry.kind)) return false;
  return GREASY_DRAIN.kinds.has(entry.kind) || GREASY_DRAIN.categories.has(entry.category) || (entry.group !== undefined && GREASY_DRAIN.groups.has(entry.group));
}

/** A nominal size, fixed or by the unit (its width, its depth). */
export type DnRule = number | ((item: Item) => number);

/** Water of a tilting unit or a conveyor dishwasher fills a lot at once: DN 20. */
const WATER_20: Partial<Record<Trade, DnRule>> = { coldWater: 20, hotWater: 20, softWater: 20 };
/** Hand wash basins drain through DN 40. */
const BASIN_DRAIN: Partial<Record<Trade, DnRule>> = { drain: 40 };

/** Nominal sizes by category, before those by kind: condensate of cooling units drains through DN 40. */
const DN_BY_CATEGORY: Readonly<Partial<Record<CategoryId, Partial<Record<Trade, DnRule>>>>> = {
  cooling: { drain: 40 },
};

/**
 * Nominal sizes by kind (water DN 15, drain DN 50 and floor drain DN 100 are the base of every
 * unit; gas pipes and ducts are sized by their load unless named here).
 */
export const DN_BY_KIND: Readonly<Record<string, Partial<Record<Trade, DnRule>>>> = {
  kettle: WATER_20,
  kettleIndirect: WATER_20,
  kettleMixer: WATER_20,
  tiltingPan: WATER_20,
  pressurePan: WATER_20,
  multiCooker: WATER_20,
  brattPan: WATER_20,
  rackConveyor: WATER_20,
  rackConveyorDryer: WATER_20,
  trayWasher: WATER_20,
  // A long flight machine rinses with more water (unsure: from 6 m on DN 25) and drains DN 70.
  flightDishwasher: { ...WATER_20, hotWater: (it) => (it.width > 6000 ? 25 : 20), drain: 70 },
  // Pot washers fill their large tank quickly (unsure for the water).
  potWasher: { ...WATER_20, drain: 70 },
  granulateWasher: { ...WATER_20, drain: 70 },
  handwash: BASIN_DRAIN,
  handwashKnee: BASIN_DRAIN,
  handwashStation: BASIN_DRAIN,
  handwashPedal: BASIN_DRAIN,
  tableHandwash: BASIN_DRAIN,
  eyeWashStation: BASIN_DRAIN,
  // Small drains: the drip tray of a coffee machine, the condensate of hoods and serving units.
  espressoMachine: { drain: 40 },
  condensingHood: { drain: 40 },
  dishHood: { drain: 40 },
  coldCounter: { drain: 40 },
  saladBar: { drain: 40 },
  buffetCold: { drain: 40 },
  // The regeneration water of a softener; a central softener is fed through DN 20 (unsure).
  waterSoftener: { coldWater: 20, drain: 40 },
  // Floor drains and channels: DN 100; a 300 mm channel and a bucket gully DN 125 (unsure), a
  // small gully DN 70.
  floorDrain: { drain: 100 },
  drainChannel: { drain: (it) => (it.depth >= 300 ? 125 : 100) },
  floorGully: { drain: 70 },
  floorGullyBucket: { drain: 100 },
  // Outlets to the sewer behind a separator or pump (unsure for the compact trap).
  greaseSeparator: { drain: 100 },
  greaseTrapCompact: { drain: 70 },
  liftingStation: { drain: 100 },
};

/**
 * Plugs by kind, set outright after the plug by category. Cold rooms and their doors' heaters,
 * the roll-in blast chiller and the remote condensing unit are wired by the electrician; small
 * units with a plug in the box keep their Schuko or CEE socket.
 */
export const PLUG_BY_KIND: Readonly<Record<string, Plug>> = {
  coldRoom: "fixed",
  coldRoomGlass: "fixed",
  freezerRoom: "fixed",
  freezerRoomDoor: "fixed",
  blastChillerRollIn: "fixed",
  condensingUnit: "fixed",
  heatLampPendant: "fixed",
  heatLamp: "schuko",
  hatchWarmer: "schuko",
  waterSoftener: "schuko",
  dosingStation: "schuko",
  cutleryPolisher: "schuko",
};

/**
 * Categories whose units come with a plug (`fitPlug` grows a Schuko to a CEE socket on three
 * phases or with the load, and makes it a fixed connection above 32 A). Table-top units ask for
 * Schuko by their placement already.
 */
const PLUG_CATEGORIES: ReadonlySet<CategoryId> = new Set<CategoryId>(["cooling", "serving", "prep"]);

function values({ entry, kind }: PointContext): PointRuleResult | undefined {
  if (!entry) return undefined;
  const layout: Record<string, Record<string, unknown>> = {};
  const set = (trade: Trade, key: string, value: unknown) => {
    (layout[trade] ??= {})[key] = value;
  };
  const plug = PLUG_BY_KIND[kind] ?? (PLUG_CATEGORIES.has(entry.category) ? "schuko" : undefined);
  if (plug) set("electric", "plug", plug);
  if (greasyDrain(entry)) {
    set("drain", "greasy", true);
    set("floorDrain", "greasy", true);
  }
  for (const sizes of [DN_BY_CATEGORY[entry.category], DN_BY_KIND[kind]]) {
    for (const [trade, dn] of Object.entries(sizes ?? {})) set(trade as Trade, "dn", dn);
  }
  return { layout: layout as PointLayout };
}

// ---- 4. By entry ----

/** The few entries that differ from their kind. */
export const LAYOUT_BY_ENTRY: Readonly<Record<string, PointLayout>> = {
  // Glass washers on 230 V come with a Schuko plug; the 400 V dishwasher of the same kind is wired.
  glasswasher: { electric: { plug: "schuko" } },
  "glasswasher-pump": { electric: { plug: "schuko" } },
};

function byEntry({ entry }: PointContext): PointRuleResult | undefined {
  const layout = entry && LAYOUT_BY_ENTRY[entry.id];
  return layout ? { layout } : undefined;
}

/** The catalog's rules in the order they apply; `parts/points.ts` registers them first. */
export const POINT_RULES: readonly PointRule[] = [byGroup, byKind, values, byEntry];
