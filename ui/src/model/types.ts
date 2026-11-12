// The plan of one kitchen. All lengths are millimetres, angles degrees.
//
// Coordinates: the plan's x axis points right (east), y points down (south), as on screen.
// An item stands at its centre (x, y); at rotation 0 its back faces north and its front faces
// south (+y). Positive rotation turns clockwise on the plan.

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * A hatch is a pass-through window (Durchreiche, Speisenausgabe) with a sill at counter height; a
 * sliding door runs along the wall instead of swinging.
 */
export type OpeningKind = "door" | "slidingDoor" | "window" | "passage" | "hatch";

/** The side of a door's hinge, seen along its wall from the wall's start (a partition's `a`). */
export type DoorHinge = "start" | "end";
/** Which way a hinged door opens: into the room (or to the left of a partition) or out of it. */
export type DoorSwing = "in" | "out";

/** A door, window, passage or hatch in an outer wall of the room or in a partition. */
export interface Opening {
  id: string;
  kind: OpeningKind;
  /** Index of the outer wall: the segment from room point `wall` to the next point. Ignored when `partition` is set. */
  wall: number;
  /** The partition the opening sits in (its id); absent for openings in the outer walls. */
  partition?: string;
  /** Distance from the wall's start point (a partition's `a`) to the opening's centre. */
  offset: number;
  width: number;
  height: number;
  /** Height of the lower edge above the floor (0 for doors and passages). */
  sill: number;
  /**
   * Doors: hinge side (default "start"); for two leaves the side of the active leaf. A sliding
   * door slides open towards this side.
   */
  hinge?: DoorHinge;
  /** Doors: opening direction (default "in"); a sliding door runs on that face. Escape doors usually open out. */
  swing?: DoorSwing;
  /** Doors: one or two leaves (default 1). */
  leaves?: 1 | 2;
}

/**
 * A wall inside the room (Trennwand): a straight wall whose centre line runs from `a` to `b`,
 * `thickness` wide. Separates areas like the dish wash or a store from the kitchen.
 */
export interface Partition {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  /** Height of the wall; lower than the room for a half-height wall (Brüstung). */
  height: number;
}

export interface Room {
  /** Inner outline of the room, the corners in order (either direction). */
  points: Vec2[];
  height: number;
  wallThickness: number;
  openings: Opening[];
  partitions: Partition[];
}

/** Connection values of one appliance, as an installer needs them. */
export interface Connections {
  /** Electric power in kW. */
  electricKw?: number;
  /** Supply voltage in V (230 single phase, 400 three phase). */
  voltage?: number;
  /** Gas power in kW. */
  gasKw?: number;
  coldWater?: boolean;
  hotWater?: boolean;
  drain?: boolean;
  /** Floor drain or gully in front of the appliance (tilting pans, kettles). */
  floorDrain?: boolean;
  /** Exhaust air in m³/h (hoods). */
  exhaustM3h?: number;
  /** Softened water (combi ovens, steamers, coffee machines). */
  softWater?: boolean;
  /** Supply air in m³/h (hoods and ceilings with make-up air). */
  supplyM3h?: number;
  /** Steam from a central supply in kg/h. */
  steamKgH?: number;
  /** Cooling load on a remote refrigeration system in kW (the planner switches it on). */
  refrigerationKw?: number;
}

/**
 * Trades of connection points, in the order of lists, files, layers and the inspector
 * (`TRADES` in trades.ts). German codes in the comments.
 */
export type Trade =
  | "electric" // E  Elektro
  | "gas" // G  Gas
  | "coldWater" // KW Kaltwasser
  | "hotWater" // WW Warmwasser
  | "softWater" // EW enthärtetes Wasser
  | "drain" // AW Abwasser (Geräteablauf)
  | "floorDrain" // BA Bodenablauf
  | "exhaust" // AB Abluft
  | "supply" // ZU Zuluft
  | "steam" // D  Dampf
  | "refrigeration"; // K  Kälte (Verbund)

/** How an electric point is connected: hard-wired or a plug with its rating. */
export type Plug = "fixed" | "schuko" | "cee16" | "cee32" | "cee63";

/**
 * What the planner changed of one connection point; what is left out follows the catalog. Positions
 * are measured from the left and back edges, as data sheets give them, so they stay right when the
 * unit is resized.
 */
export interface PointOverride {
  /** Distance from the unit's left edge, seen from the front (mm). */
  x?: number;
  /** Distance from the unit's back edge (mm); more than the depth lies in front of the unit. */
  y?: number;
  /** Height above the finished floor („ü. FFB“, mm). */
  z?: number;
  currentA?: number;
  fuseA?: number;
  plug?: Plug;
  /** Nominal size: DN of a pipe, diameter of a duct (mm). */
  dn?: number;
  /** The drain carries greasy water (to the grease separator). */
  greasy?: boolean;
  note?: string;
}

/** The overrides of an item's connection points, one per trade at most. */
export type ItemPoints = Partial<Record<Trade, PointOverride>>;

/** Heat a unit gives off into the kitchen (kW); replaces the estimate of `model/heat.ts`. */
export interface HeatRelease {
  sensibleKw?: number;
  latentKw?: number;
}

/** How an appliance is heated, for units offered in an electric and a gas version. */
export type Energy = "electric" | "gas";
export const ENERGIES: readonly Energy[] = ["electric", "gas"];

export interface Item {
  id: string;
  /** The catalog entry it came from; its kind decides the drawing. */
  catalogId: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  /** Height of the lower edge above the floor (wall shelves, hoods, wall-mounted units). */
  elevation: number;
  connections: Connections;
  /** The energy variant of a unit offered in several (absent for all others). */
  energy?: Energy;
  /**
   * What the planner changed of the connection points; the points themselves are derived from
   * `connections` and the catalog (`model/points.ts`). Absent when nothing was changed.
   */
  points?: ItemPoints;
  /** The planner's heat release values; absent means the estimate. */
  heat?: HeatRelease;
  /**
   * The position number („Pos.“) in plans, elevations and lists. Stable: it stays when other
   * items are deleted or reordered, so plans already sent out keep their numbers. Unique, >= 1.
   */
  pos: number;
  /** The concrete product chosen for the position (all optional; typical values otherwise). */
  spec?: ItemSpec;
  note?: string;
}

/** A manufacturer's product for a position, as a planner specifies it for a quote. */
export interface ItemSpec {
  manufacturer?: string;
  /** Model or type designation. */
  model?: string;
  /** Article number of the manufacturer or dealer. */
  article?: string;
  /** Net unit price in euros. */
  price?: number;
}

export interface ProjectInfo {
  name: string;
  client: string;
  author: string;
  /** Date of the drawing, ISO "YYYY-MM-DD". */
  date: string;
  /** Plan number for the title block (e.g. „K-101“). */
  drawingNo?: string;
  /** Revision letter or number for the title block (e.g. „B“). */
  revision?: string;
}

/** Settings of a project that change how its totals are computed. */
export interface ProjectSettings {
  /**
   * Simultaneity (diversity) factor for the connected electric and gas load, 0.1 to 1: not all
   * appliances run at full power at the same time. The plain sum is shown too.
   */
  simultaneity: number;
}

export interface Project {
  /** File format id and version (`serialize.ts`). */
  format: "kitchenplaner";
  version: number;
  info: ProjectInfo;
  room: Room;
  items: Item[];
  settings: ProjectSettings;
}

/** The four elevation directions: the wall the viewer looks at from inside the room. */
export type Facing = "north" | "east" | "south" | "west";
export const FACINGS: readonly Facing[] = ["north", "east", "south", "west"];

export type ViewId = "plan" | "3d" | `elevation-${Facing}`;
