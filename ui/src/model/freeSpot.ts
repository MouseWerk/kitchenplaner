// Where a unit added from the catalog by click goes: a spot where the plan check finds nothing
// to say about it, so adding a unit never creates warnings the planner did not cause.

import { kindOf, placementOf, wallSnapReach } from "../kinds/registry";
import { freeSpotTest } from "./checks";
import { add, bounds, EPS, rotationFacing, roomFaces, scale, snapItem } from "./geometry";
import type { Item, Project } from "./types";

/** Smallest step (mm) between the spots tried along a wall and across the room. */
const WALL_STEP = 50;
const ROOM_STEP = 100;

/**
 * The first free spot for `draft`: with its back against a wall or partition face (in the order
 * of the outline, along each face from its start), flush with a neighbour when one is close as a
 * drop there would land, else anywhere in the room on the grid, unturned. Null when the room has
 * no free spot of that size at all.
 */
export function freeSpot(project: Project, draft: Item, grid: number): Pick<Item, "x" | "y" | "rotation"> | null {
  const fits = freeSpotTest(project);
  const { room } = project;
  const placement = placementOf(kindOf(draft.catalogId));
  const others = project.items.filter((i) => placementOf(kindOf(i.catalogId)) === placement);
  const reach = wallSnapReach(kindOf(draft.catalogId));

  const step = Math.max(grid, WALL_STEP);
  for (const face of roomFaces(room)) {
    if (face.length + EPS < draft.width) continue;
    const rotation = rotationFacing(face);
    for (let along = draft.width / 2; along <= face.length - draft.width / 2 + EPS; along += step) {
      const at = add(add(face.a, scale(face.dir, along)), scale(face.inward, draft.depth / 2));
      const s = snapItem({ ...draft, ...at, rotation }, room, others, grid, true, reach);
      for (const spot of [{ x: s.x, y: s.y, rotation: s.rotation }, { ...at, rotation }]) {
        if (fits({ ...draft, ...spot })) return spot;
      }
    }
  }

  const b = bounds(room.points);
  const across = Math.max(grid, ROOM_STEP);
  for (let y = b.minY + draft.depth / 2; y <= b.maxY - draft.depth / 2; y += across) {
    for (let x = b.minX + draft.width / 2; x <= b.maxX - draft.width / 2; x += across) {
      if (fits({ ...draft, x, y, rotation: 0 })) return { x, y, rotation: 0 };
    }
  }
  return null;
}
