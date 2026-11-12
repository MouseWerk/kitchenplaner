import { describe, expect, it } from "vitest";
import { cutDepth, ELEVATION_CUTS, elevationAxes, elevationDrawing, elevationExists, elevationWallIndex, resolveElevation, slantedWalls, standardElevations, WALL_CUT_DEPTH, wallElevation, type ElevationId } from "./elevation";
import { bounds, rotationFacing, walls } from "./geometry";
import { testItem, testProject } from "./testProject";
import type { Project } from "./types";
import type { DimShape, PolyShape, Shape } from "../render/drawing";

const polys = (s: Shape[]) => s.filter((x): x is PolyShape => x.t === "poly");
const body = (s: Shape[], id: string) => polys(s).find((x) => x.itemId === id && x.pen === "item" && x.fill === "item")!;
const extent = (p: PolyShape) => {
  const b = bounds(p.pts);
  return [b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v) + 0);
};
const width = (p: PolyShape) => bounds(p.pts).maxX - bounds(p.pts).minX;
const glass = (shapes: Shape[]) => polys(shapes).filter((s) => s.fill === "glass");
const ids = (shapes: Shape[]) => [...new Set(shapes.map((s) => s.itemId).filter((x): x is string => !!x))].sort();
const WHOLE = { showDims: false, cut: "room" } as const;

/** A point `along` mm along wall `i` from its start and `out` mm in front of it. */
const onWall = (p: Project, i: number, along: number, out: number) => {
  const w = walls(p.room)[i];
  return { x: w.a.x + w.dir.x * along + w.inward.x * out, y: w.a.y + w.dir.y * along + w.inward.y * out };
};

/**
 * The 8 × 6 m test room with its north-east corner chamfered 1 m by 1 m: wall 1 runs at 45° from
 * (7000, 0) to (8000, 1000), 1414 mm long. A window in the chamfer, a table centred on it facing
 * into the room, a table at the north wall.
 */
function chamfered(): Project {
  const p = testProject([testItem("line", "table", 2000, 350)]);
  p.room.points = [
    { x: 0, y: 0 },
    { x: 7000, y: 0 },
    { x: 8000, y: 1000 },
    { x: 8000, y: 6000 },
    { x: 0, y: 6000 },
  ];
  p.room.openings = [{ id: "win", kind: "window", wall: 1, offset: 300, width: 800, height: 1000, sill: 1000 }];
  const c = onWall(p, 1, Math.SQRT2 * 500, 350);
  p.items.push({ ...testItem("chamfer", "table", c.x, c.y, rotationFacing(walls(p.room)[1])), pos: 2 });
  return p;
}

describe("wall elevations", () => {
  it("names wall views by index and knows which exist", () => {
    expect(wallElevation(3)).toBe("wall-3");
    expect(elevationWallIndex("wall-3")).toBe(3);
    expect(elevationWallIndex("north")).toBeNull();
    const p = chamfered();
    expect(elevationExists(p.room, "wall-4")).toBe(true);
    expect(elevationExists(p.room, "wall-5")).toBe(false);
    // A wall view outlives its wall as a choice and shows the north view meanwhile.
    expect(resolveElevation(p.room, "wall-5")).toBe("north");
    expect(resolveElevation(p.room, "wall-1")).toBe("wall-1");
    expect(elevationDrawing(p, "wall-5", WHOLE).shapes).toEqual([]);
  });

  it("finds the walls no compass view sees face-on and adds their views to the four", () => {
    expect(slantedWalls(testProject().room)).toEqual([]);
    expect(standardElevations(testProject().room)).toEqual(["north", "east", "south", "west"]);
    const p = chamfered();
    expect(slantedWalls(p.room)).toEqual([1]);
    expect(standardElevations(p.room)).toEqual(["north", "east", "south", "west", "wall-1"]);
    // The viewer looks north-east, against the chamfer's inward normal, the right hand along it.
    const { u, v } = elevationAxes(p.room, "wall-1")!;
    expect([v.x, v.y, u.x, u.y].map((x) => Math.round(x * 1000) / 1000)).toEqual([0.707, -0.707, 0.707, 0.707]);
  });

  it("draws a rectangular room's wall exactly as its compass view", () => {
    const p = testProject([testItem("a", "table", 1600, 350), testItem("h", "hood-wall", 4000, 550), testItem("island", "table-island", 4000, 3000)]);
    const plain = (id: ElevationId, cut: "wall" | "room") => JSON.parse(JSON.stringify(elevationDrawing(p, id, { showDims: true, cut })));
    for (const cut of ["wall", "room"] as const) {
      expect(plain("wall-0", cut)).toEqual(plain("north", cut));
      expect(plain("wall-2", cut)).toEqual(plain("south", cut));
    }
  });

  it("shows a slanted wall face-on: its length, its window, its units at their true width", () => {
    const p = chamfered();
    const shapes = elevationDrawing(p, "wall-1", { showDims: true, cut: "room" }).shapes;
    // The table on the chamfer at its true 1200 mm, with its front (it faces the viewer).
    const b = extent(body(shapes, "chamfer"));
    expect(b[1] - b[0]).toBe(1200);
    expect(polys(shapes).filter((s) => s.itemId === "chamfer" && s.pen === "detail").length).toBeGreaterThan(2);
    // The window, 800 mm wide less its frame; no compass view draws it.
    expect(glass(shapes).map((s) => Math.round(bounds(s.pts).maxX - bounds(s.pts).minX))).toEqual([800 - 120]);
    for (const f of ["north", "east", "south", "west"] as const) expect(glass(elevationDrawing(p, f, WHOLE).shapes)).toEqual([]);
    // From corner to corner: the wall's length dimensioned, the neighbours cut at 45° as wide as
    // a 240 mm wall cut at that angle.
    expect(shapes.filter((s): s is DimShape => s.t === "dim").map((d) => d.text)).toEqual(["1414", "3000"]);
    const ends = polys(shapes).filter((s) => s.fill === "wall" && !s.itemId);
    expect(ends).toHaveLength(2);
    for (const e of ends) expect(width(e)).toBeCloseTo(240 * Math.SQRT2);
    expect(bounds(ends[0].pts).maxX).toBeCloseTo(7000 * Math.SQRT1_2);
    expect(bounds(ends[1].pts).minX).toBeCloseTo(9000 * Math.SQRT1_2);
  });

  it("keeps to what stands in front of the wall, whatever the cut depth", () => {
    const p = chamfered();
    for (const cut of ELEVATION_CUTS) expect(ids(elevationDrawing(p, "wall-1", { showDims: false, cut }).shapes), cut).toEqual(["chamfer"]);
    // The compass view still shows the north wall's line and the chamfer table, foreshortened.
    const north = elevationDrawing(p, "north", { showDims: false }).shapes;
    expect(ids(north)).toEqual(["chamfer", "line"]);
    expect(width(body(north, "chamfer"))).toBeCloseTo(1900 * Math.SQRT1_2);
  });

  it("measures a wall view's cut depth from its wall: half the room across from it", () => {
    const p = chamfered();
    expect(cutDepth(p.room, "wall-1", "wall")).toBe(WALL_CUT_DEPTH);
    const v = elevationAxes(p.room, "wall-1")!.v;
    const ds = p.room.points.map((q) => q.x * v.x + q.y * v.y);
    expect(cutDepth(p.room, "wall-1", "half")).toBeCloseTo((Math.max(...ds) - Math.min(...ds)) / 2);
    expect(cutDepth(p.room, "wall-1", "room")).toBe(Infinity);
    // A unit 2 m in front of the chamfer is beyond the default band, within half the room.
    const far = onWall(p, 1, Math.SQRT2 * 500, 2000);
    p.items.push({ ...testItem("far", "table", far.x, far.y, rotationFacing(walls(p.room)[1])), pos: 3 });
    expect(ids(elevationDrawing(p, "wall-1", { showDims: false }).shapes)).toEqual(["chamfer"]);
    expect(ids(elevationDrawing(p, "wall-1", { showDims: false, cut: "half" }).shapes)).toEqual(["chamfer", "far"]);
  });

  it("cuts a partition off at the ends of the wall's stretch", () => {
    const p = chamfered();
    // Parallel to the chamfer, 1 m in front of it and longer than it at both ends.
    p.room.partitions = [{ id: "pp", a: onWall(p, 1, -1000, 1000), b: onWall(p, 1, 2414, 1000), thickness: 100, height: 2000 }];
    const surfaces = polys(elevationDrawing(p, "wall-1", WHOLE).shapes).filter((s) => s.pen === "wall" && s.closed && !s.itemId && s.fill === "item");
    expect(surfaces).toHaveLength(1);
    expect(bounds(surfaces[0].pts).minX).toBeCloseTo(7000 * Math.SQRT1_2);
    expect(bounds(surfaces[0].pts).maxX).toBeCloseTo(9000 * Math.SQRT1_2);
  });
});
