import { describe, expect, it } from "vitest";
import { cutDepth, ELEVATION_CUTS, elevationDrawing, facingAxes, WALL_CUT_DEPTH } from "./elevation";
import { bounds, lRoom } from "./geometry";
import { positions } from "./project";
import { exampleKitchen } from "../examples/exampleKitchen";
import { testItem, testProject } from "./testProject";
import type { Opening, Partition } from "./types";
import { TEXT, type DimShape, type PolyShape, type Shape, type TextShape } from "../render/drawing";
import { CIRCLE_RADIUS } from "../render/svg";

const polys = (s: Shape[]) => s.filter((x): x is PolyShape => x.t === "poly");
const body = (s: Shape[], id: string) => polys(s).find((x) => x.itemId === id && x.pen === "item" && x.fill === "item")!;
const extent = (p: PolyShape) => {
  const b = bounds(p.pts);
  return [b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v) + 0);
};

/** The whole room projected, without a cut depth. */
const WHOLE = { showDims: false, cut: "room" } as const;

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
      const shapes = elevationDrawing(p, facing, WHOLE).shapes;
      return ["near", "far"].sort((a, b) => shapes.indexOf(body(shapes, a)) - shapes.indexOf(body(shapes, b)));
    };
    expect(order("north")).toEqual(["far", "near"]);
    expect(order("south")).toEqual(["near", "far"]);
  });

  it("projects a turned item and shows its front only from the side it faces", () => {
    // At 90 degrees the front faces west: the item stands against the east wall.
    const p = testProject([testItem("t", "table-cabinet", 7650, 3000, 90)]);
    const east = elevationDrawing(p, "east", WHOLE).shapes;
    expect(extent(body(east, "t"))).toEqual([2400, 3600, -900, 0]);
    expect(polys(east).filter((s) => s.itemId === "t" && s.pen === "detail").length).toBeGreaterThan(2);

    const west = elevationDrawing(p, "west", WHOLE).shapes;
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

describe("elevationDrawing partitions", () => {
  /** East-west across the room at y 3000, x 2000 to 6000: seen face-on from north and south. */
  const EW: Partition = { id: "ew", a: { x: 2000, y: 3000 }, b: { x: 6000, y: 3000 }, thickness: 100, height: 3000 };
  /** North-south from the north wall: seen end-on from north and south. */
  const NS: Partition = { id: "ns", a: { x: 1000, y: 0 }, b: { x: 1000, y: 2000 }, thickness: 120, height: 2000 };

  function project(items = [] as ReturnType<typeof testItem>[], openings: Opening[] = []) {
    const p = testProject(items);
    p.room.partitions = [EW, NS];
    p.room.openings = [...p.room.openings, ...openings];
    return p;
  }
  const surfaces = (s: Shape[]) => polys(s).filter((x) => x.pen === "wall" && x.closed && !x.itemId);

  it("shows a partition seen face-on as a covering wall surface and one seen end-on as a section band", () => {
    const shapes = elevationDrawing(project(), "north", WHOLE).shapes;
    const own = surfaces(shapes).slice(2);
    const face = own.find((s) => s.fill === "item")!;
    expect(extent(face)).toEqual([2000, 6000, -3000, 0]);
    const end = own.find((s) => s.fill === "wall")!;
    expect(extent(end)).toEqual([940, 1060, -2000, 0]);
  });

  it("paints a partition between the items behind it and those in front of it", () => {
    const p = project([testItem("behind", "table", 4000, 2600), testItem("front", "table", 4000, 3500)]);
    const shapes = elevationDrawing(p, "north", WHOLE).shapes;
    const face = shapes.indexOf(surfaces(shapes).find((s) => s.fill === "item")!);
    expect(shapes.indexOf(body(shapes, "behind"))).toBeLessThan(face);
    expect(shapes.indexOf(body(shapes, "front"))).toBeGreaterThan(face);
  });

  it("draws the openings of a partition seen face-on, from either side", () => {
    const door: Opening = { id: "d", kind: "door", wall: 0, partition: "ew", offset: 1000, width: 900, height: 2100, sill: 0 };
    const p = project([], [door]);
    const fromNorth = polys(elevationDrawing(p, "north", WHOLE).shapes).filter((s) => s.pen === "opening");
    // The door spans x 2550 to 3450; looking north the right axis is east.
    expect(fromNorth.map(extent)).toContainEqual([2550, 3450, -2100, 0]);
    const fromSouth = polys(elevationDrawing(p, "south", WHOLE).shapes).filter((s) => s.pen === "opening");
    // The south view also shows the outer door; the partition door appears mirrored.
    expect(fromSouth.map(extent)).toContainEqual([-3450, -2550, -2100, 0]);
    // Seen end-on (from the east) no opening of the partition shows.
    expect(polys(elevationDrawing(p, "east", WHOLE).shapes).some((s) => s.pen === "opening")).toBe(false);
  });

  it("draws a hatch with its counter shelf on the sill, in an outer wall and in a partition", () => {
    const hatches: Opening[] = [
      { id: "h", kind: "hatch", wall: 0, partition: "ew", offset: 3000, width: 1200, height: 800, sill: 900 },
      { id: "h2", kind: "hatch", wall: 0, offset: 7000, width: 1000, height: 800, sill: 900 },
    ];
    const shapes = elevationDrawing(project([], hatches), "north", WHOLE).shapes;
    const shelves = polys(shapes).filter((s) => s.fill === "item-dark" && !s.itemId).map(extent);
    expect(shelves).toEqual([
      [6500, 7500, -900, -870],
      [4400, 5600, -900, -870],
    ]);
  });

  it("cuts an opening off at the top of a half-height partition", () => {
    const low = { ...EW, height: 1200 };
    const p = testProject();
    p.room.partitions = [low];
    p.room.openings.push({ id: "h", kind: "hatch", wall: 0, partition: "ew", offset: 2000, width: 1200, height: 800, sill: 900 });
    const frame = polys(elevationDrawing(p, "north", WHOLE).shapes).find((s) => s.pen === "opening")!;
    expect(extent(frame)).toEqual([3400, 4600, -1200, -900]);
  });
});

describe("elevationDrawing cut depth", () => {
  /** Ids of the items an elevation draws. */
  const shown = (p: ReturnType<typeof testProject>, facing: "north" | "east" | "south" | "west", cut?: "wall" | "half" | "room") =>
    [...new Set(elevationDrawing(p, facing, { showDims: false, cut }).shapes.map((s) => s.itemId).filter((x): x is string => !!x))].sort();

  it("defaults to the wall: draws the line at the wall and leaves out the island across the aisle", () => {
    // A table at the north wall, an island 3 m into the room, a pass at the south wall.
    const p = testProject([testItem("line", "table", 2000, 350), testItem("island", "table-island", 4000, 3000), testItem("pass", "table", 4000, 5650, 180)]);
    expect(cutDepth(p.room, "north", "wall")).toBe(WALL_CUT_DEPTH);
    expect(shown(p, "north")).toEqual(["line"]);
    expect(shown(p, "south")).toEqual(["pass"]);
    // Half the room (3 m) reaches the island's centre; the whole room shows everything.
    expect(cutDepth(p.room, "north", "half")).toBe(3000);
    expect(shown(p, "north", "half")).toEqual(["island", "line"]);
    expect(shown(p, "north", "room")).toEqual(["island", "line", "pass"]);
  });

  it("takes an item whose centre lies in the band and draws a column the section plane cuts", () => {
    // Centre at 1450 mm from the wall: in. Centre at 1650 mm: out, unless it is a column reaching
    // to 1450 mm.
    const p = testProject([testItem("in", "table", 2000, 1450), testItem("out", "table", 4000, 1650), testItem("col", "column", 6000, 1650)]);
    expect(shown(p, "north")).toEqual(["col", "in"]);
    const col = polys(elevationDrawing(p, "north", { showDims: false }).shapes).find((s) => s.itemId === "col")!;
    expect(col.fill).toBe("wall");
  });

  it("measures an L-shaped room from the leg each unit stands in front of", () => {
    // 10 × 8 m with the south-east 4 × 3 m cut out: looking south, the south wall is at y 8000
    // for x 0 to 6000 and at y 5000 for x 6000 to 10000.
    const p = testProject([testItem("west", "table", 3000, 7650, 180), testItem("east", "table", 8000, 4650, 180), testItem("mid", "table", 8000, 2000, 180)]);
    p.room.points = lRoom(10000, 8000, 4000, 3000);
    p.room.openings = [];
    expect(shown(p, "south")).toEqual(["east", "west"]);
  });

  it("draws a partition only within the band, with a section band where the plane cuts it", () => {
    const p = testProject();
    // Across the room 3 m from the north wall: beyond the band.
    p.room.partitions = [{ id: "ew", a: { x: 2000, y: 3000 }, b: { x: 6000, y: 3000 }, thickness: 100, height: 3000 }];
    const wallsOf = (facing: "north" | "south") => polys(elevationDrawing(p, facing, { showDims: false }).shapes).filter((s) => s.pen === "wall" && s.closed && !s.itemId);
    expect(wallsOf("north")).toHaveLength(2);
    // Diagonal from the north wall into the room: seen up to the plane at y 1500, cut there.
    p.room.partitions = [{ id: "d", a: { x: 2000, y: 0 }, b: { x: 5000, y: 3000 }, thickness: 100, height: 2500 }];
    const own = wallsOf("north").slice(2);
    expect(own).toHaveLength(2);
    const [surface, section] = own.map(extent);
    expect(surface[0]).toBeLessThanOrEqual(2000);
    expect(surface[1]).toBeGreaterThan(3400);
    expect(surface[1]).toBeLessThan(3600);
    expect(own[1].fill).toBe("wall");
    // The section is as wide as the band cut at 45 degrees: 100 × √2.
    expect(section[1] - section[0]).toBeCloseTo(141, -1);
    expect(section[1]).toBe(surface[1]);
  });

  it("shows the cooking wall of the example kitchen looking north, not the units across the room", () => {
    const p = exampleKitchen("de");
    const pos = positions(p);
    const numbers = (facing: "north" | "east" | "south" | "west") => shown(p, facing).map((id) => pos.get(id)!);
    const north = numbers("north");
    for (let n = 23; n <= 32; n++) expect(north).toContain(n);
    // Not the pass (48 to 52), the island (34 to 47), the preparation table (18 to 21).
    for (let n = 18; n <= 21; n++) expect(north).not.toContain(n);
    for (let n = 34; n <= 52; n++) expect(north).not.toContain(n);
    // Looking south: the pass and the dishwashing line, not the island or the preparation row.
    const south = numbers("south");
    for (const n of [48, 49, 50, 51, 52, 59, 60, 61, 62]) expect(south).toContain(n);
    for (const n of [7, 13, 34, 40, 55]) expect(south).not.toContain(n);
  });
});

describe("elevationDrawing position numbers", () => {
  // Every quarter octave from 1:20 to 1:200: the screen's annotation scales (1:40 and coarser in
  // quarter octaves) and the export scales lie among them.
  const scales = [...Array.from({ length: 14 }, (_, q) => 20 * 2 ** (q / 4)), 200];

  it.each(scales.map((ps) => [Math.round(ps * 10) / 10, ps]))("lifts crowded numbers so none overlap in the example kitchen (1:%s)", (_, ps) => {
    const p = exampleKitchen("de");
    for (const facing of ["north", "east", "south", "west"] as const) {
      for (const cut of ELEVATION_CUTS) {
        const cs = elevationDrawing(p, facing, { showDims: true, cut, paperScale: ps }).shapes.filter((s): s is TextShape => s.t === "text" && s.circled === true);
        const r = CIRCLE_RADIUS * TEXT.normal * ps;
        for (let i = 0; i < cs.length; i++)
          for (let j = i + 1; j < cs.length; j++) expect(Math.hypot(cs[i].p.x - cs[j].p.x, cs[i].p.y - cs[j].p.y), `${facing} ${cut} ${cs[i].text}/${cs[j].text}`).toBeGreaterThanOrEqual(2 * r);
      }
    }
  });

  it("draws the position numbers on top of every unit, so no nearer unit covers one", () => {
    const p = exampleKitchen("de");
    for (const facing of ["north", "east", "south", "west"] as const) {
      for (const cut of ELEVATION_CUTS) {
        const shapes = elevationDrawing(p, facing, { showDims: true, cut }).shapes;
        const firstNumber = shapes.findIndex((s) => s.t === "text" && s.circled === true);
        const lastItemShape = shapes.findLastIndex((s) => s.t === "poly");
        expect(firstNumber, `${facing} ${cut}`).toBeGreaterThan(lastItemShape);
      }
    }
  });

  it("finds a free place for every number even at a scale where the nearby places are all taken", () => {
    const p = exampleKitchen("de");
    const ps = 1000;
    const cs = elevationDrawing(p, "north", { showDims: false, cut: "room", paperScale: ps }).shapes.filter((s): s is TextShape => s.t === "text" && s.circled === true);
    const r = CIRCLE_RADIUS * TEXT.normal * ps;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) expect(Math.hypot(cs[i].p.x - cs[j].p.x, cs[i].p.y - cs[j].p.y)).toBeGreaterThanOrEqual(2 * r);
  });
  it("hides the number of a unit a nearer partition covers completely, not of one it covers in part", () => {
    const p = testProject([testItem("hid", "table", 4000, 350), testItem("part", "table", 6000, 350)]);
    p.room.partitions = [{ id: "ew", a: { x: 2000, y: 1000 }, b: { x: 6000, y: 1000 }, thickness: 100, height: 3000 }];
    for (const cut of ELEVATION_CUTS) {
      const numbers = elevationDrawing(p, "north", { showDims: false, cut }).shapes.filter((s) => s.t === "text" && s.circled === true).map((s) => s.itemId);
      expect(numbers, cut).toEqual(["part"]);
    }
  });
});
