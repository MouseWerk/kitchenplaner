// What a unit of the catalog is made of: catalog entries (what the sidebar offers, with sizes and
// connection values) and kind definitions (how a kind of unit looks in the plan, the elevations
// and 3D). Each area of the catalog (kinds/<area>/) brings both; kinds/registry.ts ties them
// together. See kinds/README.md for how to add a unit.

import type { Connections, Energy, Item, Vec2 } from "../model/types";
import type { TKey } from "../lib/i18n";
import type { Front } from "./parts/elevation";
import type { Parts, Size } from "./parts/mesh";
import type { PlanSketch } from "./parts/plan";

/** The groups of the catalog sidebar, in their order there; each has a `category.<id>` text. */
export type CategoryId = "cooking" | "cooling" | "washing" | "tables" | "prep" | "serving" | "storage" | "ventilation" | "building";

export type { Energy } from "../model/types";

/**
 * Where a unit stands, which decides how the plan draws it, what it collides with in the plan
 * check and what it snaps to:
 * - `floor`: stands on the floor (the default). Solid with fill; collides with floor units and
 *   may block a door.
 * - `tableTop`: stands on a table or counter at its elevation (slicers, table mixers, scales).
 *   Solid with fill, drawn on top of the floor units; collides only with other table-top units;
 *   its back is pulled against a wall only when it touches it.
 * - `overhead`: hangs above (hoods, wall shelves, wall basins). Dashed without fill, drawn on
 *   top; collides only with other overhead units.
 * - `flat`: set into or lying on the floor (floor drains, drainage channels, platforms). Drawn
 *   in the plan without fill over the floor units, collides with nothing; equipment may stand
 *   on it.
 */
export type Placement = "floor" | "tableTop" | "overhead" | "flat";

/** One variant of an entry: a width step and an energy, as the user picks them. */
export interface Variant {
  width: number;
  energy?: Energy;
}

export interface CatalogEntry {
  /** Stable id, written into project files: never change or reuse one. */
  id: string;
  /** The kind that draws it (`KindDef.kind`). */
  kind: string;
  category: CategoryId;
  name: TKey;
  /** One sentence for the catalog preview. */
  description?: TKey;
  /** More words the catalog search finds it by (both languages, lower case). */
  tags?: readonly string[];
  /** Default size and lower edge above the floor (mm). */
  width: number;
  depth: number;
  height: number;
  elevation: number;
  /** Connection values of the default variant (the default width and the first energy). */
  connections: Connections;
  /** Width steps offered in the properties panel (mm); includes `width`. */
  widths?: readonly number[];
  /** Energy variants offered in the properties panel; the first is the default. */
  energy?: readonly Energy[];
  /**
   * Connection values of a variant; without it every variant has `connections`. Must give
   * `connections` for the default variant.
   */
  variantConnections?: (v: Variant) => Connections;
}

/**
 * How one kind of unit looks. All three views draw the item's own frame: x along the width
 * (centred), the front (operating side) towards +y in the plan and +z in 3D, the back against
 * the wall. Every view fills the box width × depth × height from the item's elevation, so the
 * views agree with each other and with the footprint the plan check uses.
 */
export interface KindDef {
  /** Unique id, referenced by `CatalogEntry.kind`. */
  kind: string;
  /** Where the unit stands (see `Placement`); `floor` when not given. */
  placement?: Placement;
  /** Part of the building (columns): drawn with the wall pen and fill instead of as equipment. */
  structural?: boolean;
  /**
   * The outline the plan draws and fills instead of the footprint rectangle, in the item's frame
   * (mm, x from -w/2 to w/2, y from the back -d/2 to the front d/2), such as the circle of a
   * round column. It must lie inside the footprint; the plan check keeps using the footprint.
   */
  planOutline?(w: number, d: number): Vec2[];
  /**
   * The plan symbol inside the footprint outline (which `planDrawing` draws): lines, circles and
   * door swings in the item's frame. Only door swings (arcs) and an open door leaf (the
   * `opening` pen) may reach out of the footprint, at the front.
   */
  plan(s: PlanSketch): void;
  /**
   * The front details when the item's front faces the viewer, on top of the body box (which
   * `elevationDrawing` draws from the elevation to the top).
   */
  elevation(f: Front): void;
  /** Details seen from the side or back; the default is the line under the top. */
  elevationSide?(f: Front): void;
  /**
   * Drawn below the body box whatever side faces the viewer: a stand under a unit with an
   * elevation (the only shapes allowed below `item.elevation`).
   */
  elevationBase?(f: Front): void;
  /**
   * The 3D model in metres, y up from the item's elevation (a stand may reach down to the floor
   * with negative y). Use `Parts` and the assemblies in parts/mesh.ts.
   */
  mesh(p: Parts, s: Size, item: Item): void;
  /**
   * How far parts may rise above the item's height (mm) in the elevation and 3D, such as a tap
   * over a sink. Everything else stays within the box; the contract test checks it.
   */
  rise?: number;
}

/** One area of the catalog (a folder in kinds/): its entries and the kinds that draw them. */
export interface Area {
  entries: readonly CatalogEntry[];
  kinds: readonly KindDef[];
}
