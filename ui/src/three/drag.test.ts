import { describe, expect, it } from "vitest";
import { testItem, testProject } from "../model/testProject";
import { snapItem } from "../model/geometry";
import { dragItems } from "./drag";

describe("dragging items in 3D", () => {
  it("snaps a single item exactly like the floor plan (snapItem)", () => {
    const table = testItem("t", "table", 4000, 3000);
    const other = testItem("o", "table", 1000, 1000);
    const p = testProject([table, other]);
    const origin = new Map([["t", { x: 4000, y: 3000 }]]);
    const delta = { x: 123, y: -2600 };
    const moves = dragItems(p, origin, delta, 50, false);
    const expected = snapItem({ ...table, x: 4123, y: 400 }, p.room, [other], 50, false);
    expect(moves.get("t")).toEqual({ x: expected.x, y: expected.y, rotation: expected.rotation });
    // Near the north wall it lands with its back on the wall.
    expect(moves.get("t")!.y).toBe(table.depth / 2);
  });

  it("moves freely with Alt, rounded to a tenth of a millimetre", () => {
    const p = testProject([testItem("t", "table", 4000, 3000)]);
    const moves = dragItems(p, new Map([["t", { x: 4000, y: 3000 }]]), { x: 12.3456, y: 7.891 }, 50, true);
    expect(moves.get("t")).toEqual({ x: 4012.3, y: 3007.9, rotation: 0 });
  });

  it("moves several items together by whole grid steps", () => {
    const p = testProject([testItem("a", "table", 2000, 3000), testItem("b", "table", 4000, 3000, 90), testItem("c", "table", 6000, 3000)]);
    const origin = new Map([
      ["a", { x: 2000, y: 3000 }],
      ["b", { x: 4000, y: 3000 }],
    ]);
    const moves = dragItems(p, origin, { x: 130, y: -70 }, 50, false);
    expect(moves.get("a")).toEqual({ x: 2150, y: 2950, rotation: 0 });
    expect(moves.get("b")).toEqual({ x: 4150, y: 2950, rotation: 90 });
    expect(moves.has("c")).toBe(false);
  });

  it("snaps overhead items among overhead items only", () => {
    const hood = testItem("h", "hood-wall", 4000, 3000);
    const table = testItem("t", "table", 4000, 3000);
    const p = testProject([hood, table]);
    const moves = dragItems(p, new Map([["h", { x: 4000, y: 3000 }]]), { x: 0, y: 0 }, 50, false);
    // The table below is not among the hood's neighbours: same result as with no other items.
    const alone = snapItem(hood, p.room, [], 50, false);
    expect(moves.get("h")).toEqual({ x: alone.x, y: alone.y, rotation: alone.rotation });
  });
});
