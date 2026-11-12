// How the elevations are named on screen, on sheets and in file names: a compass view by its
// direction („Ansicht Nord“), a wall view by the wall's number as the inspector counts it
// („Ansicht Wand 5“), and in the wall chooser with the side it stands on and its length.

import { elevationWallIndex, type ElevationId } from "./elevation";
import { walls } from "./geometry";
import type { Facing, Room, Vec2 } from "./types";
import { t, type Lang } from "../lib/i18n";

/** The eight compass points, clockwise from north. */
const COMPASS = ["north", "northEast", "east", "southEast", "south", "southWest", "west", "northWest"] as const;
export type CompassPoint = (typeof COMPASS)[number];

/** The compass point a plan direction points to most (x east, y south). */
export function compassPoint(d: Vec2): CompassPoint {
  // Clockwise from north: north is -y on the plan.
  const deg = (Math.atan2(d.x, -d.y) * 180) / Math.PI;
  return COMPASS[(Math.round(deg / 45) + 8) % 8];
}

/** „Nord“ or „Wand 5“: what the elevation looks at. */
export function elevationName(id: ElevationId, lang?: Lang): string {
  const i = elevationWallIndex(id);
  return i === null ? t(`facing.${id as Facing}`, undefined, lang) : t("view.wallName", { n: i + 1 }, lang);
}

/** „Ansicht Nord“, „Ansicht Wand 5“. */
export function elevationTitle(id: ElevationId, lang?: Lang): string {
  return t("view.elevation", { facing: elevationName(id, lang) }, lang);
}

/**
 * A wall as the chooser lists it: „Wand 5 (Nordost, 1414 mm)“. The side is where the wall stands
 * seen from the room, on eight compass points so a chamfer reads as one.
 */
export function wallEntryLabel(room: Pick<Room, "points">, index: number, lang?: Lang): string {
  const w = walls(room)[index];
  const side = compassPoint({ x: -w.inward.x, y: -w.inward.y });
  return t("view.wallEntry", { n: index + 1, side: t(`compass.${side}`, undefined, lang), length: Math.round(w.length) }, lang);
}
