// Partitions (Trennwände): straight walls inside the room, and the walls that host openings
// (outer walls and partitions) seen through one interface. Pure functions over the model.
//
// A partition's frame: `dir` runs from `a` to `b`; `left` is the unit normal to the left of
// a→b on screen (y down), so for a partition running east `left` points north. Its long faces
// lie `thickness / 2` to either side of the centre line. Openings in a partition measure their
// `offset` from `a` along a→b; a door in a partition opening "in" swings to the left, "out" to
// the right (`doors.ts`).

import { add, cross, dist, dot, EPS, norm, scale, sub, walls } from "./geometry";
import type { Opening, Partition, Room, Vec2 } from "./types";

/** Thinnest and thickest partition the app accepts (mm): a 20 mm glass pane to a 1 m wall. */
export const MIN_PARTITION_THICKNESS = 20;
export const MAX_PARTITION_THICKNESS = 1000;

/** How far (mm) a partition end may stop short of a wall or another partition and still join it. */
export const JOIN_TOLERANCE = 1;
/** A joint that would reach further than this many thicknesses past the end is too acute to miter. */
const MITER_LIMIT = 10;

/**
 * Depth (mm) of the shelf on each side of a hatch (Durchreiche): a stainless ledge for plates,
 * commonly 200 to 300 mm deep.
 */
export const HATCH_SHELF_DEPTH = 250;
/** Thickness of that shelf (mm, a folded stainless sheet). */
export const HATCH_SHELF_THICKNESS = 30;

/** Length of the partition's centre line (mm). */
export function partitionLength(p: Pick<Partition, "a" | "b">): number {
  return dist(p.a, p.b);
}

/** Direction of a→b in degrees, clockwise on screen from +x (as arcs and rotations count). */
export function partitionAngle(p: Pick<Partition, "a" | "b">): number {
  return (Math.atan2(p.b.y - p.a.y, p.b.x - p.a.x) * 180) / Math.PI;
}

/** Unit direction a→b and the unit normal to its left on screen. */
export function partitionAxes(p: Pick<Partition, "a" | "b">): { dir: Vec2; left: Vec2 } {
  const dir = norm(sub(p.b, p.a));
  return { dir, left: { x: dir.y, y: -dir.x } };
}

/** The partition as a plain rectangle: a-left, b-left, b-right, a-right (ends square, no joints). */
export function partitionOutline(p: Pick<Partition, "a" | "b" | "thickness">): Vec2[] {
  const { left } = partitionAxes(p);
  const h = scale(left, p.thickness / 2);
  return [add(p.a, h), add(p.b, h), sub(p.b, h), sub(p.a, h)];
}

/** One long face of a partition: a segment parallel to a→b with its normal pointing away from the wall. */
export interface PartitionFace {
  partition: string;
  side: "left" | "right";
  /** The face's ends, `a` beside the partition's `a`. */
  a: Vec2;
  b: Vec2;
  /** Unit direction a→b. */
  dir: Vec2;
  /** Unit normal pointing out of the partition, into the room on that side. */
  normal: Vec2;
  length: number;
}

/** Both long faces (left, then right) for snapping items against a partition. */
export function partitionFaces(p: Partition): [PartitionFace, PartitionFace] {
  const { dir, left } = partitionAxes(p);
  const h = scale(left, p.thickness / 2);
  const length = partitionLength(p);
  const right = scale(left, -1);
  return [
    { partition: p.id, side: "left", a: add(p.a, h), b: add(p.b, h), dir, normal: left, length },
    { partition: p.id, side: "right", a: sub(p.a, h), b: sub(p.b, h), dir, normal: right, length },
  ];
}

/** The two end points of an opening on the partition's centre line. */
export function openingSpanOnPartition(p: Pick<Partition, "a" | "b">, o: Pick<Opening, "offset" | "width">): [Vec2, Vec2] {
  const { dir } = partitionAxes(p);
  return [add(p.a, scale(dir, o.offset - o.width / 2)), add(p.a, scale(dir, o.offset + o.width / 2))];
}

/** Keeps an opening inside its partition: the width at most the length, the offset so it all fits. */
export function clampPartitionOpening(p: Pick<Partition, "a" | "b">, o: Opening): Opening {
  const length = partitionLength(p);
  const width = Math.min(o.width, length);
  const offset = Math.min(Math.max(o.offset, width / 2), length - width / 2);
  return { ...o, width, offset };
}

/** Distance (mm) from a point to the partition's rectangle; 0 inside or on its edge. */
export function distToPartition(pt: Vec2, p: Pick<Partition, "a" | "b" | "thickness">): number {
  const { dir, left } = partitionAxes(p);
  const rel = sub(pt, p.a);
  const s = dot(rel, dir);
  const n = dot(rel, left);
  const ds = Math.max(-s, 0, s - partitionLength(p));
  const dn = Math.max(Math.abs(n) - p.thickness / 2, 0);
  return Math.hypot(ds, dn);
}

/** Does the point lie inside the partition's rectangle (its edge counts as inside)? */
export function pointInPartition(pt: Vec2, p: Pick<Partition, "a" | "b" | "thickness">): boolean {
  return distToPartition(pt, p) <= EPS;
}

/** The partition at a point (the last drawn wins), within `tolerance` mm of its edge; null when none. */
export function partitionAt(room: Pick<Room, "partitions">, pt: Vec2, tolerance = 0): Partition | null {
  for (let i = room.partitions.length - 1; i >= 0; i--) {
    if (distToPartition(pt, room.partitions[i]) <= tolerance + EPS) return room.partitions[i];
  }
  return null;
}

/** The partition an opening sits in, or undefined for an opening in an outer wall (or a dangling one). */
export function partitionOf(room: Pick<Room, "partitions">, o: Pick<Opening, "partition">): Partition | undefined {
  return o.partition === undefined ? undefined : room.partitions.find((p) => p.id === o.partition);
}

// ---- Wall hosts ----

/**
 * A wall that can hold openings: an outer wall or a partition. Openings measure their offset from
 * `a` along `dir`. `a`→`b` is the inner face for an outer wall and the centre line for a
 * partition. `normal` is the side a door opening "in" swings to: into the room for outer walls,
 * to the left of a→b for partitions.
 */
export type WallHost =
  | { kind: "wall"; index: number; a: Vec2; b: Vec2; dir: Vec2; normal: Vec2; length: number; thickness: number }
  | { kind: "partition"; id: string; a: Vec2; b: Vec2; dir: Vec2; normal: Vec2; length: number; thickness: number };

/** All walls that can hold openings: the outer walls in order, then the partitions in order. */
export function wallHosts(room: Pick<Room, "points" | "wallThickness" | "partitions">): WallHost[] {
  const out: WallHost[] = walls(room).map((w) => ({
    kind: "wall",
    index: w.index,
    a: w.a,
    b: w.b,
    dir: w.dir,
    normal: w.inward,
    length: w.length,
    thickness: room.wallThickness,
  }));
  for (const p of room.partitions) {
    const { dir, left } = partitionAxes(p);
    out.push({ kind: "partition", id: p.id, a: p.a, b: p.b, dir, normal: left, length: partitionLength(p), thickness: p.thickness });
  }
  return out;
}

/** The host of an opening (its partition when `partition` is set, else its outer wall); null when missing. */
export function openingHost(room: Pick<Room, "points" | "wallThickness" | "partitions">, o: Pick<Opening, "wall" | "partition">): WallHost | null {
  const hosts = wallHosts(room);
  const found = o.partition !== undefined ? hosts.find((h) => h.kind === "partition" && h.id === o.partition) : hosts.find((h) => h.kind === "wall" && h.index === o.wall);
  return found ?? null;
}

// ---- Joints ----

/**
 * A partition's band with clean joints: where an end meets the inner face of an outer wall or
 * the face of another partition (T), it is cut along that face; where it meets the end of
 * another partition (L), both are mitered. Free ends are square.
 */
export interface PartitionBand {
  partition: Partition;
  dir: Vec2;
  left: Vec2;
  length: number;
  /** Corners at `a`: on the left face, on the right face. */
  start: [Vec2, Vec2];
  /** Corners at `b`: on the left face, on the right face. */
  end: [Vec2, Vec2];
}

export function partitionBand(room: Pick<Room, "points" | "wallThickness" | "partitions">, p: Partition): PartitionBand {
  const { dir, left } = partitionAxes(p);
  const length = partitionLength(p);
  const h = scale(left, p.thickness / 2);
  const start = joinEnd(room, p, p.a, dir, h) ?? [add(p.a, h), sub(p.a, h)];
  const end = joinEnd(room, p, p.b, scale(dir, -1), h) ?? [add(p.b, h), sub(p.b, h)];
  return { partition: p, dir, left, length, start, end };
}

/**
 * The band between `s0` and `s1` along the centre line as a polygon: left face s0→s1, then the
 * right face back. An end at 0 or the full length takes the joint's corners.
 */
export function bandPiece(band: PartitionBand, s0: number, s1: number): Vec2[] {
  const h = scale(band.left, band.partition.thickness / 2);
  const centre = (s: number) => add(band.partition.a, scale(band.dir, s));
  const l = (s: number) => (s <= EPS ? band.start[0] : s >= band.length - EPS ? band.end[0] : add(centre(s), h));
  const r = (s: number) => (s <= EPS ? band.start[1] : s >= band.length - EPS ? band.end[1] : sub(centre(s), h));
  return [l(s0), l(s1), r(s1), r(s0)];
}

/** Where the lines p0 + k·d0 and p1 + k·d1 cross; null when they are parallel. */
function intersect(p0: Vec2, d0: Vec2, p1: Vec2, d1: Vec2): Vec2 | null {
  const den = cross(d0, d1);
  if (Math.abs(den) < 1e-9) return null;
  const k = cross(sub(p1, p0), d1) / den;
  return add(p0, scale(d0, k));
}

/**
 * The corners [left, right] of one end `e` of `p`, cut along the line (q, m); `into` points
 * from the end into the partition, `h` is the half-thickness offset to the left. Null when the
 * cut is parallel to the partition or too acute.
 */
function cutEnd(p: Partition, e: Vec2, into: Vec2, h: Vec2, q: Vec2, m: Vec2): [Vec2, Vec2] | null {
  const l = intersect(add(e, h), into, q, m);
  const r = intersect(sub(e, h), into, q, m);
  if (!l || !r) return null;
  const reach = MITER_LIMIT * p.thickness;
  if (dist(l, add(e, h)) > reach || dist(r, sub(e, h)) > reach) return null;
  return [l, r];
}

function joinEnd(room: Pick<Room, "points" | "wallThickness" | "partitions">, p: Partition, e: Vec2, into: Vec2, h: Vec2): [Vec2, Vec2] | null {
  // Another partition: first an L (ends on one spot), then a T (the end on its band).
  for (const q of room.partitions) {
    if (q.id === p.id) continue;
    const qAxes = partitionAxes(q);
    for (const [qe, qInto] of [
      [q.a, qAxes.dir],
      [q.b, scale(qAxes.dir, -1)],
    ] as const) {
      if (dist(e, qe) > JOIN_TOLERANCE) continue;
      // Collinear continuation: a square joint; otherwise the miter bisects both directions.
      const sum = add(into, qInto);
      const m = Math.hypot(sum.x, sum.y) < 1e-6 ? { x: into.y, y: -into.x } : norm(sum);
      const cut = cutEnd(p, e, into, h, e, m);
      if (cut) return cut;
    }
  }
  for (const q of room.partitions) {
    if (q.id === p.id) continue;
    const { dir: qd, left: ql } = partitionAxes(q);
    if (Math.abs(dot(qd, into)) > 1 - 1e-6) continue;
    const rel = sub(e, q.a);
    const s = dot(rel, qd);
    if (s <= JOIN_TOLERANCE || s >= partitionLength(q) - JOIN_TOLERANCE) continue;
    if (Math.abs(dot(rel, ql)) > q.thickness / 2 + JOIN_TOLERANCE) continue;
    // The face of q on the side where p's body lies.
    const side = dot(into, ql) >= 0 ? 1 : -1;
    const cut = cutEnd(p, e, into, h, add(q.a, scale(ql, (side * q.thickness) / 2)), qd);
    if (cut) return cut;
  }
  // An outer wall: the end on its inner face or inside the wall, the partition reaching into the room.
  let best: { cut: [Vec2, Vec2]; head: number } | null = null;
  for (const w of walls(room)) {
    if (w.length < EPS) continue;
    const head = dot(into, w.inward);
    if (head < 1e-6) continue;
    const depth = dot(sub(e, w.a), w.inward);
    if (depth > JOIN_TOLERANCE || depth < -room.wallThickness - JOIN_TOLERANCE) continue;
    const along = dot(sub(e, w.a), w.dir);
    if (along < -room.wallThickness || along > w.length + room.wallThickness) continue;
    const cut = cutEnd(p, e, into, h, w.a, w.dir);
    if (cut && (!best || head > best.head)) best = { cut, head };
  }
  return best?.cut ?? null;
}
