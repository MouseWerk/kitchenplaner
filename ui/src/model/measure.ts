// The measure tool of the floor plan: a distance between two points, each snapped to what a
// planner measures between (corners and edges of the equipment, the room's corners and wall
// faces, the partitions, the grid). Pure functions; the plan's MeasureLayer draws the result.

import { add, dist, distToSegment, dot, footprint, partitionOutline, round, scale, snapValue, sub } from "./geometry";
import { snapDirection } from "./wallDraw";
import type { Project, Vec2 } from "./types";

/** What a point snapped to: a corner or edge middle, a wall or item edge, the grid, nothing. */
export type MeasureSnapKind = "point" | "edge" | "grid" | "free";

export interface MeasureSnap {
  p: Vec2;
  kind: MeasureSnapKind;
}

/** The points and segments a measurement snaps onto. */
export interface MeasureTargets {
  points: Vec2[];
  segments: [Vec2, Vec2][];
}

/** Every corner and edge of the room, its partitions and its equipment. */
export function measureTargets(project: Pick<Project, "room" | "items">): MeasureTargets {
  const points: Vec2[] = [];
  const segments: [Vec2, Vec2][] = [];
  const outline = (pts: readonly Vec2[], closed: boolean) => {
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      points.push(a);
      // Edge middles: a planner measures to the middle of a unit or a wall as often as to a corner.
      points.push(scale(add(a, b), 0.5));
      segments.push([a, b]);
    }
    if (!closed && pts.length > 0) points.push(pts[pts.length - 1]);
  };
  // The room outline is the inner face of the outer walls.
  outline(project.room.points, true);
  for (const p of project.room.partitions ?? []) outline(partitionOutline(p), true);
  for (const it of project.items) outline(footprint(it), true);
  return { points, segments };
}

/**
 * Snaps a point for the measure tool: onto the nearest corner or edge middle within `radius`
 * (mm), else onto the nearest edge within it, else onto the grid (0: none).
 */
export function snapMeasurePoint(p: Vec2, targets: MeasureTargets, radius: number, grid: number): MeasureSnap {
  let best: Vec2 | null = null;
  let bestD = radius;
  for (const q of targets.points) {
    const d = dist(p, q);
    if (d <= bestD) {
      best = q;
      bestD = d;
    }
  }
  if (best) return { p: roundPt(best), kind: "point" };
  bestD = radius;
  for (const [a, b] of targets.segments) {
    const d = distToSegment(p, a, b);
    if (d <= bestD) {
      best = closestOnSegment(p, a, b);
      bestD = d;
    }
  }
  if (best) return { p: roundPt(best), kind: "edge" };
  if (grid > 0) return { p: { x: snapValue(p.x, grid), y: snapValue(p.y, grid) }, kind: "grid" };
  return { p: roundPt(p), kind: "free" };
}

/**
 * The end point held to a multiple of `step` degrees from `from` (Shift): the snapped point
 * projected onto that direction, so a horizontal measurement still stops at the wall it points at.
 */
export function constrainMeasure(from: Vec2, to: MeasureSnap, step = 45): MeasureSnap {
  const dir = snapDirection(from, to.p, step);
  const along = dot(sub(to.p, from), dir);
  const p = roundPt(add(from, scale(dir, along)));
  return { p, kind: dist(p, to.p) < 0.5 ? to.kind : "free" };
}

export interface Measurement {
  a: Vec2;
  b: Vec2;
  /** Straight distance (mm). */
  length: number;
  /** Signed offsets from a to b along the plan's axes (mm). */
  dx: number;
  dy: number;
  /** Direction from a to b in degrees, 0 east, clockwise on the plan (y points down), 0 to < 360. */
  angle: number;
}

export function measure(a: Vec2, b: Vec2): Measurement {
  const dx = round(b.x - a.x);
  const dy = round(b.y - a.y);
  const angle = round(((((Math.atan2(dy, dx) * 180) / Math.PI) % 360) + 360) % 360);
  return { a, b, length: round(Math.hypot(dx, dy)), dx, dy, angle: angle >= 360 ? 0 : angle };
}

function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return add(a, scale(ab, t));
}

const roundPt = (p: Vec2): Vec2 => ({ x: round(p.x), y: round(p.y) });
