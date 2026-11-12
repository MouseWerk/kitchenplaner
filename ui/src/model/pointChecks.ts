// The plan check of the connection points (`model/points.ts`) and of the heat under each hood:
// points outside the room or in a partition, points the planner moved off their unit, water,
// drain and gas points standing free in the room with nothing to bring the pipe up, floor drain
// points without a drain, fuses set below the current, a plan with gas but no gas emergency
// shut-off, and hoods extracting less air than the heat under them asks for. The
// thresholds and the kinds they name are in `checkRules.ts`; the gas unit without a hood is part
// of the hood rule in `clearances.ts`, so a unit is not reported twice for one hood.

import { kindOf } from "../kinds/registry";
import {
  AIRFLOW_STEP,
  FLOOR_DRAIN_FRONT,
  FLOOR_DRAIN_KINDS,
  FLOOR_DRAIN_REACH,
  GAS_SHUTOFF_KIND,
  HOOD_AIR_PER_KW,
  HOOD_KINDS,
  ISLAND_REACH,
  ISLAND_SUPPLY_KINDS,
  POINT_OFF_UNIT,
  TOLERANCE,
  WALL_REACH,
} from "./checkRules";
import type { Issue } from "./checks";
import type { Prepared } from "./clearances";
import { area, bounds, cross, distToSegment, dot, EPS, norm, pointInPolygon, signedArea, sub, type Box } from "./geometry";
import { itemHeat } from "./heat";
import { partitionLength, partitionOutline } from "./partitions";
import { itemPoints, pointLabel, type ConnectionPoint } from "./points";
import type { Item, Partition, Project, Trade, Vec2 } from "./types";

/** Points that run as pipes and so need a wall, the floor or a column to come from. */
const PIPE_TRADES: ReadonlySet<Trade> = new Set(["gas", "coldWater", "hotWater", "softWater", "drain", "floorDrain"]);
/** Drains may also run to a floor drain or channel nearby. */
const DRAIN_TRADES: ReadonlySet<Trade> = new Set(["drain", "floorDrain"]);
/** Air points sit in the ceiling or on top of a unit: they may lie above a partition or past the outline. */
const AIR_TRADES: ReadonlySet<Trade> = new Set(["exhaust", "supply"]);

/** One unit with its outline, where the point checks look at it. */
interface Spot {
  it: Item;
  kind: string;
  fp: Vec2[];
  box: Box;
}

/**
 * The findings about connection points and heat, in this order: points outside the room or in a
 * partition, points off their unit, points standing free in the room, floor drain points without
 * a drain, fuses below the current, the missing gas shut-off, hood airflow. `skip` holds the items
 * already reported for standing outside the room or in a partition: their points are not
 * reported again, as outside, off the unit or as standing free.
 */
export function pointIssues(project: Project, prep: Prepared, skip: ReadonlySet<string>): Issue[] {
  const items = project.items;
  const spots: Spot[] = items.map((it, i) => ({ it, kind: kindOf(it.catalogId), fp: prep.fps[i], box: bounds(prep.fps[i]) }));
  // The points of every unit, in item order; most units have none.
  const points = items.map((it) => itemPoints(it));
  const label = (p: ConnectionPoint) => pointLabel({ pos: prep.posOf(p.itemId), trade: p.trade });
  const parts = project.room.partitions.filter((p) => partitionLength(p) >= EPS);
  const outside = outsideIssues(project, parts, points, skip, label);
  // A point already reported outside the room is not reported again as off its unit.
  const reported = new Set(outside.flatMap((i) => String(i.vars.point).split(", ")));
  return [
    ...outside,
    ...offUnitIssues(project, prep, points, skip, label, reported),
    ...islandIssues(project, parts, spots, points, prep, skip, label),
    ...floorDrainIssues(spots, points, label),
    ...fuseIssues(points, label),
    ...gasShutoffIssues(spots),
    ...airflowIssues(project, spots, prep),
  ];
}

// --- Points outside the room or in a partition ------------------------------------------------

/**
 * A point outside the room's outline, or inside a partition below its top, is one the installer
 * cannot reach. Points on a wall face count as inside (a basin hangs with its pipes in the wall).
 * Air points are left out: they sit in the ceiling. One finding per unit, naming its points.
 */
function outsideIssues(project: Project, parts: Partition[], points: ConnectionPoint[][], skip: ReadonlySet<string>, label: (p: ConnectionPoint) => string): Issue[] {
  const room = project.room.points;
  const issues: Issue[] = [];
  points.forEach((list, i) => {
    const it = project.items[i];
    if (list.length === 0 || skip.has(it.id)) return;
    const bad = list.filter((p) => !AIR_TRADES.has(p.trade) && ((room.length >= 3 && !pointInPolygon(p.at, room)) || parts.some((w) => p.z < w.height && insidePartition(p.at, w))));
    if (bad.length > 0) issues.push({ key: "check.pointOutside", vars: { point: bad.map(label).join(", ") }, itemIds: [it.id] });
  });
  return issues;
}

/** Is `p` inside a partition's body, more than `TOLERANCE` from its faces and ends? */
function insidePartition(p: Vec2, w: Partition): boolean {
  const dir = norm(sub(w.b, w.a));
  const rel = sub(p, w.a);
  const along = dot(rel, dir);
  const across = Math.abs(cross(dir, rel));
  return along > TOLERANCE && along < partitionLength(w) - TOLERANCE && across < w.thickness / 2 - TOLERANCE;
}

// --- Points off their unit -------------------------------------------------------------------

/**
 * A point more than `POINT_OFF_UNIT` past its unit's outline (seen from above, in the unit's own
 * axes) has lost its unit: mostly a position the planner set before making the unit smaller (an
 * x of 1100 on a sink cut down to 800). A floor drain point may lie `FLOOR_DRAIN_FRONT` in front,
 * where the pan pours. Heights are not checked: a basin's pipes leave the wall below it, a hood's
 * duct leaves at its top, as the catalog contract allows. One finding per unit, naming its points.
 */
function offUnitIssues(project: Project, prep: Prepared, points: ConnectionPoint[][], skip: ReadonlySet<string>, label: (p: ConnectionPoint) => string, reported: ReadonlySet<string>): Issue[] {
  const issues: Issue[] = [];
  points.forEach((list, i) => {
    const it = project.items[i];
    if (list.length === 0 || skip.has(it.id)) return;
    const m = POINT_OFF_UNIT + TOLERANCE;
    const bad = list.filter((p) => {
      const front = it.depth + (p.trade === "floorDrain" ? FLOOR_DRAIN_FRONT : 0);
      return (p.fromLeft < -m || p.fromLeft > it.width + m || p.fromBack < -m || p.fromBack > front + m) && !reported.has(label(p));
    });
    if (bad.length > 0) issues.push({ key: "check.pointOffUnit", vars: { point: bad.map(label).join(", "), pos: prep.posOf(it.id) }, itemIds: [it.id] });
  });
  return issues;
}

// --- Points standing free in the room ---------------------------------------------------------

/**
 * A water, drain or gas point more than `WALL_REACH` from every wall face (outer wall or
 * partition) needs a floor box, media column, shaft or column within `ISLAND_REACH` to bring the
 * pipe up; a drain may also run to a floor drain or channel. A point at height 0 comes from the
 * floor, and the points of hung units (hoods, basins) come from the ceiling or the wall they hang
 * on. One finding per unit, naming its points and the distance of the nearest one to a wall.
 */
function islandIssues(project: Project, parts: Partition[], spots: Spot[], points: ConnectionPoint[][], prep: Prepared, skip: ReadonlySet<string>, label: (p: ConnectionPoint) => string): Issue[] {
  const room = project.room.points;
  const faces: [Vec2, Vec2][] = [];
  if (room.length >= 3) for (let i = 0; i < room.length; i++) faces.push([room[i], room[(i + 1) % room.length]]);
  for (const w of parts) {
    const o = partitionOutline(w);
    for (let i = 0; i < o.length; i++) faces.push([o[i], o[(i + 1) % o.length]]);
  }
  const supplies = spots.filter((s) => ISLAND_SUPPLY_KINDS.has(s.kind));
  const drains = spots.filter((s) => FLOOR_DRAIN_KINDS.has(s.kind));
  const issues: Issue[] = [];
  points.forEach((list, i) => {
    if (list.length === 0 || prep.placement[i] === "overhead" || skip.has(project.items[i].id)) return;
    let nearest = Infinity;
    const bad: ConnectionPoint[] = [];
    for (const p of list) {
      if (!PIPE_TRADES.has(p.trade) || p.z <= TOLERANCE) continue;
      let d = Infinity;
      for (const [a, b] of faces) d = Math.min(d, distToSegment(p.at, a, b));
      if (d <= WALL_REACH + TOLERANCE) continue;
      if (withinReach(p.at, supplies, ISLAND_REACH)) continue;
      if (DRAIN_TRADES.has(p.trade) && withinReach(p.at, drains, ISLAND_REACH)) continue;
      bad.push(p);
      nearest = Math.min(nearest, d);
    }
    // Without any wall (no outline yet) there is nothing to measure from.
    if (bad.length > 0 && nearest < Infinity) {
      issues.push({ key: "check.islandSupply", vars: { point: bad.map(label).join(", "), measured: Math.round(nearest), required: WALL_REACH }, itemIds: [project.items[i].id] });
    }
  });
  return issues;
}

/** Does one of the units lie within `reach` of `p` (measured to its outline, 0 inside it)? */
function withinReach(p: Vec2, spots: Spot[], reach: number): boolean {
  for (const s of spots) {
    const b = s.box;
    if (p.x < b.minX - reach || p.x > b.maxX + reach || p.y < b.minY - reach || p.y > b.maxY + reach) continue;
    if (distToOutline(p, s.fp) <= reach + TOLERANCE) return true;
  }
  return false;
}

/** Distance from `p` to a closed outline, 0 inside it. */
function distToOutline(p: Vec2, fp: Vec2[]): number {
  if (pointInPolygon(p, fp)) return 0;
  let d = Infinity;
  for (let i = 0; i < fp.length; i++) d = Math.min(d, distToSegment(p, fp[i], fp[(i + 1) % fp.length]));
  return d;
}

// --- Floor drain points -----------------------------------------------------------------------

/** Every floor drain point (in front of a tilting pan or kettle) has a floor drain or channel within `FLOOR_DRAIN_REACH`. */
function floorDrainIssues(spots: Spot[], points: ConnectionPoint[][], label: (p: ConnectionPoint) => string): Issue[] {
  const drains = spots.filter((s) => FLOOR_DRAIN_KINDS.has(s.kind));
  const issues: Issue[] = [];
  for (const list of points) {
    for (const p of list) {
      if (p.trade !== "floorDrain" || withinReach(p.at, drains, FLOOR_DRAIN_REACH)) continue;
      issues.push({ key: "check.floorDrainMissing", vars: { point: label(p), required: FLOOR_DRAIN_REACH }, itemIds: [p.itemId] });
    }
  }
  return issues;
}

// --- Fuses below the current -----------------------------------------------------------------

/**
 * A fuse the planner set must carry the point's current, derived or set: one below it trips (or
 * the cable is sized for less than the unit draws). A derived fuse always carries it (`fuseFor`).
 */
function fuseIssues(points: ConnectionPoint[][], label: (p: ConnectionPoint) => string): Issue[] {
  const issues: Issue[] = [];
  for (const list of points) {
    for (const p of list) {
      const { fuseA, currentA } = p.values;
      if (!p.set.has("fuseA") || fuseA === undefined || currentA === undefined || fuseA >= currentA) continue;
      issues.push({ key: "check.fuseLow", vars: { point: label(p), measured: fuseA, required: currentA }, itemIds: [p.itemId] });
    }
  }
  return issues;
}

// --- Gas emergency shut-off -------------------------------------------------------------------

/** A plan with gas units has a gas emergency shut-off (`GAS_SHUTOFF_KIND`); one finding naming the gas units. */
function gasShutoffIssues(spots: Spot[]): Issue[] {
  const gas = spots.filter((s) => (s.it.connections.gasKw ?? 0) > 0);
  if (gas.length === 0 || spots.some((s) => s.kind === GAS_SHUTOFF_KIND)) return [];
  return [{ key: "check.gasShutoffMissing", vars: {}, itemIds: gas.map((s) => s.it.id) }];
}

// --- Hood airflow -----------------------------------------------------------------------------

/**
 * Each hood (`HOOD_KINDS`) extracts at least the heat of the units under it (`itemHeat`, sensible
 * plus latent) × the project's simultaneity × `HOOD_AIR_PER_KW`, rounded up to `AIRFLOW_STEP`. A
 * unit counts under a hood when the hood hangs at or above its top and their outlines overlap;
 * one under several hoods side by side is shared out by the area each covers. A typical value,
 * and the finding says so.
 */
function airflowIssues(project: Project, spots: Spot[], prep: Prepared): Issue[] {
  const hoods = spots.filter((s, i) => prep.placement[i] === "overhead" && HOOD_KINDS.has(s.kind));
  if (hoods.length === 0) return [];
  const heat = new Array<number>(hoods.length).fill(0);
  const under: string[][] = hoods.map(() => []);
  for (const s of spots) {
    if (HOOD_KINDS.has(s.kind)) continue;
    const top = s.it.elevation + s.it.height;
    const shares: { k: number; a: number }[] = [];
    hoods.forEach((h, k) => {
      if (h.it.elevation < top - TOLERANCE || !boxesMeet(h.box, s.box)) return;
      const a = area(clipConvex(s.fp, h.fp));
      if (a > EPS) shares.push({ k, a });
    });
    if (shares.length === 0) continue;
    const { sensibleKw, latentKw } = itemHeat(s.it);
    const kw = sensibleKw + latentKw;
    if (kw <= 0) continue;
    const total = shares.reduce((sum, x) => sum + x.a, 0);
    for (const { k, a } of shares) {
      heat[k] += (kw * a) / total;
      under[k].push(s.it.id);
    }
  }
  const factor = project.settings.simultaneity;
  const issues: Issue[] = [];
  hoods.forEach((h, k) => {
    if (heat[k] <= 0) return;
    const required = Math.ceil((heat[k] * factor * HOOD_AIR_PER_KW) / AIRFLOW_STEP - EPS) * AIRFLOW_STEP;
    const measured = h.it.connections.exhaustM3h ?? 0;
    if (required - measured > TOLERANCE) {
      issues.push({ key: "check.hoodAirflow", vars: { hood: prep.posOf(h.it.id), measured, required }, itemIds: [h.it.id, ...under[k]] });
    }
  });
  return issues;
}

const boxesMeet = (a: Box, b: Box) => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/** The part of the convex polygon `subject` inside the convex polygon `clip` (Sutherland–Hodgman). */
function clipConvex(subject: Vec2[], clip: Vec2[]): Vec2[] {
  const orient = signedArea(clip) >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i];
    const e = sub(clip[(i + 1) % clip.length], a);
    const side = (p: Vec2) => orient * cross(e, sub(p, a));
    const next: Vec2[] = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j];
      const q = out[(j + 1) % out.length];
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) next.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        next.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    out = next;
  }
  return out;
}
