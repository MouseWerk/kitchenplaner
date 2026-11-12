// The workplace checks of the plan check: free space in front of units and doors, aisles between
// units facing each other, hoods over the cooking units, and hand-wash basins near production.
// Their thresholds and the units they apply to are in `checkRules.ts`; each finding gives the
// measured value against the required one and names the units involved.

import { catalogEntry, kindOf, type Placement } from "../kinds/registry";
import {
  AISLE_WIDTH,
  CONDENSING_HOOD_KIND,
  CONDENSING_HOOD_SERVES,
  DOOR_APPROACH_DEPTH,
  DOWNDRAFT_KIND,
  FUNCTION_AREAS,
  FUNCTION_AREAS_BY_ENTRY,
  HANDWASH_DISTANCE,
  HANDWASH_KINDS,
  HOOD_KINDS,
  HOOD_OVERHANG,
  HOOD_OVERHANG_DOOR,
  MOVEMENT_DEPTH,
  MOVEMENT_WIDTH,
  NO_HOOD_KINDS,
  NOT_PRODUCTION_GROUPS,
  NOT_WORKPLACES,
  PRODUCTION_CATEGORIES,
  SHELF_AISLE,
  SHELVING_KINDS,
  STEAM_DOOR_KINDS,
  TOLERANCE,
  TWO_LEAF_ENTRIES,
  WALL_HEIGHT,
  WORKPLACE_CATEGORIES,
  type FunctionKind,
} from "./checkRules";
import type { Issue } from "./checks";
import { isDoor, openingFrame } from "./doors";
import { angleDiff, bounds, convexOverlap, cross, dist, dot, EPS, frontOf, sideOf, signedArea, sub, type Box } from "./geometry";
import { partitionLength, partitionOutline } from "./partitions";
import type { Item, Partition, Project, Vec2 } from "./types";
import type { TKey } from "../lib/i18n";

/** Units side by side touch; this much of a neighbour's edge in a strip is contact, not an obstacle (mm). */
const EDGE = 1;
/** Width of the steps the free depth in front of a unit is measured in where an obstacle stands turned against it (mm). */
const CELL = 50;
/** Rounding of the turned frames: a wall this close to a front line lies on it (mm). */
const ON_LINE = 0.01;
/** Units turned at least this far against each other face each other across an aisle (degrees). */
const FACING = 170;

/** What the plan check already knows about each item (the same order as `project.items`). */
export interface Prepared {
  fps: Vec2[][];
  placement: Placement[];
  posOf: (id: string) => number;
}

/** One unit with what the checks need of it. */
interface Unit {
  it: Item;
  kind: string;
  category?: string;
  group?: string;
  placement: Placement;
  fp: Vec2[];
  box: Box;
}

/** An obstacle in a strip: its outline (a closed polygon or a wall segment) and the unit it is, if any. */
interface Obstacle {
  pts: Vec2[];
  box: Box;
  unit?: Unit;
}

/** The room and its units as the workplace checks see them. */
interface Scene {
  units: Unit[];
  /** Floor units as obstacles, in item order. */
  floor: Obstacle[];
  /**
   * What may end the free space in front of a box: the floor units, outer walls and partitions
   * whose boxes may meet it, in that order.
   */
  near: (box: Box) => Obstacle[];
  /** What a hood may end at: the outer walls and partitions at least `WALL_HEIGHT` high. */
  hoodWalls: Obstacle[];
  /** Partitions that separate areas (at least `WALL_HEIGHT` high). */
  tallParts: Partition[];
  /** The strips in front of the room's doors and passages. */
  approaches: Approach[];
}

function unitOf(it: Item, placement: Placement, fp: Vec2[]): Unit {
  const entry = catalogEntry(it.catalogId);
  return { it, kind: kindOf(it.catalogId), category: entry?.category, group: entry?.group, placement, fp, box: bounds(fp) };
}

function sceneOf(project: Project, prep: Pick<Prepared, "fps" | "placement">): Scene {
  const units = project.items.map((it, i) => unitOf(it, prep.placement[i], prep.fps[i]));
  const pts = project.room.points;
  const outline: Obstacle[] = [];
  if (pts.length >= 3) {
    for (let i = 0; i < pts.length; i++) {
      const seg = [pts[i], pts[(i + 1) % pts.length]];
      outline.push({ pts: seg, box: bounds(seg) });
    }
  }
  const parts = project.room.partitions.filter((p) => partitionLength(p) >= EPS);
  const tallParts = parts.filter((p) => p.height >= WALL_HEIGHT);
  const partObstacle = (p: Partition): Obstacle => {
    const o = partitionOutline(p);
    return { pts: o, box: bounds(o) };
  };
  const floor = units.filter((u) => u.placement === "floor").map((u) => ({ pts: u.fp, box: u.box, unit: u }));
  // Any partition is in the way of walking; only a tall one ends a hood or an area.
  const obstacles = [...floor, ...outline, ...parts.map(partObstacle)];
  return {
    units,
    floor,
    near: gridOf(obstacles),
    hoodWalls: [...outline, ...tallParts.map(partObstacle)],
    tallParts,
    approaches: approaches(project),
  };
}

/**
 * The findings of the workplace checks, in this order: free space in front of units (movement
 * area, aisle, function area of a door or pan), in front of doors of the room, hoods, hand-wash
 * basins. `skipDoor` holds the items already reported for standing in a door's swing area.
 */
export function clearanceIssues(project: Project, prep: Prepared, skipDoor: ReadonlySet<string>): Issue[] {
  const scene = sceneOf(project, prep);
  return [
    ...frontIssues(scene, prep.posOf),
    ...doorApproachIssues(scene, skipDoor, prep.posOf),
    ...hoodIssues(scene.units, scene.hoodWalls, prep.posOf),
    ...handwashIssues(scene.units, scene.tallParts, prep.posOf),
  ];
}

/**
 * A test whether a new unit at a spot keeps the free spaces of the workplace checks: its own
 * (movement area, aisle, function area), the ones in front of the room's doors, and those of the
 * workplaces around it that are kept now. Hoods and hand-wash basins depend on what the planner
 * adds, not on where it lands, so they are not part of it. Prepared once for the project, for
 * trying many spots.
 */
export function clearanceSpotTest(project: Project, prep: Pick<Prepared, "fps" | "placement">): (item: Item, placement: Placement, fp: Vec2[]) => boolean {
  const scene = sceneOf(project, prep);
  const keptNow = new Map<Unit, boolean>();
  const strips = new Map<Unit, Box>();
  const workplaces = scene.floor.flatMap((o) => (o.unit && isWorkplace(o.unit) ? [o.unit] : []));
  return (item, placement, fp) => {
    if (placement !== "floor") return true;
    const u = unitOf(item, placement, fp);
    const ob: Obstacle = { pts: fp, box: u.box, unit: u };
    if (scene.approaches.some((a) => approachDepth(a, ob) !== null)) return false;
    // The obstacles near a strip without the unit where it stands now (when it is moved).
    const others = (box: Box) => scene.near(box).filter((o) => o.unit?.it.id !== item.id);
    if (isWorkplace(u) && frontCheck(u, others(frontStrip(u)))) return false;
    for (const w of workplaces) {
      if (w.it.id === item.id) continue;
      let strip = strips.get(w);
      if (!strip) strips.set(w, (strip = frontStrip(w)));
      if (!boxesMeet(strip, u.box)) continue;
      const near = others(strip);
      let kept = keptNow.get(w);
      if (kept === undefined) keptNow.set(w, (kept = frontCheck(w, near) === null));
      if (kept && frontCheck(w, [...near, ob])) return false;
    }
    return true;
  };
}

// --- Free space in front of units -------------------------------------------------------------

const isWorkplace = (u: Unit) => u.category !== undefined && WORKPLACE_CATEGORIES.has(u.category) && !NOT_WORKPLACES.has(u.kind);
const isShelving = (u: Unit) => SHELVING_KINDS.has(u.kind);
/** The free depth a unit needs in front: a store's shelving less than a workplace. */
const movementDepth = (u: Unit) => (isShelving(u) ? SHELF_AISLE : MOVEMENT_DEPTH);
/** The aisle between two units facing each other: as wide as the one that needs more asks. */
const aisleWidth = (a: Unit, b: Unit) => (isShelving(a) && isShelving(b) ? SHELF_AISLE : AISLE_WIDTH);

/** The function area of a unit: why and how deep it reaches in front, or null. */
function functionArea(u: Unit): { kind: FunctionKind; depth: number } | null {
  const byEntry = FUNCTION_AREAS_BY_ENTRY[u.it.catalogId];
  if (byEntry) return byEntry;
  const f = FUNCTION_AREAS[u.kind];
  if (!f) return null;
  if (f.depth !== "leaf") return { kind: f.kind, depth: f.depth };
  return { kind: f.kind, depth: TWO_LEAF_ENTRIES.has(u.it.catalogId) ? u.it.width / 2 : u.it.width };
}

const FUNCTION_KEYS: Record<FunctionKind, TKey> = {
  door: "check.functionDoor",
  tilt: "check.functionTilt",
  rollIn: "check.functionRollIn",
  hood: "check.functionHood",
};

/** What is short in front of one unit: the rule, the free depth there, the depth needed and the unit in the way. */
interface FrontShort {
  rule: FunctionKind | "aisle" | "movement";
  measured: number;
  required: number;
  other?: Unit;
}

/** The findings of `frontCheck` for every workplace; a gap between two units once. */
function frontIssues(scene: Scene, posOf: (id: string) => number): Issue[] {
  const issues: Issue[] = [];
  const pairs = new Set<string>();
  for (const { unit: u } of scene.floor) {
    if (!u || !isWorkplace(u)) continue;
    const short = frontCheck(u, scene.near(frontStrip(u)));
    if (!short) continue;
    const { rule, other } = short;
    const measured = Math.round(short.measured);
    const required = Math.round(short.required);
    const itemIds = other ? [u.it.id, other.it.id] : [u.it.id];
    // One finding per gap: an aisle the unit across already reported, as an aisle or as its
    // door or pan needing more, is not reported again.
    const pair = other ? [u.it.id, other.it.id].sort().join(" ") : "";
    if (pair && pairs.has(pair)) continue;
    if (pair) pairs.add(pair);
    if (rule === "aisle" && other) {
      const [a, b] = [posOf(u.it.id), posOf(other.it.id)].sort((x, y) => x - y);
      issues.push({ key: "check.aisle", vars: { a, b, measured, required }, itemIds });
    } else {
      issues.push({ key: rule === "movement" || rule === "aisle" ? "check.movement" : FUNCTION_KEYS[rule], vars: { pos: posOf(u.it.id), measured, required }, itemIds });
    }
  }
  return issues;
}

/**
 * What is short in front of a workplace, or null when its free space is kept. Measured in cells
 * along the front up to the first floor unit, partition or wall (`frontProfile`):
 * - a function area (door, pan, rack trolley) as deep as the unit needs over its own width;
 * - a movement area `MOVEMENT_DEPTH` deep (`SHELF_AISLE` at shelving) and `MOVEMENT_WIDTH` wide
 *   with its middle in front of the unit; it may reach over the neighbours' fronts (the cook at a
 *   fryer stands partly in front of the next unit), and a dead corner beside the unit does not
 *   count against it;
 * - where the space ends at a workplace facing back, an aisle `AISLE_WIDTH` wide instead
 *   (`SHELF_AISLE` between two shelving rows).
 * A unit standing in another is the overlap finding's business, so that one is no obstacle here.
 */
function frontCheck(u: Unit, obstacles: Obstacle[]): FrontShort | null {
  const fn = functionArea(u);
  const profile = frontProfile(u, obstacles, frontReach(u));
  if (!profile) return null;
  const { xs, depth, by, own } = profile;
  // Nothing within reach, the usual case.
  if (depth.every((d) => d >= profile.reach)) return null;

  if (fn) {
    let worst = own[0];
    for (let c = own[0]; c < own[1]; c++) if (depth[c] < depth[worst]) worst = c;
    if (fn.depth - depth[worst] > TOLERANCE) return { rule: fn.kind, measured: depth[worst], required: fn.depth, other: by[worst] };
  }

  const facing = (o: Unit | undefined) => o !== undefined && isWorkplace(o) && angleDiff(u.it.rotation, o.it.rotation) >= FACING;
  // The depth each cell needs, by the unit that ends it; the same unit ends many cells in a row.
  const movement = movementDepth(u);
  const need: number[] = [];
  const shortBy: number[] = [];
  let anyShort = false;
  let last: Unit | undefined;
  let lastNeed = movement;
  for (let c = 0; c < depth.length; c++) {
    const o = by[c];
    if (o !== last) {
      last = o;
      lastNeed = o && facing(o) ? aisleWidth(u, o) : movement;
    }
    need.push(lastNeed);
    shortBy.push(lastNeed - depth[c]);
    if (lastNeed - depth[c] > TOLERANCE) anyShort = true;
  }
  // No cell short anywhere: no window can be.
  if (!anyShort) return null;
  const half = u.it.width / 2;
  // The window with the smallest shortfall. The worst cell in it only changes where one of its
  // ends crosses a cell bound, so windows starting or ending at a bound are all there is to try.
  // A window holds the cells it overlaps by more than TOLERANCE; its worst one is the first with
  // the largest shortfall. In each pass the windows move right, so the cells they hold are kept
  // in a queue, worst first (a sliding maximum): each cell enters and leaves it once.
  const n = depth.length;
  let best = Infinity;
  let bestCell = -1;
  const queue: number[] = [];
  for (let pass = 0; pass < 2; pass++) {
    queue.length = 0;
    let head = 0;
    let next = 0;
    for (const x of xs) {
      const s0 = pass === 0 ? x : x - MOVEMENT_WIDTH;
      const s1 = s0 + MOVEMENT_WIDTH;
      const mid = s0 + MOVEMENT_WIDTH / 2;
      if (mid < -half - TOLERANCE || mid > half + TOLERANCE || s0 < xs[0] - TOLERANCE || s1 > xs[xs.length - 1] + TOLERANCE) continue;
      const holds = (c: number) => Math.min(xs[c + 1], s1) - Math.max(xs[c], s0) > TOLERANCE;
      // Cells coming in at the right end; one the window does not reach far enough into yet
      // waits for the next window. A cell narrower than TOLERANCE is in no window at all, one
      // ending at the window's start (windows skipped since) in none of the windows to come.
      while (next < n && xs[next] < s1) {
        if (xs[next + 1] - xs[next] > TOLERANCE && xs[next + 1] - s0 > TOLERANCE) {
          if (!holds(next)) break;
          while (queue.length > head && shortBy[queue[queue.length - 1]] < shortBy[next]) queue.pop();
          queue.push(next);
        }
        next++;
      }
      // Cells left behind at the left end.
      while (queue.length > head && !holds(queue[head])) head++;
      if (queue.length === head) continue;
      const cell = queue[head];
      const short = shortBy[cell];
      if (short >= best) continue;
      if (short <= TOLERANCE) return null;
      best = short;
      bestCell = cell;
    }
  }
  if (bestCell < 0) return null;
  const other = by[bestCell];
  return { rule: facing(other) ? "aisle" : "movement", measured: depth[bestCell], required: need[bestCell], other };
}

/** How deep the free space in front of a unit is measured: as far as any of its rules asks, and 1 mm. */
const frontReach = (u: Unit) => Math.max(AISLE_WIDTH, MOVEMENT_DEPTH, functionArea(u)?.depth ?? 0) + 1;

/**
 * The strip in front of a unit that `frontProfile` looks at, in the unit's frame and as a plan
 * box. Deeper than the reach: a neighbour standing forward moves the start of the free space out.
 */
function frontStrip(u: Unit): Box {
  const { x0, x1, y0, y1 } = stripOf(u, frontReach(u));
  return bounds([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }].map((p) => toPlanOf(u.it, p)));
}

function stripOf(u: Unit, reach: number) {
  const { it } = u;
  return { x0: -it.width / 2 - MOVEMENT_WIDTH / 2, x1: it.width / 2 + MOVEMENT_WIDTH / 2, y0: it.depth / 2, y1: it.depth / 2 + reach + MOVEMENT_DEPTH };
}

/**
 * The free depth in front of a unit, cell by cell, up to `reach`, and the unit that ends it in
 * each cell (none for a wall or free space). The cells run along the front from about half a
 * movement area left of the unit to as far right of it; `xs` are their bounds in the unit's
 * frame, `own` the range of cells in front of the unit itself. Beside the unit, a neighbour
 * standing against it that reaches further forward (a plate dispenser between deeper counters)
 * only moves the start of the free space out to its front. Units and partitions reaching less
 * than `EDGE` past the front line stand beside or behind it; a wall on the front line closes it.
 * Null when the unit is too narrow to measure, or when nothing comes within `reach`.
 */
function frontProfile(u: Unit, obstacles: Obstacle[], reach: number): { xs: number[]; depth: number[]; by: (Unit | undefined)[]; own: [number, number]; reach: number } | null {
  const { it } = u;
  const a = -it.width / 2 + EDGE;
  const b = it.width / 2 - EDGE;
  if (b <= a) return null;
  const { x0, x1, y0, y1 } = stripOf(u, reach);
  const toLocal = localFrame(it);
  const stripBox = bounds([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }].map((p) => toPlanOf(it, p)));
  const hits: { pts: Vec2[]; lo: number; hi: number; near: number; far: number; slant: boolean; unit?: Unit; beside: boolean; area: boolean }[] = [];
  const cuts = [x0, a, b, x1];
  for (const o of obstacles) {
    if (o.unit?.it.id === it.id || !boxesMeet(o.box, stripBox)) continue;
    const local = o.pts.map(toLocal);
    const lb = bounds(local);
    if (lb.maxX < x0 || lb.minX > x1 || lb.maxY < y0 - ON_LINE || lb.minY > y1) continue;
    // Turned against the unit, its distance changes along the front: clipped and measured in
    // steps. Square to it, what lies in the strip is its box cut to the strip.
    const slant = slanted(local);
    const pts = slant ? clipRect(local, x0, x1, y0 - ON_LINE, y1) : local;
    if (pts.length === 0 || (o.unit && boxesMeet(o.box, u.box) && convexOverlap(u.fp, o.unit.fp))) continue;
    const pb = slant ? bounds(pts) : lb;
    const lo = Math.max(x0, pb.minX);
    const hi = Math.min(x1, pb.maxX);
    const near = Math.max(y0 - ON_LINE, pb.minY) - y0;
    const far = Math.min(y1, pb.maxY) - y0;
    // Only a neighbour beside the unit moves the start of the free space, and only beside it.
    const beside = o.unit !== undefined && (lo < a || hi > b) && touching(o.unit, u);
    hits.push({ pts, lo, hi, near, far, slant, unit: o.unit, beside, area: o.pts.length > 2 });
    cuts.push(lo, hi);
  }
  // How far in front an obstacle can still shorten the free space: the reach, past the start
  // that a neighbour beside the unit moves out.
  let limit = reach;
  for (const h of hits) if (h.beside) limit = Math.max(limit, reach + h.far);
  // Nothing within it: the whole reach is free, as the cells would say, without making them.
  if (hits.every((h) => !h.beside && h.near >= limit)) return null;
  // Slanted obstacles are measured in CELL steps, on one grid in the unit's frame so obstacles
  // side by side share their cells: the ranges of grid indices they span. Only over the part that
  // comes within the limit, bounded by cuts of its own: beyond it a single cell says the same.
  const steps: [number, number][] = [];
  for (const h of hits) {
    if (!h.slant || h.near >= limit) continue;
    let [lo, hi] = [h.lo, h.hi];
    if (h.far > limit) {
      const wb = bounds(clipRect(h.pts, x0, x1, y0 - ON_LINE, y0 + limit));
      lo = Math.max(lo, wb.minX);
      hi = Math.min(hi, wb.maxX);
      cuts.push(lo, hi);
    }
    steps.push([Math.floor(lo / CELL) + 1, Math.ceil(hi / CELL) - 1]);
  }
  // The cell bounds: the obstacle edges and the grid steps, sorted. The steps come sorted from
  // their ranges and are merged in; sorting them along with the edges was the largest part of the
  // whole plan check once units stand turned against each other.
  sortSmall(cuts, (x) => x);
  sortSmall(steps, (r) => r[0]);
  const grid: number[] = [];
  let nextStep = -Infinity;
  for (const [k0, k1] of steps) {
    for (let k = Math.max(k0, nextStep); k <= k1; k++) grid.push(k * CELL);
    nextStep = Math.max(nextStep, k1 + 1);
  }
  const xs: number[] = [];
  const keep = (x: number) => {
    if (xs.length === 0 || x - xs[xs.length - 1] > TOLERANCE / 10) xs.push(x);
  };
  for (let i = 0, j = 0; i < cuts.length || j < grid.length; ) {
    if (j >= grid.length || (i < cuts.length && cuts[i] <= grid[j])) keep(cuts[i++]);
    else keep(grid[j++]);
  }
  const n = xs.length - 1;
  const end = new Array<number>(n).fill(Infinity);
  const start = new Array<number>(n).fill(0);
  const by = new Array<Unit | undefined>(n).fill(undefined);
  let ownFrom = n;
  let ownTo = 0;
  const isOwn: boolean[] = [];
  for (let c = 0; c < n; c++) {
    const mid = (xs[c] + xs[c + 1]) / 2;
    isOwn.push(mid > a && mid < b);
    if (isOwn[c]) {
      ownFrom = Math.min(ownFrom, c);
      ownTo = c + 1;
    }
  }
  // Each obstacle only over the cells it spans (a slanted one cuts many cells of its own).
  for (const h of hits) {
    // The outline is already cut to the strip: only its part over each cell is left.
    const spans = h.slant ? stripeSpans(h.pts) : null;
    for (let c = firstCellTo(xs, h.lo); c < n && xs[c] < h.hi; c++) {
      if (Math.min(xs[c + 1], h.hi) - Math.max(xs[c], h.lo) <= TOLERANCE / 10) continue;
      const own = isOwn[c];
      let { near, far } = h;
      if (spans) {
        if (!spans(Math.max(xs[c], h.lo), Math.min(xs[c + 1], h.hi))) continue;
        near = SPAN.min - y0;
        far = SPAN.max - y0;
      }
      // An outline only touching the front line lies behind it; a wall on that line closes it.
      if (h.area && far < EDGE) continue;
      if (h.beside && !own) start[c] = Math.max(start[c], far);
      else if (near < end[c]) {
        end[c] = near;
        by[c] = h.unit;
      }
    }
  }
  const depth = end.map((e, c) => Math.min(reach, Math.max(0, e - start[c])));
  return { xs, depth, by, own: [ownFrom, ownTo], reach };
}

/**
 * Sorts a short list in place by `key`, ascending (insertion sort, stable): a handful of cell
 * bounds per unit, where `Array.prototype.sort` with a comparator costs more than the sorting.
 */
function sortSmall<T>(list: T[], key: (v: T) => number): void {
  for (let i = 1; i < list.length; i++) {
    const v = list[i];
    const k = key(v);
    let j = i - 1;
    while (j >= 0 && key(list[j]) > k) {
      list[j + 1] = list[j];
      j--;
    }
    list[j + 1] = v;
  }
}

/** The first cell of the bounds `xs` that ends after `x` (binary search; `xs.length - 1` when none does). */
function firstCellTo(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid + 1] > x) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

// --- Free space in front of doors -------------------------------------------------------------

/** The strip `DOOR_APPROACH_DEPTH` deep in front of one side of a door: its own frame (x across the opening, y away from it), width and plan box. */
interface Approach {
  toLocal: (p: Vec2) => Vec2;
  width: number;
  box: Box;
}

/**
 * The approach strips of every door and passage: on the room side of one in an outer wall, on
 * both sides of one in a partition, as wide as the opening.
 */
function approaches(project: Project): Approach[] {
  const out: Approach[] = [];
  for (const o of project.room.openings) {
    if (!isDoor(o) && o.kind !== "passage") continue;
    const at = openingFrame(project.room, o);
    if (!at) continue;
    const { frame } = at;
    const faces: { origin: Vec2; normal: Vec2 }[] = [{ origin: add(frame.start, frame.normal, frame.near), normal: frame.normal }];
    if (o.partition !== undefined) {
      const back = { x: -frame.normal.x, y: -frame.normal.y };
      faces.push({ origin: add(frame.start, back, -frame.far), normal: back });
    }
    const width = dist(frame.start, frame.end);
    for (const { origin, normal } of faces) {
      const toLocal = (p: Vec2): Vec2 => {
        const d = sub(p, origin);
        return { x: dot(d, frame.dir), y: dot(d, normal) };
      };
      const far = add(origin, frame.dir, width);
      out.push({ toLocal, width, box: bounds([origin, far, add(far, normal, DOOR_APPROACH_DEPTH), add(origin, normal, DOOR_APPROACH_DEPTH)]) });
    }
  }
  return out;
}

/** How close to the door a floor unit stands in its approach strip, or null when it keeps the strip free. */
function approachDepth(a: Approach, ob: Obstacle): number | null {
  if (!boxesMeet(ob.box, a.box)) return null;
  const inStrip = clipRect(ob.pts.map(a.toLocal), EDGE, a.width - EDGE, EDGE, DOOR_APPROACH_DEPTH);
  if (inStrip.length === 0) return null;
  let d = Infinity;
  for (const p of inStrip) d = Math.min(d, p.y);
  return DOOR_APPROACH_DEPTH - d > TOLERANCE ? Math.max(0, d) : null;
}

/**
 * Floor units within `DOOR_APPROACH_DEPTH` of a door or passage, on every side of it that lies in
 * the room, across the opening's width; each unit once, with its smallest distance. Units already
 * reported in a door's swing area are not reported again.
 */
function doorApproachIssues(scene: Scene, skip: ReadonlySet<string>, posOf: (id: string) => number): Issue[] {
  const issues: Issue[] = [];
  for (const ob of scene.floor) {
    const u = ob.unit;
    if (!u || skip.has(u.it.id)) continue;
    let d = Infinity;
    for (const a of scene.approaches) d = Math.min(d, approachDepth(a, ob) ?? Infinity);
    if (d < Infinity) issues.push({ key: "check.doorApproach", vars: { pos: posOf(u.it.id), measured: Math.round(d), required: DOOR_APPROACH_DEPTH }, itemIds: [u.it.id] });
  }
  return issues;
}

// --- Hoods ------------------------------------------------------------------------------------

/** Points sampled along each side of a unit for the hood's overhang (fractions of the side). */
const SAMPLES = [0, 0.25, 0.5, 0.75, 1];

/** The sides of a unit in its own frame: the outward normal and the side's ends. */
function sides(w: number, d: number): { side: "back" | "front" | "side"; n: Vec2; a: Vec2; b: Vec2 }[] {
  const x = w / 2 - EDGE;
  const y = d / 2 - EDGE;
  return [
    { side: "front", n: { x: 0, y: 1 }, a: { x: -x, y: d / 2 }, b: { x, y: d / 2 } },
    { side: "back", n: { x: 0, y: -1 }, a: { x: -x, y: -d / 2 }, b: { x, y: -d / 2 } },
    { side: "side", n: { x: -1, y: 0 }, a: { x: -w / 2, y: -y }, b: { x: -w / 2, y } },
    { side: "side", n: { x: 1, y: 0 }, a: { x: w / 2, y: -y }, b: { x: w / 2, y } },
  ];
}

const HOOD_KEYS = { front: "check.hoodFront", back: "check.hoodBack", side: "check.hoodSide" } as const;

/** Does a cooking unit need a hood above it? */
const needsHood = (u: Unit) => u.category === "cooking" && (u.placement === "floor" || u.placement === "tableTop") && !NO_HOOD_KINDS.has(u.kind);

/**
 * Every cooking unit that needs one stands under a hood (`HOOD_KINDS`, hanging above its top)
 * that overhangs it by `HOOD_OVERHANG` on every side, `HOOD_OVERHANG_DOOR` at the front of a
 * unit with a steaming door. Hoods side by side count as one. A side needs only as much as there
 * is room before a wall or a partition at least `WALL_HEIGHT` high. The overhang is measured
 * outwards from points along each side; a negative value means the hood ends that far inside the
 * unit. A condensing hood on an oven it serves, or a downdraft module beside the unit, replaces
 * the canopy for it.
 */
function hoodIssues(units: Unit[], walls: Obstacle[], posOf: (id: string) => number): Issue[] {
  const hoods = units.filter((u) => u.placement === "overhead" && HOOD_KINDS.has(u.kind));
  const condensing = units.filter((u) => u.kind === CONDENSING_HOOD_KIND);
  const downdrafts = units.filter((u) => u.kind === DOWNDRAFT_KIND);
  const issues: Issue[] = [];
  for (const u of units) {
    if (!needsHood(u)) continue;
    const { it } = u;
    if (CONDENSING_HOOD_SERVES.has(u.kind) && condensing.some((h) => boxesMeet(h.box, u.box) && convexOverlap(h.fp, u.fp))) continue;
    if (downdrafts.some((m) => touching(m, u))) continue;
    const top = it.elevation + it.height;
    const above = hoods.filter((h) => h.it.elevation >= top - TOLERANCE && boxesMeet(h.box, u.box) && convexOverlap(h.fp, u.fp));
    if (above.length === 0) {
      issues.push({ key: "check.hoodMissing", vars: { pos: posOf(it.id) }, itemIds: [it.id] });
      continue;
    }
    const toLocal = localFrame(it);
    const local = above.map((h) => h.fp.map(toLocal));
    const nearWalls = walls.filter((w) => boxesMeet(w.box, grow(u.box, HOOD_OVERHANG_DOOR))).map((w) => w.pts.map(toLocal));
    let worst: { side: "back" | "front" | "side"; measured: number; required: number; hood: number; short: number } | null = null;
    for (const s of sides(it.width, it.depth)) {
      const required = s.side === "front" && STEAM_DOOR_KINDS.has(u.kind) ? HOOD_OVERHANG_DOOR : HOOD_OVERHANG;
      const inward = s.side === "side" ? it.width : it.depth;
      // The usual case first: one hood reaches over the whole side and the overhang beyond it.
      const outA = add(s.a, s.n, required);
      const outB = add(s.b, s.n, required);
      if (local.some((h) => insideConvex(s.a, h) && insideConvex(s.b, h) && insideConvex(outA, h) && insideConvex(outB, h))) continue;
      for (const f of SAMPLES) {
        const p = { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
        const need = Math.min(required, wallDistance(p, s.n, nearWalls));
        const cover = overhang(p, s.n, local, inward);
        if (!cover) continue;
        const short = need - cover.measured;
        if (short > TOLERANCE && (!worst || short > worst.short)) worst = { side: s.side, measured: cover.measured, required: need, hood: cover.hood, short };
      }
    }
    if (worst) {
      issues.push({
        key: HOOD_KEYS[worst.side],
        vars: { pos: posOf(it.id), hood: posOf(above[worst.hood].it.id), measured: Math.round(worst.measured), required: Math.round(worst.required) },
        itemIds: [it.id, ...above.map((h) => h.it.id)],
      });
    }
  }
  return issues;
}

/**
 * How far the hoods reach beyond the point `p` on a side, along its outward normal `n` (from
 * where the line enters them inside the unit, `inward` deep, through hoods touching each other):
 * the reach if they cover `p`, else minus how far inside the unit they end. Null when no hood
 * lies on that line at all; the hood that gives the value.
 */
function overhang(p: Vec2, n: Vec2, hoods: Vec2[][], inward: number): { measured: number; hood: number } | null {
  const spans: { t0: number; t1: number; hood: number }[] = [];
  hoods.forEach((h, i) => {
    const s = lineThrough(p, n, h);
    if (s && s[1] >= -inward) spans.push({ t0: s[0], t1: s[1], hood: i });
  });
  spans.sort((a, b) => a.t0 - b.t0);
  // Spans that meet are one stretch under the hoods; it ends with the span reaching furthest.
  const merged: { t0: number; t1: number; hood: number }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.t0 <= last.t1 + TOLERANCE) {
      if (s.t1 > last.t1) merged[merged.length - 1] = { t0: last.t0, t1: s.t1, hood: s.hood };
    } else merged.push({ ...s });
  }
  // The hoods are grown by `HOOD_PLAY` to join; the measured edge is the real one.
  const over = merged.find((m) => m.t0 <= TOLERANCE && m.t1 >= -TOLERANCE);
  if (over) return { measured: over.t1 - HOOD_PLAY, hood: over.hood };
  // Not covered at p: the nearest end of a hood inside the unit.
  let end: (typeof merged)[number] | null = null;
  for (const m of merged) if (m.t1 < 0 && (!end || m.t1 > end.t1)) end = m;
  return end ? { measured: end.t1 - HOOD_PLAY, hood: end.hood } : null;
}

/** Is `p` inside a convex polygon grown by `HOOD_PLAY`? */
function insideConvex(p: Vec2, poly: Vec2[]): boolean {
  const orient = signedArea(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const e = sub(poly[(i + 1) % poly.length], a);
    if (orient * cross(e, sub(p, a)) < -HOOD_PLAY * Math.hypot(e.x, e.y)) return false;
  }
  return true;
}

/** Distance from `p` along `n` to the first wall (segment or partition outline); 0 when it starts in one. */
function wallDistance(p: Vec2, n: Vec2, walls: Vec2[][]): number {
  let best = Infinity;
  for (const w of walls) {
    if (w.length === 2) {
      const t = rayHitsSegment(p, n, w[0], w[1]);
      if (t !== null) best = Math.min(best, Math.max(0, t));
    } else {
      const s = lineThrough(p, n, w);
      if (s && s[1] >= 0) best = Math.min(best, Math.max(0, s[0]));
    }
  }
  return best;
}

/** Where the ray p + t·n meets the segment a–b (t from -TOLERANCE on), or null. */
function rayHitsSegment(p: Vec2, n: Vec2, a: Vec2, b: Vec2): number | null {
  const ab = sub(b, a);
  const den = cross(n, ab);
  if (Math.abs(den) < EPS) return null;
  const ap = sub(a, p);
  const t = cross(ap, ab) / den;
  const u = cross(ap, n) / den;
  return t >= -TOLERANCE && u >= 0 && u <= 1 ? t : null;
}

/** How much hoods are grown so that hoods meeting edge to edge leave no gap (mm). */
const HOOD_PLAY = 0.5;

/**
 * The parameter range [t0, t1] of the line p + t·n inside a convex polygon grown by `HOOD_PLAY`
 * (so hoods meeting edge to edge leave no gap), or null.
 */
function lineThrough(p: Vec2, n: Vec2, poly: Vec2[]): [number, number] | null {
  const orient = signedArea(poly) >= 0 ? 1 : -1;
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const e = sub(poly[(i + 1) % poly.length], a);
    const l = Math.hypot(e.x, e.y);
    if (l < EPS) continue;
    // Inside: orient·cross(e, x − a) ≥ −HOOD_PLAY·l, linear in t.
    const f0 = orient * cross(e, sub(p, a)) + HOOD_PLAY * l;
    const f1 = orient * cross(e, n);
    if (Math.abs(f1) < EPS) {
      if (f0 < 0) return null;
      continue;
    }
    const t = -f0 / f1;
    if (f1 > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

/** Where `stripeSpans` leaves its result: no object per cell in the plan check's innermost loop. */
const SPAN = { min: 0, max: 0 };

/**
 * The lowest and highest y of a convex polygon (or a segment) over stripes lo ≤ x ≤ hi, asked
 * for from left to right: the same as clipping it to each stripe and taking the clipped points'
 * y, without building the clipped polygons. The extremes lie on a stripe's two edges or at a
 * corner between them; a stripe starting where the one before ended reuses that edge. Each call
 * leaves its result in `SPAN` and says whether the polygon has anything in the stripe.
 */
function stripeSpans(pts: Vec2[]): (lo: number, hi: number) => boolean {
  const n = pts.length;
  // A segment has one edge, a polygon closes back to its first corner.
  const edges = n === 2 ? 1 : n;
  const corners = [...pts];
  sortSmall(corners, (p) => p.x);
  let next = 0;
  // The span on the line at `x`: where the edges meet it.
  let atX = NaN;
  let atMin = Infinity;
  let atMax = -Infinity;
  const at = (x: number) => {
    atX = x;
    atMin = Infinity;
    atMax = -Infinity;
    for (let i = 0; i < edges; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      if ((p.x - x) * (q.x - x) > 0) continue;
      let y0 = p.y;
      let y1 = q.y;
      if (p.x !== q.x) y0 = y1 = p.y + ((q.y - p.y) * (x - p.x)) / (q.x - p.x);
      if (y0 < atMin) atMin = y0;
      if (y0 > atMax) atMax = y0;
      if (y1 < atMin) atMin = y1;
      if (y1 > atMax) atMax = y1;
    }
  };
  return (lo, hi) => {
    if (hi < lo) return false;
    if (atX !== lo) at(lo);
    let min = atMin;
    let max = atMax;
    // Corners strictly inside the stripe; the stripes come left to right.
    while (next < corners.length && corners[next].x <= lo) next++;
    for (let k = next; k < corners.length && corners[k].x < hi; k++) {
      if (corners[k].y < min) min = corners[k].y;
      if (corners[k].y > max) max = corners[k].y;
    }
    at(hi);
    if (atMin < min) min = atMin;
    if (atMax > max) max = atMax;
    SPAN.min = min;
    SPAN.max = max;
    return min <= max;
  };
}

/** Does an outline (in a unit's frame) have an edge that is neither along nor across the unit? */
function slanted(pts: Vec2[]): boolean {
  for (let i = 0; i < pts.length; i++) {
    const q = pts[(i + 1) % pts.length];
    if (Math.abs(q.x - pts[i].x) > TOLERANCE && Math.abs(q.y - pts[i].y) > TOLERANCE) return true;
  }
  return false;
}

/** Do two units touch or overlap (2 mm of play)? */
function touching(a: Unit, b: Unit): boolean {
  return boxesMeet(grow(a.box, 2), b.box) && convexOverlap(grown(a.it, 2), b.fp);
}

// --- Hand-wash basins -------------------------------------------------------------------------

const isBasin = (u: Unit) => HANDWASH_KINDS.has(u.kind);
const isProduction = (u: Unit) =>
  u.placement === "floor" && u.category !== undefined && PRODUCTION_CATEGORIES.has(u.category) && !(u.group && NOT_PRODUCTION_GROUPS.has(u.group)) && !isBasin(u);

/**
 * Every production unit has a hand-wash basin within `HANDWASH_DISTANCE` (centre to centre) in
 * its own area: the line to it crosses no partition at least `WALL_HEIGHT` high, so the dish
 * wash behind its door needs its own basin. A plan with production units and no basin at all
 * gets one finding for the whole plan.
 */
function handwashIssues(units: Unit[], parts: Partition[], posOf: (id: string) => number): Issue[] {
  const production = units.filter(isProduction);
  if (production.length === 0) return [];
  const basins = units.filter(isBasin);
  // About the plan, not a unit: marking every production unit would drown the plan in warnings.
  if (basins.length === 0) return [{ key: "check.handwashNone", vars: {}, itemIds: [] }];
  const issues: Issue[] = [];
  for (const u of production) {
    const c = { x: u.it.x, y: u.it.y };
    // The nearest by the squared distance (no square root per basin), measured once at the end.
    let best: Unit | null = null;
    let bestSq = Infinity;
    for (const b of basins) {
      const dx = b.it.x - c.x;
      const dy = b.it.y - c.y;
      const sq = dx * dx + dy * dy;
      if (sq >= bestSq) continue;
      const q = { x: b.it.x, y: b.it.y };
      if (parts.some((p) => segmentsCross(c, q, p.a, p.b))) continue;
      best = b;
      bestSq = sq;
    }
    if (!best) issues.push({ key: "check.handwashArea", vars: { pos: posOf(u.it.id) }, itemIds: [u.it.id] });
    else {
      const d = dist(c, { x: best.it.x, y: best.it.y });
      if (d > HANDWASH_DISTANCE + TOLERANCE) {
        issues.push({
          key: "check.handwashFar",
          vars: { pos: posOf(u.it.id), basin: posOf(best.it.id), measured: Math.round(d), required: HANDWASH_DISTANCE },
          itemIds: [u.it.id, best.it.id],
        });
      }
    }
  }
  return issues;
}

/** Do the segments p–q and a–b cross (touching at an end counts)? */
function segmentsCross(p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean {
  const d1 = cross(sub(q, p), sub(a, p));
  const d2 = cross(sub(q, p), sub(b, p));
  const d3 = cross(sub(b, a), sub(p, a));
  const d4 = cross(sub(b, a), sub(q, a));
  return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0);
}

// --- Geometry helpers -------------------------------------------------------------------------

/** Side of the squares of the obstacle grid (mm): about a unit and its free space. */
const GRID = 2000;

/**
 * A lookup of the obstacles whose boxes may meet a box, through a grid of `GRID` squares, so a
 * large plan does not test every unit against every other. The result keeps the list order.
 */
function gridOf(obstacles: Obstacle[]): (box: Box) => Obstacle[] {
  const cells = new Map<number, number[]>();
  // Plans stay well within ±100 km (`MAX_LENGTH`), so one number keys a square.
  const key = (gx: number, gy: number) => gx * 1e5 + gy;
  const span = (b: Box) => [Math.floor(b.minX / GRID), Math.floor(b.maxX / GRID), Math.floor(b.minY / GRID), Math.floor(b.maxY / GRID)];
  obstacles.forEach((o, i) => {
    const [x0, x1, y0, y1] = span(o.box);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const list = cells.get(key(gx, gy));
        if (list) list.push(i);
        else cells.set(key(gx, gy), [i]);
      }
    }
  });
  // Each lookup marks the obstacles it found with its own number, so one in several squares is
  // taken once (cheaper than a Set for the few dozen a lookup finds).
  const seen = new Uint32Array(obstacles.length);
  let lookup = 0;
  return (box) => {
    const [x0, x1, y0, y1] = span(box);
    lookup++;
    const found: number[] = [];
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const list = cells.get(key(gx, gy));
        if (!list) continue;
        for (const i of list) {
          if (seen[i] === lookup) continue;
          seen[i] = lookup;
          found.push(i);
        }
      }
    }
    if (found.length > 64) found.sort((a, b) => a - b);
    else sortSmall(found, (i) => i);
    const out: Obstacle[] = new Array(found.length);
    for (let k = 0; k < found.length; k++) out[k] = obstacles[found[k]];
    return out;
  };
}

const add = (p: Vec2, dir: Vec2, k: number): Vec2 => ({ x: p.x + dir.x * k, y: p.y + dir.y * k });

/** Plan points into an item's own frame: x along its width, y towards its front. */
function localFrame(it: Pick<Item, "x" | "y" | "rotation">): (p: Vec2) => Vec2 {
  const sx = sideOf(it.rotation);
  const fy = frontOf(it.rotation);
  return (p) => {
    const d = { x: p.x - it.x, y: p.y - it.y };
    return { x: dot(d, sx), y: dot(d, fy) };
  };
}

/** A point of an item's own frame on the plan. */
function toPlanOf(it: Pick<Item, "x" | "y" | "rotation">, p: Vec2): Vec2 {
  const sx = sideOf(it.rotation);
  const fy = frontOf(it.rotation);
  return { x: it.x + sx.x * p.x + fy.x * p.y, y: it.y + sx.y * p.x + fy.y * p.y };
}

/** The footprint of an item grown by `k` on every side. */
function grown(it: Item, k: number): Vec2[] {
  const w = it.width / 2 + k;
  const d = it.depth / 2 + k;
  return [
    { x: -w, y: -d },
    { x: w, y: -d },
    { x: w, y: d },
    { x: -w, y: d },
  ].map((p) => toPlanOf(it, p));
}

const grow = (b: Box, k: number): Box => ({ ...b, minX: b.minX - k, minY: b.minY - k, maxX: b.maxX + k, maxY: b.maxY + k });

const boxesMeet = (a: Box, b: Box) => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/**
 * A convex polygon (or a segment, as two points) clipped to the rectangle x0..x1 × y0..y1
 * (Sutherland–Hodgman); empty when nothing of it lies inside.
 */
function clipRect(poly: Vec2[], x0: number, x1: number, y0: number, y1: number): Vec2[] {
  let out = clipAt(poly, true, x0, 1);
  out = clipAt(out, true, x1, -1);
  out = clipAt(out, false, y0, 1);
  return clipAt(out, false, y1, -1);
}

/**
 * One step of the clipping: keep where sign · (x − v) ≥ 0, or y when `onX` is false. One function
 * for the four sides rather than two closures per side: the plan check clips often.
 */
function clipAt(poly: Vec2[], onX: boolean, v: number, sign: 1 | -1): Vec2[] {
  if (poly.length === 0) return poly;
  const inside = (p: Vec2) => sign * ((onX ? p.x : p.y) - v);
  // A segment is not closed: clip it as one edge.
  const closed = poly.length > 2;
  if (!closed && poly.length === 1) return inside(poly[0]) >= 0 ? poly : [];
  const m = closed ? poly.length : poly.length - 1;
  const out: Vec2[] = [];
  for (let i = 0; i < m; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia >= 0) out.push(a);
    if ((ia >= 0) !== (ib >= 0)) {
      const t = onX ? (v - a.x) / (b.x - a.x) : (v - a.y) / (b.y - a.y);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    if (!closed && i === m - 1 && ib >= 0) out.push(b);
  }
  return out;
}
