// The equipment catalog: generic professional kitchen equipment in the usual module sizes
// (cooking lines in 700 and 900 mm depth, 850-900 mm working height, Gastronorm-based
// refrigeration). The values are typical starting points, not the data of a manufacturer;
// every placed item can be resized and its connection values edited.

import type { Connections } from "./types";
import type { TKey } from "../lib/i18n";

/** How an item is drawn in the plan, the elevations and 3D. */
export type ItemKind =
  | "worktable"
  | "cabinet"
  | "drawers"
  | "sink"
  | "handwash"
  | "range"
  | "induction"
  | "fryer"
  | "griddle"
  | "kettle"
  | "tiltingPan"
  | "combiOven"
  | "fridge"
  | "counterFridge"
  | "dishwasher"
  | "hood"
  | "wallShelf"
  | "shelving"
  | "coldRoom"
  | "column";

export type CategoryId = "cooking" | "cooling" | "washing" | "tables" | "storage" | "ventilation" | "building";

export const CATEGORIES: readonly CategoryId[] = ["cooking", "cooling", "washing", "tables", "storage", "ventilation", "building"];

export interface CatalogEntry {
  id: string;
  kind: ItemKind;
  category: CategoryId;
  name: TKey;
  width: number;
  depth: number;
  height: number;
  elevation: number;
  connections: Connections;
  /** Width steps offered in the properties panel (mm). */
  widths?: readonly number[];
}

/** Standard working height of tables and cooking lines (mm). */
export const WORK_HEIGHT = 900;
/** Usual lower edge of wall shelves above the floor (mm). */
const WALL_SHELF_ELEVATION = 1500;
/** Usual lower edge of a canopy hood above the floor (mm). */
const HOOD_ELEVATION = 2000;

const TABLE_WIDTHS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000] as const;

export const CATALOG: readonly CatalogEntry[] = [
  // Cooking
  { id: "range-4", kind: "range", category: "cooking", name: "cat.range4", width: 800, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: 15.6, voltage: 400 } },
  { id: "range-6", kind: "range", category: "cooking", name: "cat.range6", width: 1200, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: 22.4, voltage: 400 } },
  { id: "induction-4", kind: "induction", category: "cooking", name: "cat.induction4", width: 800, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: 20, voltage: 400 } },
  { id: "fryer-2", kind: "fryer", category: "cooking", name: "cat.fryer", width: 400, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: 15, voltage: 400 } },
  { id: "griddle", kind: "griddle", category: "cooking", name: "cat.griddle", width: 800, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: 10.8, voltage: 400 } },
  { id: "kettle-150", kind: "kettle", category: "cooking", name: "cat.kettle", width: 800, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: 18, voltage: 400, coldWater: true, hotWater: true, floorDrain: true } },
  { id: "tilting-pan", kind: "tiltingPan", category: "cooking", name: "cat.tiltingPan", width: 1200, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: { electricKw: 15, voltage: 400, coldWater: true, floorDrain: true } },
  { id: "combi-10", kind: "combiOven", category: "cooking", name: "cat.combi10", width: 850, depth: 850, height: 1050, elevation: 700, connections: { electricKw: 18.9, voltage: 400, coldWater: true, drain: true } },
  { id: "combi-20", kind: "combiOven", category: "cooking", name: "cat.combi20", width: 900, depth: 900, height: 1800, elevation: 0, connections: { electricKw: 37, voltage: 400, coldWater: true, drain: true } },
  // Cooling
  { id: "fridge-700", kind: "fridge", category: "cooling", name: "cat.fridge", width: 700, depth: 830, height: 2050, elevation: 0, connections: { electricKw: 0.4, voltage: 230 } },
  { id: "freezer-700", kind: "fridge", category: "cooling", name: "cat.freezer", width: 700, depth: 830, height: 2050, elevation: 0, connections: { electricKw: 0.7, voltage: 230 } },
  { id: "counter-fridge-3", kind: "counterFridge", category: "cooling", name: "cat.counterFridge", width: 1800, depth: 700, height: 850, elevation: 0, connections: { electricKw: 0.5, voltage: 230 }, widths: [1360, 1800, 2230] },
  { id: "cold-room", kind: "coldRoom", category: "cooling", name: "cat.coldRoom", width: 2400, depth: 2100, height: 2200, elevation: 0, connections: { electricKw: 1.5, voltage: 400 } },
  // Washing
  { id: "sink-1", kind: "sink", category: "washing", name: "cat.sink1", width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: { coldWater: true, hotWater: true, drain: true }, widths: TABLE_WIDTHS },
  { id: "sink-2", kind: "sink", category: "washing", name: "cat.sink2", width: 1600, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: { coldWater: true, hotWater: true, drain: true }, widths: TABLE_WIDTHS },
  { id: "handwash", kind: "handwash", category: "washing", name: "cat.handwash", width: 400, depth: 350, height: 300, elevation: 600, connections: { coldWater: true, hotWater: true, drain: true } },
  { id: "dishwasher-hood", kind: "dishwasher", category: "washing", name: "cat.dishwasherHood", width: 750, depth: 750, height: 1500, elevation: 0, connections: { electricKw: 9.9, voltage: 400, coldWater: true, drain: true } },
  // Tables
  { id: "table", kind: "worktable", category: "tables", name: "cat.table", width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-island", kind: "worktable", category: "tables", name: "cat.tableIsland", width: 1600, depth: 900, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-cabinet", kind: "cabinet", category: "tables", name: "cat.tableCabinet", width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "table-drawers", kind: "drawers", category: "tables", name: "cat.tableDrawers", width: 600, depth: 700, height: WORK_HEIGHT, elevation: 0, connections: {} },
  // Storage
  { id: "shelving", kind: "shelving", category: "storage", name: "cat.shelving", width: 1200, depth: 500, height: 1800, elevation: 0, connections: {}, widths: TABLE_WIDTHS },
  { id: "wall-shelf", kind: "wallShelf", category: "storage", name: "cat.wallShelf", width: 1200, depth: 350, height: 300, elevation: WALL_SHELF_ELEVATION, connections: {}, widths: TABLE_WIDTHS },
  // Ventilation
  { id: "hood-wall", kind: "hood", category: "ventilation", name: "cat.hoodWall", width: 2400, depth: 1100, height: 450, elevation: HOOD_ELEVATION, connections: { exhaustM3h: 2600, electricKw: 0.1, voltage: 230 } },
  { id: "hood-island", kind: "hood", category: "ventilation", name: "cat.hoodIsland", width: 2400, depth: 2000, height: 450, elevation: HOOD_ELEVATION, connections: { exhaustM3h: 4200, electricKw: 0.2, voltage: 230 } },
  // Building
  { id: "column", kind: "column", category: "building", name: "cat.column", width: 400, depth: 400, height: 3000, elevation: 0, connections: {} },
];

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

export function catalogEntry(id: string): CatalogEntry | undefined {
  return BY_ID.get(id);
}

/** The drawing kind of a catalog id; unknown ids (a newer file) draw as a plain table. */
export function kindOf(catalogId: string): ItemKind {
  return BY_ID.get(catalogId)?.kind ?? "worktable";
}

/**
 * Sink width from which the unit has two bowls. Two 500 mm bowls with their rims take about
 * 1150 mm; from 1400 mm a usable drainer is left beside them (catalog: 1200 mm = 1, 1600 mm = 2).
 * The plan, the elevations and 3D all count bowls with `sinkBowlCount`, so a resized sink shows
 * the same number of bowls in every view.
 */
const SINK_TWO_BOWLS_FROM = 1400;

/** Number of bowls of a sink unit of the given width (mm). */
export function sinkBowlCount(width: number): number {
  return width >= SINK_TWO_BOWLS_FROM ? 2 : 1;
}

/** Items that hang above the floor and do not block the floor area (hoods, wall shelves). */
export function isOverhead(kind: ItemKind): boolean {
  return kind === "hood" || kind === "wallShelf" || kind === "handwash";
}
