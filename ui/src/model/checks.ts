// Plausibility checks of a plan: what a planner would otherwise notice only on site.

import { isOverhead, kindOf } from "./catalog";
import { add, convexOverlap, cross, EPS, footprint, openingSpan, pointInPolygon, scale, sub, walls } from "./geometry";
import { bandPiece, clampPartitionOpening, openingSpanOnPartition, partitionAxes, partitionBand, partitionLength, partitionOutline } from "./partitions";
import { positions } from "./project";
import type { Project, Room, Vec2 } from "./types";
import type { TKey } from "../lib/i18n";

/** One finding: a message key with its values and the items (and partitions) it concerns. */
export interface Issue {
  key: TKey;
  vars: Record<string, string | number>;
  itemIds: string[];
  /** The partitions the finding is about, when there are any. */
  partitionIds?: string[];
}

/**
 * All problems of a project, in a stable order: overlaps (by position pairs), items outside the
 * room, items standing in a partition, partitions reaching outside the room, items blocking a
 * door (in an outer wall or a partition), items higher than the room (each by position).
 *
 * Floor items only collide with floor items and overhead items (hoods, wall shelves) only with
 * overhead items: a hood above a range is the normal case. A partition collides with every item
 * that starts below its top, so a wall shelf may hang above a half-height partition.
 */
export function checkProject(project: Project): Issue[] {
  const pos = positions(project);
  const items = project.items;
  const fps = items.map((it) => footprint(it));
  const overhead = items.map((it) => isOverhead(kindOf(it.catalogId)));
  const issues: Issue[] = [];
  const posOf = (id: string) => pos.get(id) ?? 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overhead[i] !== overhead[j]) continue;
      if (!convexOverlap(fps[i], fps[j])) continue;
      issues.push({ key: "check.overlap", vars: { a: posOf(items[i].id), b: posOf(items[j].id) }, itemIds: [items[i].id, items[j].id] });
    }
  }

  const roomPoly = project.room.points;
  if (roomPoly.length >= 3) {
    items.forEach((it, i) => {
      if (fps[i].some((p) => !pointInPolygon(p, roomPoly))) issues.push({ key: "check.outside", vars: { pos: posOf(it.id) }, itemIds: [it.id] });
    });
  }

  const parts = project.room.partitions.filter((p) => partitionLength(p) >= EPS);
  const outlines = parts.map((p) => partitionOutline(p));
  items.forEach((it, i) => {
    const hit = parts.filter((p, k) => it.elevation < p.height && convexOverlap(fps[i], outlines[k]));
    if (hit.length > 0) issues.push({ key: "check.partitionOverlap", vars: { pos: posOf(it.id) }, itemIds: [it.id], partitionIds: hit.map((p) => p.id) });
  });

  if (roomPoly.length >= 3) {
    for (const p of parts) {
      if (!partitionInside(project.room, p)) issues.push({ key: "check.partitionOutside", vars: {}, itemIds: [], partitionIds: [p.id] });
    }
  }

  const doorAreas = doorClearances(project);
  items.forEach((it, i) => {
    if (overhead[i]) return;
    if (doorAreas.some((area) => convexOverlap(fps[i], area))) issues.push({ key: "check.doorBlocked", vars: { pos: posOf(it.id) }, itemIds: [it.id] });
  });

  items.forEach((it) => {
    // A tenth of a millimetre of rounding noise is not a finding.
    if (it.elevation + it.height > project.room.height + 0.1) issues.push({ key: "check.tooHigh", vars: { pos: posOf(it.id) }, itemIds: [it.id] });
  });

  return issues;
}

/**
 * Does the partition stay inside the room? Its joined band (cut flush at the wall faces it meets)
 * must lie in the outline with all corners, and its centre line must not cross an outer wall,
 * which a partition across the notch of an L-shaped room would.
 */
function partitionInside(room: Room, p: Room["partitions"][number]): boolean {
  const band = partitionBand(room, p);
  const corners = bandPiece(band, 0, band.length);
  if (corners.some((q) => !pointInPolygon(q, room.points))) return false;
  const a = mid(band.start);
  const b = mid(band.end);
  const pts = room.points;
  for (let i = 0; i < pts.length; i++) {
    if (properlyCross(a, b, pts[i], pts[(i + 1) % pts.length])) return false;
  }
  return true;
}

const mid = ([l, r]: [Vec2, Vec2]): Vec2 => ({ x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 });

/** Do the segments cross in a point inside both (not just touch at an end)? */
function properlyCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const ab = sub(b, a);
  const cd = sub(d, c);
  const den = cross(ab, cd);
  if (Math.abs(den) < EPS) return false;
  const s = cross(sub(c, a), cd) / den;
  const t = cross(sub(c, a), ab) / den;
  // A millimetre's margin at each end: ends on a wall face are joints, not crossings.
  const ms = 1 / Math.hypot(ab.x, ab.y);
  const mt = 1 / Math.hypot(cd.x, cd.y);
  return s > ms && s < 1 - ms && t > mt && t < 1 - mt;
}

/**
 * The square in front of every door that has to stay free: door width × door width on the side
 * it opens to (into the room for an outer wall, left of a→b for a partition).
 */
function doorClearances(project: Project): Vec2[][] {
  const { room } = project;
  const ws = walls(room);
  const out: Vec2[][] = [];
  for (const o of room.openings) {
    if (o.kind !== "door") continue;
    if (o.partition !== undefined) {
      const p = room.partitions.find((q) => q.id === o.partition);
      if (!p || partitionLength(p) < EPS) continue;
      const c = clampPartitionOpening(p, o);
      const { left } = partitionAxes(p);
      const face = scale(left, p.thickness / 2);
      const [s0, s1] = openingSpanOnPartition(p, c).map((q) => add(q, face));
      const into = scale(left, c.width);
      out.push([s0, s1, add(s1, into), add(s0, into)]);
      continue;
    }
    const span = openingSpan(room, o);
    const w = ws[o.wall];
    if (!span || !w) continue;
    const into = scale(w.inward, o.width);
    out.push([span[0], span[1], add(span[1], into), add(span[0], into)]);
  }
  return out;
}
