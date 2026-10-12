import { describe, expect, it } from "vitest";
import { elevationDrawing, facingAxes } from "./elevation";
import { bounds } from "./geometry";
import { testItem, testProject } from "./testProject";
import type { DimShape, PolyShape, Shape } from "../render/drawing";

const polys = (s: Shape[]) => s.filter((x): x is PolyShape => x.t === "poly");
const body = (s: Shape[], id: string) => polys(s).find((x) => x.itemId === id && x.pen === "item" && x.fill === "item")!;
const extent = (p: PolyShape) => {
  const b = bounds(p.pts);
  return [b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v) + 0);
};

describe("facingAxes", () => {
  it("looks towards the named wall with the right hand along u", () => {
    expect(facingAxes("north")).toEqual({ v: { x: 0, y: -1 }, u: { x: 1, y: 0 } });
    expect(facingAxes("east")).toEqual({ v: { x: 1, y: 0 }, u: { x: -0, y: 1 } });
    expect(facingAxes("south")).toEqual({ v: { x: 0, y: 1 }, u: { x: -1, y: 0 } });
    expect(facingAxes("west")).toEqual({ v: { x: -1, y: 0 }, u: { x: -0, y: -1 } });
  });
});

describe("elevationDrawing", () => {
  it("draws an item against the north wall at its x range, from the floor to its height", () => {
    const p = testProject([testItem("a", "table", 1600, 350)]);
    const shapes = elevationDrawing(p, "north", { showDims: false }).shapes;
    expect(extent(body(shapes, "a"))).toEqual([1000, 2200, -900, 0]);
    // The front faces the viewer: legs and top are drawn.
    expect(polys(shapes).filter((s) => s.itemId === "a" && s.pen === "detail").length).toBeGreaterThan(2);
  });

  it("draws the room section: cut walls at both ends, floor and ceiling", () => {
    const shapes = elevationDrawing(testProject(), "north", { showDims: false }).shapes;
    const walls = polys(shapes).filter((s) => s.fill === "wall");
    expect(walls.map(extent)).toEqual([
      [-240, 0, -3000, 0],
      [8000, 8240, -3000, 0],
    ]);
    expect(polys(shapes).some((s) => s.pen === "floor")).toBe(true);
  });

  it("paints far items first", () => {
    const p = testProject([testItem("near", "table", 4000, 1500), testItem("far", "table", 4000, 350)]);
    const order = (facing: "north" | "south") => {
      const shapes = elevationDrawing(p, facing, { showDims: false }).shapes;
      return ["near", "far"].sort((a, b) => shapes.indexOf(body(shapes, a)) - shapes.indexOf(body(shapes, b)));
    };
    expect(order("north")).toEqual(["far", "near"]);
    expect(order("south")).toEqual(["near", "far"]);
  });

  it("projects a turned item and shows its front only from the side it faces", () => {
    // At 90 degrees the front faces west: the item stands against the east wall.
    const p = testProject([testItem("t", "table-cabinet", 7650, 3000, 90)]);
    const east = elevationDrawing(p, "east", { showDims: false }).shapes;
    expect(extent(body(east, "t"))).toEqual([2400, 3600, -900, 0]);
    expect(polys(east).filter((s) => s.itemId === "t" && s.pen === "detail").length).toBeGreaterThan(2);

    const west = elevationDrawing(p, "west", { showDims: false }).shapes;
    expect(extent(body(west, "t"))).toEqual([-3600, -2400, -900, 0]);
    // From behind: the box and its top line only.
    expect(polys(west).filter((s) => s.itemId === "t")).toHaveLength(2);
  });

  it("shows the door only in the elevation of its wall", () => {
    const p = testProject();
    const south = polys(elevationDrawing(p, "south", { showDims: false }).shapes).filter((s) => s.pen === "opening");
    expect(south.length).toBeGreaterThan(0);
    // Door x 695 to 1705, seen from the north looking south (u points west).
    expect(extent(south[0])).toEqual([-1705, -695, -2135, 0]);
    expect(polys(elevationDrawing(p, "north", { showDims: false }).shapes).some((s) => s.pen === "opening")).toBe(false);
  });

  it("puts a combi oven on its stand and gives it a glass door", () => {
    const p = testProject([testItem("c", "combi-10", 1000, 425)]);
    const shapes = elevationDrawing(p, "north", { showDims: false }).shapes.filter((s) => s.itemId === "c");
    const boxes = polys(shapes).filter((s) => s.pen === "item" && s.fill === "item").map(extent);
    // The unit from 700 to 1750 mm, two stand legs from the floor to 700 mm.
    expect(boxes).toContainEqual([575, 1425, -1750, -700]);
    expect(boxes.filter((b) => b[2] === -700 && b[3] === 0)).toHaveLength(2);
    expect(polys(shapes).some((s) => s.fill === "glass")).toBe(true);
  });

  it("numbers every item and dimensions the room width and height", () => {
    const p = testProject([testItem("a", "table", 1600, 350)]);
    const shapes = elevationDrawing(p, "north", { showDims: true }).shapes;
    expect(shapes.some((s) => s.t === "text" && s.circled && s.text === "1" && s.itemId === "a")).toBe(true);
    const ds = shapes.filter((s): s is DimShape => s.t === "dim");
    expect(ds.map((d) => d.text)).toEqual(["8000", "3000"]);
  });
});

describe("elevationDrawing sinks", () => {
  it("draws as many hidden bowls as the plan and 3D (sinkBowlCount), by width not catalog id", () => {
    const bowls = (catalogId: string, width: number) => {
      const p = testProject([testItem("s", catalogId, 3000, 350, 0, { width })]);
      return polys(elevationDrawing(p, "north", { showDims: false }).shapes).filter((x) => x.itemId === "s" && x.pen === "hidden");
    };
    expect(bowls("sink-1", 1200)).toHaveLength(1);
    expect(bowls("sink-1", 1600)).toHaveLength(2);
    expect(bowls("sink-2", 1200)).toHaveLength(1);
    // Two bowls side by side at the right end, inside the item.
    const two = bowls("sink-2", 1600).map(extent);
    expect(two[0][1]).toBeLessThanOrEqual(3800);
    expect(two[1][1]).toBeLessThanOrEqual(two[0][0]);
    expect(two[1][0]).toBeGreaterThanOrEqual(2200);
  });
});
