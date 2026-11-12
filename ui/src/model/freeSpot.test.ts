import { describe, expect, it } from "vitest";
import { freeSpot } from "./freeSpot";
import { checkProject } from "./checks";
import { rectRoom } from "./geometry";
import { itemFromCatalog } from "./project";
import { testItem, testProject } from "./testProject";
import { catalogEntry } from "../kinds/registry";
import { exampleKitchen } from "../examples/exampleKitchen";
import type { Item, Project } from "./types";

function draftOf(catalogId: string): Item {
  const entry = catalogEntry(catalogId);
  if (!entry) throw new Error(catalogId);
  return itemFromCatalog(entry, 0, 0);
}

/** The project with the draft placed at its free spot, and the findings about the new unit. */
function place(p: Project, catalogId: string, grid = 50) {
  const draft = draftOf(catalogId);
  const spot = freeSpot(p, draft, grid);
  const item = { ...draft, ...spot };
  const issues = checkProject({ ...p, items: [...p.items, { ...item, pos: 999 }] }).filter((i) => i.itemIds.includes(draft.id));
  return { spot, item, issues };
}

describe("freeSpot", () => {
  it("puts a unit against the first wall, turned away from it", () => {
    const { spot, issues } = place(testProject(), "table");
    // The north wall from its west end: back at y 0, front facing into the room.
    expect(spot).toEqual({ x: 600, y: 350, rotation: 0 });
    expect(issues).toEqual([]);
  });

  it.each(["table", "range-6", "wall-shelf", "handwash", "prep-slicer", "floor-drain"])(
    "finds a spot without plan-check findings in the full example kitchen (%s)",
    (catalogId) => {
      const { spot, issues } = place(exampleKitchen("de"), catalogId);
      expect(spot).not.toBeNull();
      expect(issues).toEqual([]);
    },
  );

  it("stands free in the room when every wall is taken, and keeps clear of the door", () => {
    // A 4 × 3 m room with tables along all four walls.
    const p = testProject([
      testItem("n1", "table", 600, 350),
      testItem("n2", "table", 1800, 350),
      testItem("n3", "table", 3000, 350),
      testItem("s1", "table", 1000, 2650, 180),
      testItem("s2", "table", 3000, 2650, 180),
      testItem("w", "table", 350, 1500, 90),
      testItem("e", "table", 3650, 1500, -90),
    ]);
    p.room = { ...p.room, points: rectRoom(4000, 3000), openings: [] };
    expect(checkProject(p)).toEqual([]);
    const { spot, issues } = place(p, "prep-scale");
    expect(spot).not.toBeNull();
    expect(issues).toEqual([]);
    const table = place(p, "table");
    // Off every wall: between the north and the south row, unturned.
    expect(table.spot?.rotation).toBe(0);
    expect(table.spot?.y).toBeGreaterThanOrEqual(700 + 350);
    expect(table.spot?.y).toBeLessThanOrEqual(2300 - 350);
    expect(table.issues).toEqual([]);
  });

  it("gives up in a room too small for the unit", () => {
    const p = testProject();
    p.room = { ...p.room, points: rectRoom(500, 500), openings: [] };
    expect(freeSpot(p, draftOf("table"), 50)).toBeNull();
  });
});
