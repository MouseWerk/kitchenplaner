// Drawing walls like in a CAD program: the room outline click by click and partitions from end
// to end. Directions snap to 45° steps, lengths and points to the grid, points to existing
// corners and walls, and a typed length gives the exact wall. Pure functions; the room mode of
// the plan (views/RoomEditLayer.tsx) feeds them the cursor and draws what they return.

import { add, cross, dist, distToSegment, dot, len, norm, scale, snapValue, sub } from "./geometry";
import { COINCIDENT_DISTANCE } from "./roomEdit";
export { isValidOutline, selfIntersects } from "./roomEdit";
import type { Opening, Room, Vec2 } from "./types";

/** Directions snap to multiples of this angle (degrees) unless drawing freely. */
export const ANGLE_STEP = 45;

/** A guide line shown while a point snaps: from the point it aligns with to the snapped point. */
export interface Guide {
  from: Vec2;
  to: Vec2;
}

/** A point after snapping, with what it snapped to (for the guides and the marker). */
export interface Snapped {
  p: Vec2;
  /** The corner or end the point lies on, if any. */
  target: Vec2 | null;
  guides: Guide[];
}

/** A line segment the drawing can snap onto (an outer wall, a partition face). */
export interface Segment {
  a: Vec2;
  b: Vec2;
}

export interface SnapOptions {
  /** Grid step (mm), 0 for none. */
  grid: number;
  /** Snap distance (mm): how close the cursor must come to a corner, guide or wall. */
  radius: number;
  /** Corners and ends to snap onto and align with. */
  corners: readonly Vec2[];
  /** Walls and faces to snap onto. */
  segments?: readonly Segment[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const roundPt = (p: Vec2): Vec2 => ({ x: round1(p.x), y: round1(p.y) });

/** The direction from `from` towards `to`, turned to the nearest multiple of `step` degrees. */
export function snapDirection(from: Vec2, to: Vec2, step = ANGLE_STEP): Vec2 {
  const d = sub(to, from);
  if (len(d) < 1e-9) return { x: 1, y: 0 };
  const a = Math.atan2(d.y, d.x);
  const s = (step * Math.PI) / 180;
  const snapped = Math.round(a / s) * s;
  // Exact zeros for the axis directions, so axis-aligned walls stay exactly axis-aligned.
  const c = Math.cos(snapped);
  const n = Math.sin(snapped);
  return { x: Math.abs(c) < 1e-12 ? 0 : c, y: Math.abs(n) < 1e-12 ? 0 : n };
}

/** The point `length` mm from `from` in direction `dir` (a unit vector). */
export function pointAt(from: Vec2, dir: Vec2, length: number): Vec2 {
  return roundPt(add(from, scale(dir, length)));
}

/**
 * Snaps a free point: onto a corner within the radius, else onto the grid, then each axis onto
 * a corner with (nearly) the same x or y (shown as a guide), then onto a wall within the radius.
 */
export function snapPoint(p: Vec2, o: SnapOptions): Snapped {
  const corner = nearest(p, o.corners, o.radius);
  if (corner) return { p: corner, target: corner, guides: [] };
  let q = { x: snapValue(p.x, o.grid), y: snapValue(p.y, o.grid) };
  const guides: Guide[] = [];
  const ax = alignAxis(p, o.corners, o.radius, "x");
  const ay = alignAxis(p, o.corners, o.radius, "y");
  if (ax) q = { ...q, x: ax.x };
  if (ay) q = { ...q, y: ay.y };
  if (ax) guides.push({ from: ax, to: q });
  if (ay) guides.push({ from: ay, to: q });
  if (!ax && !ay && o.segments) {
    const onWall = nearestOnSegments(p, o.segments, o.radius);
    if (onWall) q = onWall;
  }
  return { p: roundPt(q), target: null, guides };
}

/**
 * The next point of a wall drawn from `from` towards the cursor. Typed: exactly `typed` mm in
 * the (snapped) direction of the cursor. Otherwise a corner within the radius wins; else the
 * direction snaps to 45° steps (unless `free`) and the length to the grid, and an axis-aligned
 * wall stops where it lines up with another corner or meets a wall.
 */
export function nextPoint(from: Vec2, cursor: Vec2, o: SnapOptions & { free: boolean; typed: number | null }): Snapped {
  if (o.typed !== null) {
    const dir = o.free ? norm(sub(cursor, from)) : snapDirection(from, cursor);
    const d = len(dir) < 1e-9 ? { x: 1, y: 0 } : dir;
    return { p: pointAt(from, d, Math.abs(o.typed)), target: null, guides: [] };
  }
  const corner = nearest(cursor, o.corners.filter((c) => dist(c, from) > 1e-6), o.radius);
  if (corner) return { p: corner, target: corner, guides: [] };
  if (o.free) return snapPoint(cursor, { ...o, corners: o.corners });
  const dir = snapDirection(from, cursor);
  const along = Math.max(dot(sub(cursor, from), dir), 0);
  let p = add(from, scale(dir, snapValue(along, o.grid)));
  const guides: Guide[] = [];
  const raw = add(from, scale(dir, along));
  // Along an axis the length can stop where the point lines up with another corner.
  const axis = dir.y === 0 ? "x" : dir.x === 0 ? "y" : null;
  const aligned = axis ? alignAxis(raw, o.corners, o.radius, axis) : null;
  if (aligned && axis) {
    p = axis === "x" ? { x: aligned.x, y: from.y } : { x: from.x, y: aligned.y };
    guides.push({ from: aligned, to: p });
  } else if (o.segments) {
    const hit = rayHit(from, dir, o.segments, raw, o.radius);
    if (hit) p = hit;
  }
  return { p: roundPt(p), target: null, guides };
}

/** The first point of `points` within `radius` of `p` (the closest), or null. */
function nearest(p: Vec2, points: readonly Vec2[], radius: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = radius;
  for (const q of points) {
    const d = dist(p, q);
    if (d <= bestD) {
      best = q;
      bestD = d;
    }
  }
  return best;
}

/** A corner whose `axis` coordinate lies within `radius` of the point's (the closest), or null. */
function alignAxis(p: Vec2, corners: readonly Vec2[], radius: number, axis: "x" | "y"): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = radius;
  for (const c of corners) {
    const d = Math.abs(c[axis] - p[axis]);
    // Prefer the nearest corner among equally aligned ones, so the guide stays short.
    if (d < bestD || (best && d === bestD && dist(c, p) < dist(best, p))) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** The closest point on any segment within `radius` of `p`, or null. */
function nearestOnSegments(p: Vec2, segments: readonly Segment[], radius: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = radius;
  for (const s of segments) {
    const d = distToSegment(p, s.a, s.b);
    if (d > bestD) continue;
    const e = sub(s.b, s.a);
    const l2 = dot(e, e);
    const t = l2 < 1e-9 ? 0 : Math.min(Math.max(dot(sub(p, s.a), e) / l2, 0), 1);
    best = add(s.a, scale(e, t));
    bestD = d;
  }
  return best;
}

/** Where the ray from `from` along `dir` meets a segment, if that is within `radius` of `near`. */
function rayHit(from: Vec2, dir: Vec2, segments: readonly Segment[], near: Vec2, radius: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = radius;
  for (const s of segments) {
    const e = sub(s.b, s.a);
    const den = cross(dir, e);
    if (Math.abs(den) < 1e-9) continue;
    const w = sub(s.a, from);
    const t = cross(w, e) / den;
    const u = cross(w, dir) / den;
    if (t <= 1e-6 || u < -1e-9 || u > 1 + 1e-9) continue;
    const hit = add(from, scale(dir, t));
    const d = dist(hit, near);
    if (d <= bestD) {
      best = hit;
      bestD = d;
    }
  }
  return best;
}

/**
 * What placing point `p` does to the outline drawn so far: "close" it when it lies on the first
 * point (within COINCIDENT_DISTANCE) and three points are there, "reject" it on any other point
 * of the drawing (a wall without length), else "add" it. A typed last wall ends exactly on the
 * start, so this decides by the point, not by how close the cursor is.
 */
export function outlinePointAction(points: readonly Vec2[], p: Vec2): "close" | "add" | "reject" {
  if (points.length >= 3 && dist(points[0], p) < COINCIDENT_DISTANCE) return "close";
  return points.some((q) => dist(q, p) < COINCIDENT_DISTANCE) ? "reject" : "add";
}

/** Does the cursor close the outline: at least three points and within `radius` of the first? */
export function closesOutline(points: readonly Vec2[], cursor: Vec2, radius: number): boolean {
  return points.length >= 3 && dist(points[0], cursor) <= radius;
}

/**
 * The room with a newly drawn outline. Partitions and the openings in partitions stay. An opening
 * in an outer wall stays only where a new wall runs exactly through it (redrawing a room keeps
 * its doors; walls that moved lose theirs): its new wall and offset are found by geometry, so the
 * drawing direction and the starting corner do not matter. All other wall openings are dropped.
 */
export function replaceOutline(room: Room, points: Vec2[]): Room {
  const next = { ...room, points };
  const n = points.length;
  const openings: Opening[] = [];
  const oldN = room.points.length;
  for (const o of room.openings) {
    if (o.partition) {
      openings.push(o);
      continue;
    }
    const a = room.points[o.wall];
    const b = room.points[(o.wall + 1) % oldN];
    if (!a || !b) continue;
    const dir = norm(sub(b, a));
    const s0 = add(a, scale(dir, o.offset - o.width / 2));
    const s1 = add(a, scale(dir, o.offset + o.width / 2));
    const centre = add(a, scale(dir, o.offset));
    for (let i = 0; i < n; i++) {
      const wa = points[i];
      const wb = points[(i + 1) % n];
      if (distToSegment(s0, wa, wb) > 0.5 || distToSegment(s1, wa, wb) > 0.5) continue;
      openings.push({ ...o, wall: i, offset: round1(dot(sub(centre, wa), norm(sub(wb, wa)))) });
      break;
    }
  }
  return { ...next, openings };
}
