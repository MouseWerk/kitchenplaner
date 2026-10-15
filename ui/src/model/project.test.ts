import { describe, expect, it } from "vitest";
import { CATALOG } from "../kinds/registry";
import { cleanSpec, DEFAULT_SETTINGS, itemFromCatalog, newProject, nextPos, numberNew, positions, renumberPositions, repairPositions } from "./project";
import { testItem, testProject } from "./testProject";

describe("stable position numbers", () => {
  it("are the items' own numbers, not their place in the list", () => {
    const p = testProject([testItem("a", "table", 1000, 350, 0, { pos: 5 }), testItem("b", "table", 3000, 350, 0, { pos: 2 })]);
    expect(positions(p)).toEqual(
      new Map([
        ["a", 5],
        ["b", 2],
      ]),
    );
    // Deleting the first item leaves the number of the second as it was.
    expect(positions({ items: p.items.slice(1) }).get("b")).toBe(2);
  });

  it("number new items above the highest, so deleted numbers are not given again", () => {
    const items = [testItem("a", "table", 0, 0, 0, { pos: 1 }), testItem("c", "table", 0, 0, 0, { pos: 4 })];
    expect(nextPos(items)).toBe(5);
    expect(nextPos([])).toBe(1);
    const added = numberNew(items, [testItem("x", "table", 0, 0), testItem("y", "table", 0, 0, 0, { pos: 1 })]);
    expect(added.map((i) => i.pos)).toEqual([5, 6]);
  });

  it("start without a number for a catalog item; a new project has the default settings", () => {
    expect(itemFromCatalog(CATALOG[0], 0, 0).pos).toBe(0);
    expect(newProject().settings).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.simultaneity).toBe(1);
  });

  it("are repaired deterministically: first of a number keeps it, the rest follow the highest", () => {
    const items = [5, 5, 0, -1, 1.5, 1].map((pos, i) => testItem(`i${i}`, "table", 0, 0, 0, { pos }));
    expect(repairPositions(items).map((i) => i.pos)).toEqual([5, 6, 7, 8, 9, 1]);
    // Valid numbers stay as they are, the very same objects.
    const ok = [testItem("a", "table", 0, 0, 0, { pos: 3 }), testItem("b", "table", 0, 0, 0, { pos: 1 })];
    const repaired = repairPositions(ok);
    expect(repaired[0]).toBe(ok[0]);
    expect(repaired[1]).toBe(ok[1]);
  });
});

describe("renumbering", () => {
  // The 8 × 6 m test room: centre (4000, 3000).
  it("counts clockwise round the room from the top left, keeping the list order", () => {
    const p = testProject([
      testItem("south", "table", 4000, 5600, 0, { pos: 9 }),
      testItem("northEast", "table", 6500, 350, 0, { pos: 2 }),
      testItem("west", "table", 350, 3000, 0, { pos: 30 }),
      testItem("northWest", "table", 1500, 350, 0, { pos: 4 }),
      testItem("east", "table", 7650, 3000, 0, { pos: 1 }),
    ]);
    const items = renumberPositions(p);
    expect(items.map((i) => i.id)).toEqual(p.items.map((i) => i.id));
    expect(Object.fromEntries(items.map((i) => [i.id, i.pos]))).toEqual({ northWest: 1, northEast: 2, east: 3, south: 4, west: 5 });
  });

  it("puts items in the same direction nearest first and gives 1 to n", () => {
    const p = testProject([testItem("far", "table", 1000, 3000, 0, { pos: 1 }), testItem("near", "table", 3000, 3000, 0, { pos: 2 })]);
    expect(renumberPositions(p).map((i) => i.pos)).toEqual([2, 1]);
    expect(renumberPositions(testProject()).length).toBe(0);
  });
});

describe("cleanSpec", () => {
  it("trims the texts and drops empty fields and a zero price", () => {
    expect(cleanSpec({ manufacturer: "  Muster GmbH ", model: "", article: " ", price: 0 })).toEqual({ manufacturer: "Muster GmbH" });
    expect(cleanSpec({ price: 12.5 })).toEqual({ price: 12.5 });
    expect(cleanSpec({ model: "  " })).toBeUndefined();
  });
});
