// The plan of one kitchen. All lengths are millimetres, angles degrees.
//
// Coordinates: the plan's x axis points right (east), y points down (south), as on screen.
// An item stands at its centre (x, y); at rotation 0 its back faces north and its front faces
// south (+y). Positive rotation turns clockwise on the plan.

export interface Vec2 {
  x: number;
  y: number;
}

export type OpeningKind = "door" | "window" | "passage";

/** A door, window or passage in one wall of the room. */
export interface Opening {
  id: string;
  kind: OpeningKind;
  /** Index of the wall: the segment from room point `wall` to the next point. */
  wall: number;
  /** Distance from the wall's start point to the opening's centre. */
  offset: number;
  width: number;
  height: number;
  /** Height of the lower edge above the floor (0 for doors and passages). */
  sill: number;
}

export interface Room {
  /** Inner outline of the room, the corners in order (either direction). */
  points: Vec2[];
  height: number;
  wallThickness: number;
  openings: Opening[];
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
}

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
  note?: string;
}

export interface ProjectInfo {
  name: string;
  client: string;
  author: string;
  /** Date of the drawing, ISO "YYYY-MM-DD". */
  date: string;
}

export interface Project {
  /** File format id and version (`serialize.ts`). */
  format: "kitchenplaner";
  version: number;
  info: ProjectInfo;
  room: Room;
  items: Item[];
}

/** The four elevation directions: the wall the viewer looks at from inside the room. */
export type Facing = "north" | "east" | "south" | "west";
export const FACINGS: readonly Facing[] = ["north", "east", "south", "west"];

export type ViewId = "plan" | "3d" | `elevation-${Facing}`;
