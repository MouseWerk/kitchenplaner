// Moving items by dragging them in the 3D view, with the same snapping as the floor plan: one
// item snaps to the grid and to the nearest wall (`snapItem`), several move together by grid
// steps. Pure: the view turns the result into a store change.

import type { Item, Project, Vec2 } from "../model/types";
import { isOverhead, kindOf } from "../model/catalog";
import { round, snapItem, snapValue } from "../model/geometry";

export type ItemMove = Pick<Item, "x" | "y" | "rotation">;

/**
 * The new places of the dragged items: `origin` holds their places when the drag started,
 * `delta` the pointer's way on the floor (mm). `free` (Alt) turns snapping off.
 */
export function dragItems(project: Project, origin: ReadonlyMap<string, Vec2>, delta: Vec2, grid: number, free: boolean): Map<string, ItemMove> {
  const out = new Map<string, ItemMove>();
  const ids = [...origin.keys()];
  const step = free ? 0 : grid;
  if (ids.length === 1) {
    const it = project.items.find((i) => i.id === ids[0]);
    const o = origin.get(ids[0])!;
    if (!it) return out;
    const moving = { ...it, x: o.x + delta.x, y: o.y + delta.y };
    // Overhead items (hoods, shelves) snap among themselves, floor items among the floor items.
    const overhead = isOverhead(kindOf(it.catalogId));
    const others = project.items.filter((i) => i.id !== it.id && isOverhead(kindOf(i.catalogId)) === overhead);
    const s = free ? { x: round(moving.x), y: round(moving.y), rotation: it.rotation } : snapItem(moving, project.room, others, step, false);
    out.set(it.id, { x: s.x, y: s.y, rotation: s.rotation });
    return out;
  }
  const dx = snapValue(delta.x, step);
  const dy = snapValue(delta.y, step);
  for (const it of project.items) {
    const o = origin.get(it.id);
    if (o) out.set(it.id, { x: round(o.x + dx), y: round(o.y + dy), rotation: it.rotation });
  }
  return out;
}
