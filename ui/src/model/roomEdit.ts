// Editing the room outline: adding and moving corners, and keeping the openings on their walls
// while the walls change. Pure functions over the model; the plan view calls them.

import { area, clampOpening, dist, dot, sub, walls } from "./geometry";
import type { Opening, Room, Vec2 } from "./types";

/** Smallest distance (mm) of a new corner from the ends of the wall it splits. */
export const MIN_CORNER_GAP = 50;
/**
 * Corners closer than this (mm) count as one spot. A wall that short has no usable direction:
 * snapping, the wall drawing and the openings on it all need a real length.
 */
export const COINCIDENT_DISTANCE = 1;
/** Smallest floor area (mm², 100 × 100 mm) of a room; anything smaller is a degenerate outline. */
export const MIN_ROOM_AREA = 10_000;

/**
 * The room with a new corner at `at` splitting wall `index`, or null when `at` lies within one
 * grid step (at least MIN_CORNER_GAP) of either end of that wall: a corner there would make a
 * wall too short to grab or a zero-length one.
 *
 * Openings on later walls move one index on. Openings on the split wall stay on the first half
 * when their centre lies before the split, otherwise they move to the new second wall with the
 * offset counted from the new corner; one straddling the split is clamped into its half.
 */
export function insertCorner(room: Room, index: number, at: Vec2, grid: number): Room | null {
  const w = walls(room)[index];
  if (!w) return null;
  const gap = Math.max(grid, MIN_CORNER_GAP);
  if (dist(at, w.a) < gap || dist(at, w.b) < gap) return null;
  const along = dot(sub(at, w.a), w.dir);
  const points = [...room.points.slice(0, index + 1), at, ...room.points.slice(index + 1)];
  const moved = room.openings.map((o): Opening => {
    if (o.wall > index) return { ...o, wall: o.wall + 1 };
    if (o.wall === index && o.offset > along) return { ...o, wall: index + 1, offset: o.offset - along };
    return o;
  });
  const next = { ...room, points };
  const openings = moved.map((o) => (o.wall === index || o.wall === index + 1 ? clampOpening(next, o) : o));
  return { ...next, openings };
}

/**
 * The room with corner `index` moved to `to`. When `to` lands on a neighbouring corner the room
 * is returned unchanged: two consecutive corners on one spot would leave a zero-length wall.
 * The openings of both walls meeting at the corner are clamped to their new lengths.
 */
export function moveCorner(room: Room, index: number, to: Vec2): Room {
  const n = room.points.length;
  if (index < 0 || index >= n) return room;
  const prev = room.points[(index + n - 1) % n];
  const next = room.points[(index + 1) % n];
  if (dist(to, prev) < COINCIDENT_DISTANCE || dist(to, next) < COINCIDENT_DISTANCE) return room;
  const moved = { ...room, points: room.points.map((p, i) => (i === index ? to : p)) };
  const before = (index + n - 1) % n;
  return { ...moved, openings: room.openings.map((o) => (o.wall === index || o.wall === before ? clampOpening(moved, o) : o)) };
}

/**
 * The room without corners that lie on the previous one (also the last on the first), so every
 * wall has a length. Openings follow their wall to its new index and are clamped to it; those on
 * a wall that disappears (it had no length) are dropped.
 */
export function removeCoincidentCorners(room: Room): Room {
  const pts = room.points;
  const n = pts.length;
  // keep: indices of the kept corners; group[i]: the new index of the corner point i merged into.
  const keep: number[] = [];
  const group: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep.length === 0 || dist(pts[i], pts[keep[keep.length - 1]]) >= COINCIDENT_DISTANCE) keep.push(i);
    group.push(keep.length - 1);
  }
  // The outline is closed: trailing corners on the first one merge into it.
  while (keep.length > 1 && dist(pts[keep[keep.length - 1]], pts[keep[0]]) < COINCIDENT_DISTANCE) {
    const gone = keep.length - 1;
    keep.pop();
    for (let i = 0; i < n; i++) if (group[i] === gone) group[i] = 0;
  }
  if (keep.length === n) return room;
  const points = keep.map((i) => pts[i]);
  const next = { ...room, points };
  const openings: Opening[] = [];
  for (const o of room.openings) {
    const from = group[o.wall];
    const to = group[(o.wall + 1) % n];
    // A wall whose ends merged into one corner had no length.
    if (from === to) continue;
    openings.push(clampOpening(next, { ...o, wall: from }));
  }
  return { ...next, openings };
}

/** Does the outline enclose a floor: at least three corners and more than a sliver of area? */
export function isUsableOutline(points: readonly Vec2[]): boolean {
  return points.length >= 3 && area(points) >= MIN_ROOM_AREA;
}
