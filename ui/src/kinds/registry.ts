// The catalog: every area's entries and kind definitions in one place. The plan, the elevations,
// 3D, the sidebar, the file reader and the plan check all look units up here.
//
// An area is added to `AREAS`; its entries keep the order they have in their area, and the
// areas keep this order, which is also the order of the catalog list.

import { WALL_SNAP_DISTANCE, WALL_TOUCH_DISTANCE } from "../model/geometry";
import type { Connections } from "../model/types";
import { building } from "./building";
import { cooking } from "./cooking";
import { cooling } from "./cooling";
import { prep } from "./prep";
import { worktable } from "./prep/worktable";
import { serving } from "./serving";
import { storage } from "./storage";
import type { Area, CatalogEntry, CategoryId, KindDef, Placement, Variant } from "./types";
import { ventilation } from "./ventilation";
import { washing } from "./washing";

export type { Area, CatalogEntry, CategoryId, Energy, KindDef, Placement, Variant } from "./types";

export const AREAS: readonly Area[] = [cooking, cooling, washing, prep, serving, storage, ventilation, building];

/** The sidebar groups in their order; groups without entries are not shown. */
export const CATEGORIES: readonly CategoryId[] = ["cooking", "cooling", "washing", "tables", "prep", "serving", "storage", "ventilation", "building"];

export const CATALOG: readonly CatalogEntry[] = AREAS.flatMap((a) => a.entries);

export const KINDS: readonly KindDef[] = AREAS.flatMap((a) => a.kinds);

const BY_ID = new Map(CATALOG.map((e) => [e.id, e]));
const BY_KIND = new Map(KINDS.map((k) => [k.kind, k]));

/** The kind that draws catalog ids and kinds this build does not know (a newer file). */
export const FALLBACK_KIND = worktable;

export function catalogEntry(id: string): CatalogEntry | undefined {
  return BY_ID.get(id);
}

/** The drawing kind of a catalog id; unknown ids (a newer file) draw as a plain table. */
export function kindOf(catalogId: string): string {
  return BY_ID.get(catalogId)?.kind ?? FALLBACK_KIND.kind;
}

/** The definition of a kind; an unknown kind draws as a plain table. */
export function kindDef(kind: string): KindDef {
  return BY_KIND.get(kind) ?? FALLBACK_KIND;
}

/** Where units of a kind stand (`floor` unless the kind says otherwise). */
export function placementOf(kind: string): Placement {
  return kindDef(kind).placement ?? "floor";
}

/**
 * Do units of these placements stand in each other's way? Only units of the same placement do
 * (a hood above a range, a slicer on a table are the normal case); flat ones (drains, platforms)
 * never do.
 */
export function collides(a: Placement, b: Placement): boolean {
  return a === b && a !== "flat";
}

/**
 * How close (mm) a unit's back has to come to a wall to be pulled against it: a table-top unit
 * only when it touches the wall (it lines up with the table's edges instead).
 */
export function wallSnapReach(kind: string): number {
  return placementOf(kind) === "tableTop" ? WALL_TOUCH_DISTANCE : WALL_SNAP_DISTANCE;
}

/** The default variant of an entry: its width and its first energy. */
export function defaultVariant(entry: CatalogEntry): Variant {
  return entry.energy ? { width: entry.width, energy: entry.energy[0] } : { width: entry.width };
}

/** Connection values of a variant of an entry (a fresh copy). */
export function variantConnections(entry: CatalogEntry, v: Variant): Connections {
  return { ...(entry.variantConnections ? entry.variantConnections(v) : entry.connections) };
}
