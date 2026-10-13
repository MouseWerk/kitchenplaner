// Snapping with visible guides, for moving equipment in the plan: an item's back against a wall
// or partition face, and the edges and centres of the moved items' bounding box against the
// edges and centres of the other items and against the walls. Returns where the items land and
// the guide lines and points that explain why, so the plan can draw them. Pure functions.

import { bounds, footprint, nearestFace, placeAgainst, roomFaces, round, snapValue, type Box, type Face } from "./geometry";
import type { Item, Partition, Room, Vec2 } from "./types";

/** What a guide aligns: edges, centres, or an item's back against a wall or partition face. */
export type GuideKind = "edge" | "centre" | "wall";

export interface Guide {
  a: Vec2;
  b: Vec2;
  kind: GuideKind;
}

export interface Snapped {
  /** Where the moved items land, relative to the position they were given. */
  dx: number;
  dy: number;
  guides: Guide[];
  /** The snapped points, marked on the plan. */
  marks: Vec2[];
}

export interface SnappedItem extends Snapped {
  x: number;
  y: number;
  rotation: number;
}

type RoomLike = Pick<Room, "points"> & { partitions?: readonly Partition[] };
type Placed = Pick<Item, "x" | "y" | "rotation" | "width" | "depth">;

/** Coordinates closer than this (mm) count as the same line. */
const SAME = 0.5;
/** A face is a target only for boxes that come this close to its extent along it (mm). */
const FACE_REACH_ALONG = 50;

interface AxisTarget {
  v: number;
  kind: GuideKind;
  /** Which value of the moving box it aligns with. */
  mine: "min" | "mid" | "max";
  /** The target's extent across the axis (for the guide line). */
  lo: number;
  hi: number;
}

/**
 * Snaps a moving box (its edges and centre) to target boxes and to axis-parallel faces, each
 * axis on its own, within `reach` mm. `lock` keeps an axis as it is (an item standing against a
 * wall keeps its distance to it).
 */
export function snapBox(box: Box, targets: readonly Box[], faces: readonly Face[], reach: number, lock: { x?: boolean; y?: boolean } = {}): Snapped {
  const out: Snapped = { dx: 0, dy: 0, guides: [], marks: [] };
  for (const axis of ["x", "y"] as const) {
    if (lock[axis]) continue;
    const across = axis === "x" ? "y" : "x";
    const mine = span(box, axis);
    const myAcross = span(box, across);
    const cands: AxisTarget[] = [];
    for (const t of targets) {
      const s = span(t, axis);
      const c = span(t, across);
      for (const [v, m] of [[s.min, "min"], [s.max, "max"], [s.min, "max"], [s.max, "min"]] as const) cands.push({ v, kind: "edge", mine: m, lo: c.min, hi: c.max });
      cands.push({ v: s.mid, kind: "centre", mine: "mid", lo: c.min, hi: c.max });
    }
    for (const f of faces) {
      // Only faces that run across this axis: a face along y has a constant x.
      const n = axis === "x" ? f.inward.x : f.inward.y;
      if (Math.abs(Math.abs(n) - 1) > 1e-6) continue;
      const lo = Math.min(f.a[across], f.b[across]);
      const hi = Math.max(f.a[across], f.b[across]);
      if (myAcross.max < lo - FACE_REACH_ALONG || myAcross.min > hi + FACE_REACH_ALONG) continue;
      // The box stands in front of the face: its side towards the face touches it.
      cands.push({ v: f.a[axis], kind: "wall", mine: n > 0 ? "min" : "max", lo, hi });
    }
    let best: number | null = null;
    for (const c of cands) {
      const d = c.v - mine[c.mine];
      if (Math.abs(d) <= reach && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    if (best === null) continue;
    const d = best;
    out[axis === "x" ? "dx" : "dy"] = d;
    const moved = { min: mine.min + d, mid: mine.mid + d, max: mine.max + d };
    const seen = new Set<string>();
    for (const c of cands) {
      const m = moved[c.mine];
      if (Math.abs(c.v - m) > SAME) continue;
      const lo = Math.min(c.lo, myAcross.min);
      const hi = Math.max(c.hi, myAcross.max);
      const key = `${c.kind}:${round(m)}:${round(lo)}:${round(hi)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.guides.push({ a: at(axis, m, lo), b: at(axis, m, hi), kind: c.kind });
      if (c.mine === "mid") out.marks.push(at(axis, m, myAcross.mid));
      else out.marks.push(at(axis, m, myAcross.min), at(axis, m, myAcross.max));
    }
  }
  return out;
}

/**
 * Where a single moved item lands: its back against the nearest wall or partition face (when it
 * already faces away from it), then its edges and centre aligned with the other items and the
 * walls. `grid` rounds the position when nothing else snaps; `reach` is the alignment distance.
 */
export function snapItemGuides(item: Placed, room: RoomLike, others: readonly Placed[], grid: number, reach: number): SnappedItem {
  const faces = roomFaces(room);
  let pos = { x: snapValue(item.x, grid), y: snapValue(item.y, grid) };
  let rotation = item.rotation;
  const guides: Guide[] = [];
  const marks: Vec2[] = [];
  const lock: { x?: boolean; y?: boolean } = {};
  const against = nearestFace(item, faces, false);
  if (against) {
    const { face } = against;
    rotation = against.rotation;
    pos = placeAgainst(item, face, grid);
    guides.push({ a: face.a, b: face.b, kind: "wall" });
    marks.push({ x: pos.x - (face.inward.x * item.depth) / 2, y: pos.y - (face.inward.y * item.depth) / 2 });
    // Standing against the face: only sliding along it is left (none along a slanted face).
    lock.x = Math.abs(face.dir.y) > 1e-6;
    lock.y = Math.abs(face.dir.x) > 1e-6;
  }
  const box = bounds(footprint({ ...item, ...pos, rotation }));
  const s = snapBox(
    box,
    others.map((o) => bounds(footprint(o))),
    faces.filter((f) => f !== against?.face),
    reach,
    lock,
  );
  const x = round(pos.x + s.dx);
  const y = round(pos.y + s.dy);
  return { x, y, rotation, dx: x - item.x, dy: y - item.y, guides: [...guides, ...s.guides], marks: [...marks, ...s.marks] };
}

/** Snaps a group of moved items as one box (their rotations stay). */
export function snapGroupGuides(items: readonly Placed[], room: RoomLike, others: readonly Placed[], reach: number): Snapped {
  const box = bounds(items.flatMap((it) => footprint(it)));
  const s = snapBox(
    box,
    others.map((o) => bounds(footprint(o))),
    roomFaces(room),
    reach,
  );
  return { ...s, dx: round(s.dx), dy: round(s.dy) };
}

function span(b: Box, axis: "x" | "y") {
  return axis === "x" ? { min: b.minX, mid: (b.minX + b.maxX) / 2, max: b.maxX } : { min: b.minY, mid: (b.minY + b.maxY) / 2, max: b.maxY };
}

/** A point given by its coordinate on `axis` and the coordinate across it. */
function at(axis: "x" | "y", v: number, across: number): Vec2 {
  return axis === "x" ? { x: v, y: across } : { x: across, y: v };
}
