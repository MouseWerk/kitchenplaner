import { describe, expect, it } from "vitest";
import { leaderLine, planDrawing } from "./plan";
import { exampleKitchen } from "../examples/exampleKitchen";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS, SHEET_SCALES } from "../render/svg";
import { area, bounds, footprint, pointInPolygon } from "./geometry";
import { testItem, testProject } from "./testProject";
import type { Opening, Partition } from "./types";
import { expandDim, type ArcShape, type DimShape, type PolyShape, type Shape, type TextShape } from "../render/drawing";

const ALL = { showNames: true, showDims: true };
const NONE = { showNames: false, showDims: false };

const polys = (s: Shape[]) => s.filter((x): x is PolyShape => x.t === "poly");
const texts = (s: Shape[]) => s.filter((x): x is TextShape => x.t === "text");
const dims = (s: Shape[]) => s.filter((x): x is DimShape => x.t === "dim");
const ofItem = (s: Shape[], id: string) => s.filter((x) => x.itemId === id);

describe("planDrawing walls", () => {
  it("fills the wall band with mitered corners, minus the door gap", () => {
    const p = testProject();
    const walls = polys(planDrawing(p, NONE).shapes).filter((s) => s.fill === "wall");
    // One door: one piece running around all four corners, from one side of the door to the other.
    expect(walls).toHaveLength(1);
    expect(walls[0].pts).toHaveLength(12);
    const total = walls.reduce((s, w) => s + area(w.pts), 0);
    const expected = 8480 * 6480 - 8000 * 6000 - 1010 * 240;
    expect(total).toBeCloseTo(expected, 3);
    const b = bounds(walls.flatMap((w) => w.pts));
    expect(b).toEqual({ minX: -240, minY: -240, maxX: 8240, maxY: 6240 });
  });

  it("closes the wall ring of a room without openings", () => {
    const p = testProject();
    p.room.openings = [];
    const walls = polys(planDrawing(p, NONE).shapes).filter((s) => s.fill === "wall");
    expect(walls).toHaveLength(1);
    expect(walls.reduce((s, w) => s + area(w.pts), 0)).toBeCloseTo(8480 * 6480 - 8000 * 6000, 3);
  });

  it("draws the door leaf and its swing arc into the room, hinged at the start side", () => {
    const shapes = planDrawing(testProject(), NONE).shapes;
    const arcs = shapes.filter((s): s is ArcShape => s.t === "arc" && s.pen === "swing");
    expect(arcs).toHaveLength(1);
    const arc = arcs[0];
    // Wall 2 runs west; offset 6800 - 505 from (8000, 6000) is x 1705.
    expect(arc.c.x).toBeCloseTo(1705);
    expect(arc.c.y).toBeCloseTo(6000);
    expect(arc.r).toBe(1010);
    expect(arc.a1 - arc.a0).toBe(90);
    const mid = ((arc.a0 + arc.a1) / 2) * (Math.PI / 180);
    const onArc = { x: arc.c.x + arc.r * Math.cos(mid), y: arc.c.y + arc.r * Math.sin(mid) };
    expect(pointInPolygon(onArc, testProject().room.points)).toBe(true);
    const leaf = polys(shapes).find((s) => s.pen === "opening");
    expect(leaf?.pts.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) }))).toEqual([
      { x: 1705, y: 6000 },
      { x: 1705, y: 4990 },
    ]);
  });

  it("draws a window as two panes and a passage dashed", () => {
    const p = testProject();
    p.room.openings = [
      { id: "w", kind: "window", wall: 0, offset: 2000, width: 1200, height: 1200, sill: 900 },
      { id: "pa", kind: "passage", wall: 1, offset: 3000, width: 1000, height: 2100, sill: 0 },
    ];
    const ps = polys(planDrawing(p, NONE).shapes);
    const panes = ps.filter((s) => s.pen === "opening" && Math.abs(s.pts[0].y - s.pts[1].y) < 1e-6);
    expect(panes.map((s) => s.pts[0].y).sort((a, b) => a - b)).toEqual([-160, -80]);
    expect(ps.filter((s) => s.pen === "hidden")).toHaveLength(2);
    expect(ps.filter((s) => s.fill === "wall")).toHaveLength(2);
  });
});

describe("planDrawing dimensions", () => {
  it("dimensions every wall outside the room and the overall size further out", () => {
    // A step in the north side: no single wall runs the whole width, so the overall width is
    // dimensioned; the west wall runs the whole depth, which its own dimension says already.
    const p = testProject();
    p.room.points = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 500 },
      { x: 8000, y: 500 },
      { x: 8000, y: 6000 },
      { x: 0, y: 6000 },
    ];
    p.room.openings = [];
    const ds = dims(planDrawing(p, ALL).shapes);
    expect(ds.map((d) => d.text)).toEqual(["3000", "500", "5000", "5500", "8000", "6000", "8000"]);
    for (const d of ds.slice(0, 6)) {
      const line = expandDim(d, 50).lines[2];
      const mid = { x: (line[0].x + line[1].x) / 2, y: (line[0].y + line[1].y) / 2 };
      expect(pointInPolygon(mid, p.room.points)).toBe(false);
    }
    expect(Math.abs(ds[6].offset)).toBeGreaterThan(Math.abs(ds[0].offset));
    expect([ds[6].a, ds[6].b]).toEqual([
      { x: 0, y: 0 },
      { x: 8000, y: 0 },
    ]);
  });

  it("leaves out an overall dimension that a wall's own dimension repeats", () => {
    // A rectangle: each wall runs a whole side, so only the four wall dimensions remain.
    const ds = dims(planDrawing(testProject(), ALL).shapes);
    expect(ds.map((d) => d.text)).toEqual(["8000", "6000", "8000", "6000"]);
  });

  it("has no dimensions when they are off", () => {
    expect(dims(planDrawing(testProject(), NONE).shapes)).toHaveLength(0);
  });
});

describe("planDrawing items", () => {
  it("draws footprints, position numbers and names", () => {
    const p = testProject([testItem("a", "table", 1000, 350), testItem("b", "range-4", 3000, 450)]);
    const shapes = planDrawing(p, ALL).shapes;
    const fp = polys(ofItem(shapes, "a")).find((s) => s.pen === "item" && s.fill === "item");
    expect(bounds(fp!.pts)).toEqual({ minX: 400, minY: 0, maxX: 1600, maxY: 700 });
    const nums = texts(shapes).filter((s) => s.circled);
    expect(nums.map((s) => [s.itemId, s.text])).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(texts(ofItem(shapes, "a")).some((s) => s.text === "table" && !s.circled)).toBe(true);
    expect(texts(planDrawing(p, NONE).shapes).filter((s) => !s.circled)).toHaveLength(0);
  });

  it("draws overhead items dashed without fill, after the floor items", () => {
    const p = testProject([testItem("hood", "hood-wall", 2000, 550), testItem("r", "range-6", 2000, 450)]);
    const shapes = planDrawing(p, NONE).shapes;
    const hoodIdx = shapes.findIndex((s) => s.itemId === "hood");
    const rangeIdx = shapes.findIndex((s) => s.itemId === "r");
    expect(rangeIdx).toBeLessThan(hoodIdx);
    const hoodOutline = shapes[hoodIdx] as PolyShape;
    expect(hoodOutline.pen).toBe("overhead");
    expect(hoodOutline.fill).toBe("none");
  });

  it("draws by placement: floor units, flat ones unfilled, table-top units filled, overhead dashed on top", () => {
    const p = testProject([
      testItem("hood", "hood-wall", 2000, 550),
      testItem("s", "prep-slicer", 1700, 300),
      testItem("drain", "floor-drain", 2000, 350),
      testItem("t", "table", 2000, 350),
    ]);
    const shapes = planDrawing(p, NONE).shapes;
    const first = (id: string) => shapes.findIndex((s) => s.itemId === id);
    expect(first("t")).toBeLessThan(first("drain"));
    expect(first("drain")).toBeLessThan(first("s"));
    expect(first("s")).toBeLessThan(first("hood"));
    const outline = (id: string) => shapes[first(id)] as PolyShape;
    expect([outline("t").pen, outline("t").fill]).toEqual(["item", "item"]);
    expect([outline("drain").pen, outline("drain").fill]).toEqual(["item", "none"]);
    expect([outline("s").pen, outline("s").fill]).toEqual(["item", "item"]);
    expect([outline("hood").pen, outline("hood").fill]).toEqual(["overhead", "none"]);
  });

  it("draws a round column as a filled circle with the wall pen", () => {
    const p = testProject([testItem("c", "column-round", 3000, 3000)]);
    const outline = planDrawing(p, NONE).shapes.find((s) => s.itemId === "c") as PolyShape;
    expect([outline.pen, outline.fill, outline.closed]).toEqual(["wall", "wall", true]);
    expect(outline.pts.length).toBeGreaterThan(16);
    for (const q of outline.pts) expect(Math.hypot(q.x - 3000, q.y - 3000)).toBeCloseTo(200, 6);
  });

  it("gives a range 4 or 6 plates by width and a sink 1 or 2 bowls", () => {
    const circles = (catalogId: string, width?: number) => {
      const p = testProject([testItem("x", catalogId, 3000, 3000, 0, width ? { width } : {})]);
      return planDrawing(p, NONE).shapes.filter((s) => s.t === "circle" && s.itemId === "x").length;
    };
    expect(circles("range-4")).toBe(4);
    expect(circles("range-6")).toBe(6);
    // A sink: one drain circle and one tap per bowl, as in 3D and the elevation.
    expect(circles("sink-1", 1200)).toBe(2);
    expect(circles("sink-1", 1600)).toBe(4);
  });

  it("turns symbols with the item: a table at 270 degrees has its back and upstand along the west wall", () => {
    const p = testProject([testItem("t", "table", 350, 3000, 270)]);
    const shapes = ofItem(planDrawing(p, NONE).shapes, "t");
    const fp = polys(shapes)[0];
    const b = bounds(fp.pts);
    expect([b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v) + 0)).toEqual([0, 700, 2400, 3600]);
    const upstand = polys(shapes).find((s) => s.pen === "detail")!;
    // Turned clockwise by 270 the front faces east, the back west: the upstand lies at x 50.
    expect(upstand.pts.every((q) => Math.abs(q.x - 50) < 1e-6)).toBe(true);
  });

  it("draws a fridge door swing and a cold room door in front of the unit", () => {
    const p = testProject([testItem("f", "fridge-700", 1000, 415), testItem("c", "cold-room", 6000, 1050)]);
    const arcs = planDrawing(p, NONE).shapes.filter((s): s is ArcShape => s.t === "arc");
    const fridgeArc = arcs.find((a) => a.itemId === "f")!;
    expect(fridgeArc.pen).toBe("hidden");
    expect(fridgeArc.r).toBe(700);
    expect(fridgeArc.c).toEqual({ x: 650, y: 830 });
    expect(arcs.find((a) => a.itemId === "c")?.pen).toBe("swing");
  });

  it("draws an item with an unknown catalog id as a table", () => {
    const p = testProject([{ ...testItem("u", "table", 1000, 350), catalogId: "future-thing" }]);
    const shapes = ofItem(planDrawing(p, NONE).shapes, "u");
    expect(polys(shapes).some((s) => s.fill === "item")).toBe(true);
  });
});

describe("planDrawing partitions", () => {
  /** A full-height partition from the north wall's face 2 m into the room, 100 mm thick. */
  const N: Partition = { id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 2000 }, thickness: 100, height: 3000 };

  function withPartitions(partitions: Partition[], openings: Opening[] = []) {
    const p = testProject();
    p.room.partitions = partitions;
    p.room.openings = [...p.room.openings, ...openings];
    return p;
  }
  const bands = (s: Shape[]) => polys(s).filter((x) => x.closed && x.pen === "wall" && x.fill !== "wall");
  const partitionPieces = (p: ReturnType<typeof withPartitions>) => polys(planDrawing(p, NONE).shapes).filter((s) => s.closed && s.pen === "wall").slice(1);

  it("draws a full-height partition as a wall band flush with the wall face it starts at", () => {
    const pieces = partitionPieces(withPartitions([N]));
    expect(pieces).toHaveLength(1);
    expect(pieces[0].fill).toBe("wall");
    expect(bounds(pieces[0].pts)).toEqual({ minX: 2950, minY: 0, maxX: 3050, maxY: 2000 });
    expect(area(pieces[0].pts)).toBeCloseTo(2000 * 100, 3);
    // The outer wall ring is unchanged.
    const ring = polys(planDrawing(withPartitions([N]), NONE).shapes)[0];
    expect(area(ring.pts)).toBeCloseTo(8480 * 6480 - 8000 * 6000 - 1010 * 240, 3);
  });

  it("draws a partition lower than the room lighter, on the same pen", () => {
    const shapes = planDrawing(withPartitions([{ ...N, height: 1100 }]), NONE).shapes;
    expect(bands(shapes)).toHaveLength(1);
    expect(bands(shapes)[0].fill).toBe("item-dark");
  });

  it("joins a T without overlap: the branch stops at the face of the partition it meets", () => {
    const E: Partition = { id: "e", a: { x: 3000, y: 1000 }, b: { x: 6000, y: 1000 }, thickness: 100, height: 3000 };
    const pieces = partitionPieces(withPartitions([N, E]));
    expect(pieces).toHaveLength(2);
    expect(bounds(pieces[1].pts).minX).toBeCloseTo(3050);
    expect(pieces.reduce((s, q) => s + area(q.pts), 0)).toBeCloseTo(2000 * 100 + 2950 * 100, 3);
  });

  it("splits the band at its openings and draws a door swinging to the left of a→b, hinged at the start", () => {
    // N runs south; left of south is east. The door spans y 500 to 1400.
    const door: Opening = { id: "d", kind: "door", wall: 0, partition: "n", offset: 950, width: 900, height: 2100, sill: 0 };
    const shapes = planDrawing(withPartitions([N], [door]), NONE).shapes;
    const pieces = polys(shapes).filter((s) => s.closed && s.pen === "wall").slice(1);
    expect(pieces.map((q) => [bounds(q.pts).minY, bounds(q.pts).maxY])).toEqual([
      [0, 500],
      [1400, 2000],
    ]);
    const arc = shapes.filter((s): s is ArcShape => s.t === "arc" && s.pen === "swing").find((a) => a.c.x > 2000)!;
    expect(arc.c.x).toBeCloseTo(3050);
    expect(arc.c.y).toBeCloseTo(500);
    const mid = ((arc.a0 + arc.a1) / 2) * (Math.PI / 180);
    expect(arc.c.x + arc.r * Math.cos(mid)).toBeGreaterThan(3050);
    // The north wall keeps its full band: the opening's wall index 0 does not cut it.
    expect(polys(shapes).filter((s) => s.fill === "wall" && bounds(s.pts).minY < 0)).toHaveLength(1);
  });

  it("draws a hatch as a sill double line with a shelf on both sides, in a partition and in an outer wall", () => {
    const inPartition: Opening = { id: "h", kind: "hatch", wall: 0, partition: "n", offset: 1000, width: 1200, height: 800, sill: 900 };
    const inWall: Opening = { id: "h2", kind: "hatch", wall: 1, offset: 3000, width: 1200, height: 800, sill: 900 };
    const shapes = planDrawing(withPartitions([N], [inPartition, inWall]), NONE).shapes;
    const shelves = polys(shapes).filter((s) => s.pen === "detail" && !s.itemId);
    expect(shelves).toHaveLength(4);
    // In the partition: the shelves reach 250 mm past each face, x 3300 and 2700.
    const xs = shelves.map((s) => Math.round(s.pts[1].x)).sort((a, b) => a - b);
    expect(xs).toEqual([2700, 3300, 7750, 8490]);
    // The sill edges on both faces of the partition.
    const sills = polys(shapes).filter((s) => s.pen === "opening" && s.pts.length === 2 && Math.abs(s.pts[0].x - s.pts[1].x) < 1e-6 && s.pts[0].x > 2000 && s.pts[0].x < 4000);
    expect(sills.map((s) => Math.round(s.pts[0].x)).sort()).toEqual([2950, 3050]);
  });
});

describe("planDrawing position numbers", () => {
  /** Centres of the position circles (plan mm) at a paper scale. */
  const circles = (shapes: Shape[], ps: number) =>
    shapes
      .filter((s): s is TextShape => s.t === "text" && s.circled === true)
      .map((s) => ({ id: s.itemId!, x: s.p.x, y: s.p.y - CIRCLE_CENTER_RISE * s.size * ps, r: CIRCLE_RADIUS * s.size * ps }));

  // 40: the screen; the others: every scale a sheet may print the plan at.
  it.each([40, ...SHEET_SCALES])("never lets two numbers of the example kitchen overlap (1:%i)", (ps) => {
    const p = exampleKitchen("de");
    const cs = circles(planDrawing(p, { showNames: false, showDims: true, paperScale: ps }).shapes, ps);
    expect(cs).toHaveLength(p.items.length);
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const d = Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y);
        expect(d, `${cs[i].id} / ${cs[j].id}`).toBeGreaterThanOrEqual(cs[i].r + cs[j].r);
      }
    }
  });

  it("draws a leader to a unit whose number had to move clear of it, and none for a number on its unit", () => {
    // At 1:500 the circles are 2.4 m wide: the example kitchen's small units get numbers outside.
    const p = exampleKitchen("de");
    const shapes = planDrawing(p, { ...NONE, paperScale: 500 }).shapes;
    const cs = circles(shapes, 500);
    const leaders = polys(shapes).filter((s) => s.pen === "detail" && !s.closed && s.pts.length === 2 && cs.some((c) => c.id === s.itemId && Math.abs(Math.hypot(s.pts[0].x - c.x, s.pts[0].y - c.y) - c.r) < 1));
    expect(leaders.length).toBeGreaterThan(0);
    for (const l of leaders) {
      const it = p.items.find((x) => x.id === l.itemId)!;
      // It ends on the unit's outline.
      const b = bounds(footprint(it));
      expect(l.pts[1].x).toBeGreaterThanOrEqual(b.minX - 1);
      expect(l.pts[1].x).toBeLessThanOrEqual(b.maxX + 1);
      expect(l.pts[1].y).toBeGreaterThanOrEqual(b.minY - 1);
      expect(l.pts[1].y).toBeLessThanOrEqual(b.maxY + 1);
    }
    expect(leaderLine(testItem("t", "table", 2000, 2000), { x: 2000, y: 2000 }, 100)).toBeNull();
    expect(leaderLine(testItem("t", "table", 2000, 2000), { x: 2000, y: 2400 }, 100)).toBeNull();
    expect(leaderLine(testItem("t", "table", 2000, 2000), { x: 2000, y: 2700 }, 100)).toEqual([
      { x: 2000, y: 2600 },
      { x: 2000, y: 2350 },
    ]);
  });

  it("puts a floor unit's number in its middle and the number of a hood above it towards the hood's front right", () => {
    const p = testProject([testItem("h", "hood-wall", 2000, 550), testItem("r", "range-6", 2000, 450)]);
    const cs = circles(planDrawing(p, { ...NONE, paperScale: 50 }).shapes, 50);
    const range = cs.find((c) => c.id === "r")!;
    const hood = cs.find((c) => c.id === "h")!;
    expect([range.x, range.y]).toEqual([2000, 450]);
    // The hood (2400 × 1100 at 2000, 550): right of and in front of its centre, inside it.
    expect(hood.x).toBeGreaterThan(2000);
    expect(hood.y).toBeGreaterThan(550);
    expect(hood.x + hood.r).toBeLessThanOrEqual(3200);
    expect(hood.y + hood.r).toBeLessThanOrEqual(1100);
    expect(Math.hypot(hood.x - range.x, hood.y - range.y)).toBeGreaterThanOrEqual(2 * range.r);
  });

  it("moves a number off another one, the same way every time", () => {
    // Two drains side by side, closer than two circles: the second number moves.
    const p = testProject([testItem("a", "floor-drain", 2000, 2000), testItem("b", "floor-drain", 2150, 2000)]);
    const one = circles(planDrawing(p, { ...NONE, paperScale: 50 }).shapes, 50);
    expect([one[0].x, one[0].y]).toEqual([2000, 2000]);
    expect(Math.hypot(one[1].x - one[0].x, one[1].y - one[0].y)).toBeGreaterThanOrEqual(2 * one[0].r);
    expect(circles(planDrawing(p, { ...NONE, paperScale: 50 }).shapes, 50)).toEqual(one);
  });
});
