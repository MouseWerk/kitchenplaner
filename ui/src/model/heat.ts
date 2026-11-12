// The heat a unit gives off into the kitchen, sensible (warms the air) and latent (vapour), as
// the equipment list shows it and the hood airflow check (`pointChecks.ts`) adds it up under each
// hood. The planner's values (`Item.heat`) replace the estimate.
//
// The estimate is a share of the connected load (electric plus gas kW) by a heat class per kind.
// UNSURE: the shares are our own typical values for planning, not copied from the VDI 2052 tables;
// a ventilation planner sets the real values (docs/design/connections-0.3.md, 1.5).

import { catalogEntry, kindOf } from "../kinds/registry";
import type { Item } from "./types";

/**
 * How a unit turns its connected load into heat in the room:
 * - `dry`: ranges, griddles, grills, ovens: mostly warm air, little vapour;
 * - `wet`: kettles, pans, pasta cookers, water baths, steamers, combi ovens: much vapour;
 * - `frying`: fryers and woks: hot air and fat vapour;
 * - `dish`: dish machines: mostly vapour, the rest leaves with the water;
 * - `cooling`: units with their own refrigeration: the whole load ends as heat at the condenser;
 * - `small`: machines and warmers on tables and counters, serving and prep;
 * - `none`: building parts, ventilation (its heat leaves with the air), storage.
 */
export type HeatClass = "dry" | "wet" | "frying" | "dish" | "cooling" | "small" | "none";

/** Sensible and latent heat as shares of the connected load. UNSURE: own typical values. */
export const HEAT_SHARES: Readonly<Record<HeatClass, { sensible: number; latent: number }>> = {
  dry: { sensible: 0.45, latent: 0.05 },
  wet: { sensible: 0.25, latent: 0.35 },
  frying: { sensible: 0.4, latent: 0.15 },
  dish: { sensible: 0.1, latent: 0.3 },
  cooling: { sensible: 1, latent: 0 },
  small: { sensible: 0.5, latent: 0 },
  none: { sensible: 0, latent: 0 },
};

/**
 * A cooling unit on a remote refrigeration system (`refrigerationKw` set) gives off only what its
 * fans and heaters use: its condenser stands elsewhere. UNSURE: own value.
 */
export const REMOTE_COOLING_SENSIBLE = 0.2;

/** Cooking kinds that boil, steam or braise in liquid; the other cooking kinds are `dry`. */
export const WET_KINDS: ReadonlySet<string> = new Set([
  "pastaCooker",
  "bainMarie",
  "kettle",
  "kettleIndirect",
  "kettleMixer",
  "tiltingPan",
  "pressurePan",
  "multiPan",
  "multiCooker",
  "combiOven",
  "steamer",
  "steamerTable",
  "riceCooker",
  "eggBoiler",
  "sousVide",
]);

/** Cooking kinds that fry in fat or over a strong flame. */
export const FRYING_KINDS: ReadonlySet<string> = new Set(["fryer", "fryerSingle", "wok", "wokTable"]);

/** The class of each catalog area; cooking and washing are refined by kind and group. */
const CLASS_BY_CATEGORY: Readonly<Record<string, HeatClass>> = {
  cooking: "dry",
  cooling: "cooling",
  washing: "small",
  tables: "small",
  prep: "small",
  serving: "small",
  storage: "none",
  ventilation: "none",
  building: "none",
};

/** The heat class of a catalog id; unknown ids (a newer file) give off nothing by estimate. */
export function heatClassOf(catalogId: string): HeatClass {
  const entry = catalogEntry(catalogId);
  if (!entry) return "none";
  const kind = kindOf(catalogId);
  if (entry.category === "cooking") return WET_KINDS.has(kind) ? "wet" : FRYING_KINDS.has(kind) ? "frying" : "dry";
  if (entry.category === "washing" && entry.group === "dishMachines") return "dish";
  return CLASS_BY_CATEGORY[entry.category] ?? "none";
}

export interface ItemHeat {
  sensibleKw: number;
  latentKw: number;
  /** True when at least one of the values is the estimate (the planner set not both). */
  estimated: boolean;
}

/** kW to two decimals, as the connection values are given. */
const kw = (v: number) => Math.round(v * 100) / 100;

/** The estimated heat release of a unit (kW), from its class and connected load. */
export function estimateHeat(item: Pick<Item, "catalogId" | "connections">): { sensibleKw: number; latentKw: number } {
  const c = item.connections;
  const load = Math.max(0, c.electricKw ?? 0) + Math.max(0, c.gasKw ?? 0);
  const cls = heatClassOf(item.catalogId);
  const share = HEAT_SHARES[cls];
  const sensible = cls === "cooling" && (c.refrigerationKw ?? 0) > 0 ? REMOTE_COOLING_SENSIBLE : share.sensible;
  return { sensibleKw: kw(load * sensible), latentKw: kw(load * share.latent) };
}

/** The heat a unit gives off (kW): the planner's values where set, the estimate otherwise. */
export function itemHeat(item: Pick<Item, "catalogId" | "connections" | "heat">): ItemHeat {
  const set = item.heat ?? {};
  const est = set.sensibleKw !== undefined && set.latentKw !== undefined ? null : estimateHeat(item);
  return {
    sensibleKw: set.sensibleKw ?? est?.sensibleKw ?? 0,
    latentKw: set.latentKw ?? est?.latentKw ?? 0,
    estimated: est !== null,
  };
}
