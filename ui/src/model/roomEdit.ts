// Editing the room in the room mode: adding, moving and removing corners, moving partitions and
// openings, keeping the openings on their walls while the walls change, and the selection math
// of the room mode (hit testing, frame selection). Pure functions over the model; the room mode
// of the plan (views/RoomEditLayer.tsx) and the inspector call them.
//
// Openings with a `partition` sit in that partition; everything about outer walls ignores them.

import { add, area, clampOpening, cross, dist, distToSegment, dot, norm, scale, sub, walls, type Box } from "./geometry";
import { clampPartitionOpening, partitionLength } from "./partitions";
import type { Opening, OpeningKind, Partition, Room, Vec2 } from "./types";

/** Smallest distance (mm) of a new corner from the ends of the wall it splits. */
export const MIN_CORNER_GAP = 50;
/**
 * Corners closer than this (mm) count as one spot. A wall that short has no usable direction:
 * snapping, the wall drawing and the openings on it all need a real length.
 */
export const COINCIDENT_DISTANCE = 1;
/** Smallest floor area (mm², 100 × 100 mm) of a room; anything smaller is a degenerate outline. */
export const MIN_ROOM_AREA = 10_000;
/** Shortest partition (mm). */
export const MIN_PARTITION_LENGTH = 100;

const round1 = (v: number) => Math.round(v * 10) / 10;
const roundPt = (p: Vec2): Vec2 => ({ x: round1(p.x), y: round1(p.y) });
const inWall = (o: Opening) => !o.partition;

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
    if (!inWall(o)) return o;
    if (o.wall > index) return { ...o, wall: o.wall + 1 };
    if (o.wall === index && o.offset > along) return { ...o, wall: index + 1, offset: o.offset - along };
    return o;
  });
  const next = { ...room, points };
  const openings = moved.map((o) => (inWall(o) && (o.wall === index || o.wall === index + 1) ? clampOpening(next, o) : o));
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
  return { ...moved, openings: room.openings.map((o) => (inWall(o) && (o.wall === index || o.wall === before) ? clampOpening(moved, o) : o)) };
}

/**
 * The room with the corners `indices` moved by `delta` (a selection grabbed with G). Unchanged
 * when the result is no room (a corner on another one, walls crossing, no floor left): such an
 * outline would be saved but could not be opened again. The openings of every wall touching a moved
 * corner are clamped to their new lengths; a wall whose both corners move keeps its openings.
 */
export function moveCorners(room: Room, indices: readonly number[], delta: Vec2): Room {
  const n = room.points.length;
  const moving = new Set(indices.filter((i) => i >= 0 && i < n));
  if (moving.size === 0 || (delta.x === 0 && delta.y === 0)) return room;
  const points = room.points.map((p, i) => (moving.has(i) ? roundPt(add(p, delta)) : p));
  if (!isValidOutline(points)) return room;
  const next = { ...room, points };
  const touched = (w: number) => moving.has(w) || moving.has((w + 1) % n);
  return { ...next, openings: room.openings.map((o) => (inWall(o) && touched(o.wall) ? clampOpening(next, o) : o)) };
}

/**
 * The room without the corners `indices`, or null when fewer than three corners would remain or
 * the outline would cross itself or enclose no floor. Openings follow their wall: an opening on
 * a wall that merges with its neighbour keeps its place on the plan, projected onto the merged
 * wall and clamped into it; one wider than its new wall is dropped.
 */
export function removeCorners(room: Room, indices: readonly number[]): Room | null {
  const n = room.points.length;
  const gone = new Set(indices);
  const kept: number[] = [];
  for (let i = 0; i < n; i++) if (!gone.has(i)) kept.push(i);
  if (kept.length === n) return room;
  if (kept.length < 3) return null;
  const points = kept.map((i) => room.points[i]);
  if (!isValidOutline(points)) return null;
  const next = { ...room, points };
  const nextWalls = walls(next);
  const oldWalls = walls(room);
  // newWallOf[i]: the new wall that old wall i becomes part of (it starts at the last kept corner at or before i).
  const newWallOf: number[] = [];
  for (let i = 0; i < n; i++) {
    let j = i;
    while (gone.has(j)) j = (j + n - 1) % n;
    newWallOf.push(kept.indexOf(j));
  }
  const openings: Opening[] = [];
  for (const o of room.openings) {
    if (!inWall(o)) {
      openings.push(o);
      continue;
    }
    const ow = oldWalls[o.wall];
    if (!ow) continue;
    const centre = add(ow.a, scale(ow.dir, o.offset));
    const nw = nextWalls[newWallOf[o.wall]];
    if (o.width > nw.length) continue;
    openings.push(clampOpening(next, { ...o, wall: nw.index, offset: round1(dot(sub(centre, nw.a), nw.dir)) }));
  }
  return { ...next, openings };
}

/**
 * The room with wall `index` set to `length` mm: its end corner moves along the wall's direction
 * (the start corner stays). Unchanged when the length is not positive or the result is no room.
 */
export function setWallLength(room: Room, index: number, length: number): Room {
  const w = walls(room)[index];
  if (!w || !(length >= COINCIDENT_DISTANCE)) return room;
  const next = moveCorner(room, (index + 1) % room.points.length, roundPt(add(w.a, scale(w.dir, length))));
  return isValidOutline(next.points) ? next : room;
}

/** The direction angle of a line from `a` to `b` in degrees, [0, 360): 0 east, clockwise on the plan. */
export function lineAngle(a: Vec2, b: Vec2): number {
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const r = Math.round(((deg % 360) + 360) % 360 * 10) / 10;
  return r === 360 ? 0 : r;
}

/** Do the segments a-b and c-d cross or touch? */
function segmentsMeet(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p: Vec2, q: Vec2, r: Vec2, o: number) =>
    Math.abs(o) < 1e-9 && Math.min(p.x, q.x) - 1e-9 <= r.x && r.x <= Math.max(p.x, q.x) + 1e-9 && Math.min(p.y, q.y) - 1e-9 <= r.y && r.y <= Math.max(p.y, q.y) + 1e-9;
  return on(a, b, c, d1) || on(a, b, d, d2) || on(c, d, a, d3) || on(c, d, b, d4);
}

/** Does the closed outline cross itself: non-neighbouring walls meeting, or a wall folding back on its neighbour? */
export function selfIntersects(points: readonly Vec2[]): boolean {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Neighbouring walls share a corner; the first and the last are neighbours too.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsMeet(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n];
    const b = points[i];
    const c = points[(i + 1) % n];
    if (Math.abs(cross(sub(b, a), sub(c, b))) < 1e-9 && dot(sub(b, a), sub(c, b)) < 0) return true;
  }
  return false;
}

/** Does the outline enclose a floor: at least three corners and more than a sliver of area? */
export function isUsableOutline(points: readonly Vec2[]): boolean {
  return points.length >= 3 && area(points) >= MIN_ROOM_AREA;
}

/** Is the outline a room: usable, no wall without length and no crossing walls? */
export function isValidOutline(points: readonly Vec2[]): boolean {
  if (!isUsableOutline(points)) return false;
  for (let i = 0; i < points.length; i++) if (dist(points[i], points[(i + 1) % points.length]) < COINCIDENT_DISTANCE) return false;
  return !selfIntersects(points);
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
    if (!inWall(o)) {
      openings.push(o);
      continue;
    }
    const from = group[o.wall];
    const to = group[(o.wall + 1) % n];
    // A wall whose ends merged into one corner had no length.
    if (from === to) continue;
    openings.push(clampOpening(next, { ...o, wall: from }));
  }
  return { ...next, openings };
}

// Partitions.

export { partitionLength };

/** An opening clamped into its host: its partition or its outer wall. */
export function clampToHost(room: Room, o: Opening): Opening {
  if (!o.partition) return clampOpening(room, o);
  const p = room.partitions.find((w) => w.id === o.partition);
  return p ? clampPartitionOpening(p, o) : o;
}

/** The room with partition `id` replaced by `next`; its openings clamped into the new length. */
export function updatePartition(room: Room, id: string, patch: Partial<Partition>): Room {
  const partitions = room.partitions.map((p) => (p.id === id ? { ...p, ...patch } : p));
  const p = partitions.find((w) => w.id === id);
  if (!p || partitionLength(p) < MIN_PARTITION_LENGTH) return room;
  return { ...room, partitions, openings: room.openings.map((o) => (o.partition === id ? clampPartitionOpening(p, o) : o)) };
}

/** The room with partition `id` set to `length` mm: its end b moves along the a-to-b direction. */
export function setPartitionLength(room: Room, id: string, length: number): Room {
  const p = room.partitions.find((w) => w.id === id);
  if (!p || !(length >= MIN_PARTITION_LENGTH)) return room;
  return updatePartition(room, id, { b: roundPt(add(p.a, scale(norm(sub(p.b, p.a)), length))) });
}

/** The room with the partitions `ids` moved by `delta`. Their openings keep their offsets. */
export function movePartitions(room: Room, ids: readonly string[], delta: Vec2): Room {
  if (ids.length === 0 || (delta.x === 0 && delta.y === 0)) return room;
  const set = new Set(ids);
  return { ...room, partitions: room.partitions.map((p) => (set.has(p.id) ? { ...p, a: roundPt(add(p.a, delta)), b: roundPt(add(p.b, delta)) } : p)) };
}

/** The host line of an opening: its partition's centre line or its outer wall, start, unit direction and length. */
export function openingHost(room: Room, o: Opening): { a: Vec2; dir: Vec2; length: number } | null {
  if (o.partition) {
    const p = room.partitions.find((w) => w.id === o.partition);
    return p ? { a: p.a, dir: norm(sub(p.b, p.a)), length: partitionLength(p) } : null;
  }
  const w = walls(room)[o.wall];
  return w ? { a: w.a, dir: w.dir, length: w.length } : null;
}

/** The opening moved by `delta` along its host (the part of the move along the wall), clamped into it. */
export function slideOpening(room: Room, o: Opening, delta: Vec2): Opening {
  const h = openingHost(room, o);
  if (!h) return o;
  return clampToHost(room, { ...o, offset: round1(o.offset + dot(delta, h.dir)) });
}

// Selection.

/** What lies under the cursor in the room mode, by priority: handles, openings, partitions, walls. */
export type RoomHit =
  | { kind: "corner"; index: number }
  | { kind: "end"; id: string; end: "a" | "b" }
  | { kind: "opening"; id: string }
  | { kind: "partition"; id: string }
  | { kind: "wall"; index: number };

/**
 * The thing at `p`. `tol` is the pick distance in mm (a few screen pixels). A wall is hit on its
 * whole thickness outside the inner outline, a partition on its thickness, an opening on the part
 * of its host wall it cuts out.
 */
export function hitRoom(room: Room, p: Vec2, tol: number): RoomHit | null {
  let best: { hit: RoomHit; d: number } | null = null;
  const consider = (hit: RoomHit, d: number) => {
    if (d <= tol && (!best || d < best.d)) best = { hit, d };
  };
  room.points.forEach((c, index) => consider({ kind: "corner", index }, dist(c, p)));
  for (const w of room.partitions) {
    consider({ kind: "end", id: w.id, end: "a" }, dist(w.a, p));
    consider({ kind: "end", id: w.id, end: "b" }, dist(w.b, p));
  }
  if (best) return (best as { hit: RoomHit }).hit;

  const ws = walls(room);
  for (const o of room.openings) {
    const h = openingHost(room, o);
    if (!h) continue;
    const along = dot(sub(p, h.a), h.dir);
    if (along < o.offset - o.width / 2 - tol || along > o.offset + o.width / 2 + tol) continue;
    const normal = { x: -h.dir.y, y: h.dir.x };
    const across = dot(sub(p, h.a), normal);
    if (o.partition) {
      const part = room.partitions.find((w) => w.id === o.partition)!;
      if (Math.abs(across) <= part.thickness / 2 + tol) return { kind: "opening", id: o.id };
    } else {
      const out = -dot(sub(p, h.a), ws[o.wall].inward);
      if (out >= -tol && out <= room.wallThickness + tol) return { kind: "opening", id: o.id };
    }
  }
  for (const w of room.partitions) {
    if (distToSegment(p, w.a, w.b) <= w.thickness / 2 + tol) return { kind: "partition", id: w.id };
  }
  let wall: { index: number; d: number } | null = null;
  for (const w of ws) {
    const along = dot(sub(p, w.a), w.dir);
    if (along < -tol || along > w.length + tol) continue;
    const out = -dot(sub(p, w.a), w.inward);
    if (out < -tol || out > room.wallThickness + tol) continue;
    const d = Math.abs(out);
    if (!wall || d < wall.d) wall = { index: w.index, d };
  }
  return wall ? { kind: "wall", index: wall.index } : null;
}

const inBox = (p: Vec2, b: Box) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;

/** Does the segment a-b touch the box? */
function segmentTouchesBox(a: Vec2, b: Vec2, box: Box): boolean {
  if (inBox(a, box) || inBox(b, box)) return true;
  const c = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
  return c.some((p, i) => segmentsMeet(a, b, p, c[(i + 1) % 4]));
}

/**
 * Frame selection. A window (dragged left to right) takes the corners inside it and the
 * partitions with both ends inside; a crossing frame (right to left) also takes both corners of
 * every wall it touches and every partition it touches.
 */
export function frameSelect(room: Room, box: Box, crossing: boolean): { corners: number[]; partitions: string[] } {
  const n = room.points.length;
  const corners = new Set<number>();
  room.points.forEach((p, i) => {
    if (inBox(p, box)) corners.add(i);
  });
  if (crossing) {
    for (let i = 0; i < n; i++) {
      if (segmentTouchesBox(room.points[i], room.points[(i + 1) % n], box)) {
        corners.add(i);
        corners.add((i + 1) % n);
      }
    }
  }
  const partitions = room.partitions.filter((w) => (crossing ? segmentTouchesBox(w.a, w.b, box) : inBox(w.a, box) && inBox(w.b, box))).map((w) => w.id);
  return { corners: [...corners].sort((a, b) => a - b), partitions };
}

/** How a click or frame combines with the selection: replace it, add (Shift) or toggle (Ctrl). */
export type SelectMode = "replace" | "add" | "toggle";

/** `current` combined with `picked` by `mode`. */
export function combine<T>(current: readonly T[], picked: readonly T[], mode: SelectMode): T[] {
  if (mode === "replace") return [...new Set(picked)];
  if (mode === "add") return [...new Set([...current, ...picked])];
  const out = current.filter((x) => !picked.includes(x));
  for (const x of picked) if (!current.includes(x)) out.push(x);
  return out;
}

/** The wall of the outline whose two corners are exactly the selected corners, or null. */
export function selectedWall(room: Room, corners: readonly number[]): number | null {
  if (corners.length !== 2) return null;
  const n = room.points.length;
  const [a, b] = [...corners].sort((x, y) => x - y);
  if (b === a + 1) return a;
  if (a === 0 && b === n - 1) return n - 1;
  return null;
}

/**
 * The room without the selected corners, partitions (with their openings) and opening; null when
 * the corners cannot go (see `removeCorners`).
 */
export function deleteSelection(room: Room, sel: { corners: readonly number[]; partitions: readonly string[]; opening: string | null }): Room | null {
  let r = room;
  if (sel.corners.length > 0) {
    const without = removeCorners(r, sel.corners);
    if (!without) return null;
    r = without;
  }
  const parts = new Set(sel.partitions);
  if (parts.size === 0 && !sel.opening) return r;
  return {
    ...r,
    partitions: r.partitions.filter((w) => !parts.has(w.id)),
    openings: r.openings.filter((o) => o.id !== sel.opening && !(o.partition && parts.has(o.partition))),
  };
}

/**
 * Typical sizes of a new opening (mm): a hatch is a pass-through window at counter height; a
 * sliding door has the clear width of a hinged one.
 */
export const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sill: number }> = {
  door: { width: 1010, height: 2135, sill: 0 },
  slidingDoor: { width: 1010, height: 2135, sill: 0 },
  window: { width: 1200, height: 1200, sill: 900 },
  passage: { width: 1010, height: 2135, sill: 0 },
  hatch: { width: 1200, height: 800, sill: 900 },
};

/** Where an opening goes: an outer wall (its index) or a partition (its id). */
export type OpeningHostRef = { wall: number } | { partition: string };

/** A new opening of `kind` in the middle of its host, with the typical size, clamped into the host. */
export function newOpening(room: Room, id: string, kind: OpeningKind, host: OpeningHostRef): Opening {
  const d = OPENING_DEFAULTS[kind];
  const o: Opening = "partition" in host ? { id, kind, wall: 0, partition: host.partition, offset: 0, ...d } : { id, kind, wall: host.wall, offset: 0, ...d };
  const h = openingHost(room, o);
  return clampToHost(room, { ...o, offset: round1((h?.length ?? d.width) / 2) });
}

/**
 * The opening changed to `kind`: an opening that turns from one on the floor (door, passage)
 * into one with a sill (window, hatch) or back takes that kind's typical height and sill.
 */
export function changeOpeningKind(o: Opening, kind: OpeningKind): Opening {
  const from = OPENING_DEFAULTS[o.kind];
  const to = OPENING_DEFAULTS[kind];
  if (from.sill === 0 && to.sill === 0) return { ...o, kind };
  if (from.sill > 0 && to.sill > 0) return { ...o, kind, sill: o.sill || to.sill };
  return { ...o, kind, height: to.height, sill: to.sill };
}
