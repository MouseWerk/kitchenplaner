// Plausibility checks of a plan: what a planner would otherwise notice only on site.

import { collides, kindOf, placementOf } from "../kinds/registry";
import { across, doorLeaves, doorSetup, isDoor, leafRect, openingFrame, SLIDE_CLEAR, swingFrame } from "./doors";
import { convexOverlap, cross, EPS, footprint, pointInPolygon, sub } from "./geometry";
import { bandPiece, partitionBand, partitionLength, partitionOutline } from "./partitions";
import { positions } from "./project";
import { selfIntersects } from "./roomEdit";
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
 * All problems of a project, in a stable order: a room outline crossing itself, overlaps (by position pairs), items outside the
 * room, items standing in a partition, partitions reaching outside the room, items blocking a
 * door on the side it opens to (in an outer wall or a partition), items higher than the room
 * (each by position).
 *
 * Items only collide with items of the same placement (`collides`): a hood above a range or a
 * slicer on a table is the normal case, and flat ones (drains, platforms) collide with nothing.
 * The overlap uses the footprint rectangle, also of a unit drawn round. A partition collides with
 * every item that starts below its top except flat ones, so a wall shelf may hang above a
 * half-height partition. Only floor units block a door.
 */
export function checkProject(project: Project): Issue[] {
  const pos = positions(project);
  const items = project.items;
  const fps = items.map((it) => footprint(it));
  const placement = items.map((it) => placementOf(kindOf(it.catalogId)));
  const issues: Issue[] = [];
  const posOf = (id: string) => pos.get(id) ?? 0;

  // The room mode never makes one, but a file may bring one: it opens, so it can be repaired.
  if (selfIntersects(project.room.points)) issues.push({ key: "check.outlineInvalid", vars: {}, itemIds: [] });

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!collides(placement[i], placement[j])) continue;
      if (!convexOverlap(fps[i], fps[j])) continue;
      // The lower number first, whatever the list order: "Pos. 3 und Pos. 12".
      const [pa, pb] = [posOf(items[i].id), posOf(items[j].id)].sort((x, y) => x - y);
      issues.push({ key: "check.overlap", vars: { a: pa, b: pb }, itemIds: [items[i].id, items[j].id] });
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
    if (placement[i] === "flat") return;
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
    if (placement[i] !== "floor") return;
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
 * The areas in front of every door that have to stay free. A hinged door: its swing square, door
 * width × door width (each of two leaves its half), on the side it opens to (into the room or
 * out of it for an outer wall, left or right of a→b for a partition). A door in an outer wall
 * opening out sweeps outside the room, where items are found by the outside check, so it needs
 * no area here. A sliding door: a strip `SLIDE_CLEAR` deep in front of the opening on every side
 * inside the room, and on the face it runs on also beside the opening where its leaf parks.
 */
export function doorClearances(project: Pick<Project, "room">): Vec2[][] {
  const { room } = project;
  const out: Vec2[][] = [];
  for (const o of room.openings) {
    if (!isDoor(o)) continue;
    const at = openingFrame(room, o);
    if (!at) continue;
    const { frame, opening } = at;
    const setup = doorSetup(opening);
    const outer = opening.partition === undefined;
    const f = swingFrame(frame, setup.swing);
    const inRoom = !outer || setup.swing === "in";
    if (opening.kind === "door") {
      if (!inRoom) continue;
      for (const leaf of doorLeaves(f, opening)) out.push(leafRect(f, leaf, 0, leaf.width, f.near, f.near + leaf.width));
      continue;
    }
    // Sliding: the run face with the parking places, then the other face where it is in the room.
    if (inRoom) {
      for (const leaf of doorLeaves(f, opening)) out.push(leafRect(f, leaf, -leaf.width, leaf.width, f.near, f.near + SLIDE_CLEAR));
    }
    const back = swingFrame(frame, setup.swing === "in" ? "out" : "in");
    if (!outer || setup.swing === "out") {
      out.push([across(back, back.start, back.near), across(back, back.end, back.near), across(back, back.end, back.near + SLIDE_CLEAR), across(back, back.start, back.near + SLIDE_CLEAR)]);
    }
  }
  return out;
}
