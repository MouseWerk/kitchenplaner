// Plausibility checks of a plan: what a planner would otherwise notice only on site.

import { isOverhead, kindOf } from "./catalog";
import { add, convexOverlap, footprint, openingSpan, pointInPolygon, scale, walls } from "./geometry";
import { positions } from "./project";
import type { Project, Vec2 } from "./types";
import type { TKey } from "../lib/i18n";

/** One finding: a message key with its values and the items it concerns. */
export interface Issue {
  key: TKey;
  vars: Record<string, string | number>;
  itemIds: string[];
}

/**
 * All problems of a project, in a stable order: overlaps (by position pairs), items outside the
 * room, items blocking a door, items higher than the room (each by position).
 *
 * Floor items only collide with floor items and overhead items (hoods, wall shelves) only with
 * overhead items: a hood above a range is the normal case.
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

/** The square in front of every door that has to stay free: door width × door width into the room. */
function doorClearances(project: Project): Vec2[][] {
  const ws = walls(project.room);
  const out: Vec2[][] = [];
  for (const o of project.room.openings) {
    if (o.kind !== "door") continue;
    const span = openingSpan(project.room, o);
    const w = ws[o.wall];
    if (!span || !w) continue;
    const into = scale(w.inward, o.width);
    out.push([span[0], span[1], add(span[1], into), add(span[0], into)]);
  }
  return out;
}
