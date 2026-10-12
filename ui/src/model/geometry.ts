// Plan geometry: footprints, walls, snapping and overlap tests. Pure functions over the model.

import type { Item, Opening, Room, Vec2 } from "./types";

export const EPS = 1e-6;

/**
 * Largest length the app accepts for a size or distance (mm, 100 m): far beyond any kitchen,
 * small enough that a typo or a damaged file cannot produce drawings that are unusable.
 */
export const MAX_LENGTH = 100_000;

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const rad = (deg: number) => (deg * Math.PI) / 180;

/** An angle in degrees brought into [0, 360). */
export function normalizeAngle(deg: number): number {
  const r = deg % 360;
  const n = r < 0 ? r + 360 : r;
  // -0 and 360 from rounding both mean 0.
  return Math.abs(n - 360) < EPS || Math.abs(n) < EPS ? 0 : n;
}

/** The smaller angle between two directions, 0 to 180 degrees. */
export function angleDiff(a: number, b: number): number {
  const d = normalizeAngle(a - b);
  return d > 180 ? 360 - d : d;
}

/** The front direction of an item (unit vector), south at rotation 0. */
export function frontOf(rotation: number): Vec2 {
  const a = rad(rotation);
  return { x: -Math.sin(a), y: Math.cos(a) };
}

/** The width direction of an item (unit vector, left to right seen from the plan at rotation 0). */
export function sideOf(rotation: number): Vec2 {
  const a = rad(rotation);
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** A point given in an item's own frame (x along the width, y towards the front) in plan coordinates. */
export function toPlan(item: Pick<Item, "x" | "y" | "rotation">, local: Vec2): Vec2 {
  const a = rad(item.rotation);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: item.x + local.x * c - local.y * s, y: item.y + local.x * s + local.y * c };
}

/** The four corners of an item's footprint: back left, back right, front right, front left. */
export function footprint(item: Pick<Item, "x" | "y" | "rotation" | "width" | "depth">): Vec2[] {
  const w = item.width / 2;
  const d = item.depth / 2;
  return [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ].map((p) => toPlan(item, p));
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(points: readonly Vec2[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Signed area of a polygon: positive when its corners run clockwise on screen (y down). */
export function signedArea(points: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    a += cross(points[i], points[(i + 1) % points.length]);
  }
  return a / 2;
}

export function area(points: readonly Vec2[]): number {
  return Math.abs(signedArea(points));
}

export interface Wall {
  index: number;
  a: Vec2;
  b: Vec2;
  /** Unit direction from a to b. */
  dir: Vec2;
  /** Unit normal pointing into the room. */
  inward: Vec2;
  length: number;
}

/** The walls of a room with their inward normals, whatever the direction of its corners. */
export function walls(room: Pick<Room, "points">): Wall[] {
  const pts = room.points;
  const cw = signedArea(pts) > 0;
  return pts.map((a, index) => {
    const b = pts[(index + 1) % pts.length];
    const dir = norm(sub(b, a));
    // Clockwise on screen (y down): the inside is to the right of the direction of travel.
    const inward = cw ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
    return { index, a, b, dir, inward, length: dist(a, b) };
  });
}

/** Is the point inside the polygon (even-odd rule)? Points on the edge count as inside. */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (distToSegment(p, a, b) < 0.5) return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < EPS ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, scale(ab, t)));
}

/** Do two convex polygons overlap with an area (touching edges do not count)? */
export function convexOverlap(p: readonly Vec2[], q: readonly Vec2[], tolerance = 0.5): boolean {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const e = sub(poly[(i + 1) % poly.length], poly[i]);
      const axis = norm({ x: -e.y, y: e.x });
      const [pMin, pMax] = project(p, axis);
      const [qMin, qMax] = project(q, axis);
      if (pMax - tolerance <= qMin || qMax - tolerance <= pMin) return false;
    }
  }
  return true;
}

function project(poly: readonly Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of poly) {
    const d = dot(v, axis);
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return [min, max];
}

/** The two end points of an opening on its wall, or null when the wall does not exist. */
export function openingSpan(room: Pick<Room, "points">, o: Pick<Opening, "wall" | "offset" | "width">): [Vec2, Vec2] | null {
  const w = walls(room)[o.wall];
  if (!w) return null;
  const start = add(w.a, scale(w.dir, o.offset - o.width / 2));
  const end = add(w.a, scale(w.dir, o.offset + o.width / 2));
  return [start, end];
}

/** Keeps an opening inside its wall: the offset is clamped so the whole width fits. */
export function clampOpening(room: Pick<Room, "points">, o: Opening): Opening {
  const w = walls(room)[o.wall];
  if (!w) return o;
  const width = Math.min(o.width, w.length);
  const offset = Math.min(Math.max(o.offset, width / 2), w.length - width / 2);
  return { ...o, width, offset };
}

/** Rounds to a grid step; a step of 0 or less leaves the value as it is. */
export function snapValue(v: number, step: number): number {
  return step > 0 ? Math.round(v / step) * step : v;
}

/** How close (mm) an item's back has to come to a wall to be pulled against it. */
export const WALL_SNAP_DISTANCE = 150;
/** How close (mm) two parallel item edges have to come to be aligned. */
export const EDGE_SNAP_DISTANCE = 60;

export interface SnapResult {
  x: number;
  y: number;
  rotation: number;
  /** The wall the item was placed against, if any. */
  wall: number | null;
}

/**
 * Where a dragged item lands: its back against the nearest wall when it comes close (turned to
 * face into the room), its sides flush with neighbouring items, otherwise on the grid.
 *
 * `autoRotate` turns the item towards the room when it is pulled against a wall; it is off for
 * a plain move of an item that already stands somewhere, so its rotation is kept unless the
 * wall it is pulled to faces the same way anyway.
 */
export function snapItem(
  item: Pick<Item, "x" | "y" | "rotation" | "width" | "depth">,
  room: Pick<Room, "points">,
  others: readonly Pick<Item, "x" | "y" | "rotation" | "width" | "depth">[],
  grid: number,
  autoRotate: boolean,
): SnapResult {
  let x = snapValue(item.x, grid);
  let y = snapValue(item.y, grid);
  let rotation = item.rotation;
  let wallIndex: number | null = null;

  // The wall nearest to the item's back (or to its centre when it may turn).
  let best: { wall: Wall; gap: number; rotation: number } | null = null;
  for (const wall of walls(room)) {
    // A zero-length wall (two corners on the same spot) has no direction and no inward normal:
    // its gap would be 0 wherever the item is, so it would always win and pull the item onto
    // that corner.
    if (wall.length < EPS) continue;
    const rot = normalizeAngle((Math.atan2(-wall.inward.x, wall.inward.y) * 180) / Math.PI);
    if (!autoRotate && angleDiff(rot, item.rotation) > 1) continue;
    const back = sub({ x: item.x, y: item.y }, scale(wall.inward, item.depth / 2));
    const gap = dot(sub(back, wall.a), wall.inward);
    const along = dot(sub({ x: item.x, y: item.y }, wall.a), wall.dir);
    if (along < -item.width / 2 || along > wall.length + item.width / 2) continue;
    if (Math.abs(gap) > WALL_SNAP_DISTANCE) continue;
    if (!best || Math.abs(gap) < Math.abs(best.gap)) best = { wall, gap, rotation: rot };
  }

  if (best) {
    const { wall } = best;
    rotation = best.rotation;
    wallIndex = wall.index;
    // Along the wall: on the grid, and inside the wall's length when the item fits.
    let along = snapValue(dot(sub({ x: item.x, y: item.y }, wall.a), wall.dir), grid);
    if (item.width <= wall.length) along = Math.min(Math.max(along, item.width / 2), wall.length - item.width / 2);
    const centre = add(add(wall.a, scale(wall.dir, along)), scale(wall.inward, item.depth / 2));
    x = centre.x;
    y = centre.y;
  }

  // Flush with a neighbour: the nearest parallel side edge within reach.
  const moved = { ...item, x, y, rotation };
  const side = sideOf(rotation);
  let shift: number | null = null;
  for (const other of others) {
    // Only items turned by a multiple of 90 degrees against this one have edges parallel to its sides.
    const off = angleDiff(other.rotation, rotation) % 90;
    if (Math.min(off, 90 - off) > 0.1) continue;
    const ofp = footprint(other);
    const [oMin, oMax] = project(ofp, side);
    const [mMin, mMax] = project(footprint(moved), side);
    // Only neighbours that sit in the same row (overlap across the item's depth).
    const front = frontOf(rotation);
    const [ofMin, ofMax] = project(ofp, front);
    const [mfMin, mfMax] = project(footprint(moved), front);
    if (ofMax <= mfMin + 1 || mfMax <= ofMin + 1) continue;
    for (const d of [oMax - mMin, oMin - mMax]) {
      if (Math.abs(d) <= EDGE_SNAP_DISTANCE && (shift === null || Math.abs(d) < Math.abs(shift))) shift = d;
    }
  }
  if (shift !== null) {
    x += side.x * shift;
    y += side.y * shift;
  }

  return { x: round(x), y: round(y), rotation: normalizeAngle(rotation), wall: wallIndex };
}

/** Rounds to a tenth of a millimetre: keeps files and dimensions free of float noise. */
export function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** A rectangular room of the given inner size, corner at the origin. */
export function rectRoom(width: number, depth: number): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth },
    { x: 0, y: depth },
  ];
}

/** An L-shaped room: the full width along the north wall, the cut-out in the south-east corner. */
export function lRoom(width: number, depth: number, cutWidth: number, cutDepth: number): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth - cutDepth },
    { x: width - cutWidth, y: depth - cutDepth },
    { x: width - cutWidth, y: depth },
    { x: 0, y: depth },
  ];
}
