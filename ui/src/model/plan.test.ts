import { describe, expect, it } from "vitest";
import { planDrawing } from "./plan";
import { area, bounds, pointInPolygon } from "./geometry";
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
    const p = testProject();
    const ds = dims(planDrawing(p, ALL).shapes);
    expect(ds.map((d) => d.text)).toEqual(["8000", "6000", "8000", "6000", "8000", "6000"]);
    for (const d of ds.slice(0, 4)) {
      const line = expandDim(d, 50).lines[2];
      const mid = { x: (line[0].x + line[1].x) / 2, y: (line[0].y + line[1].y) / 2 };
      expect(pointInPolygon(mid, p.room.points)).toBe(false);
    }
    expect(Math.abs(ds[4].offset)).toBeGreaterThan(Math.abs(ds[0].offset));
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

  it("gives a range 4 or 6 plates by width and a sink 1 or 2 bowls", () => {
    const circles = (catalogId: string, width?: number) => {
      const p = testProject([testItem("x", catalogId, 3000, 3000, 0, width ? { width } : {})]);
      return planDrawing(p, NONE).shapes.filter((s) => s.t === "circle" && s.itemId === "x").length;
    };
    expect(circles("range-4")).toBe(4);
    expect(circles("range-6")).toBe(6);
    // A sink: one drain circle per bowl plus the tap.
    expect(circles("sink-1", 1200)).toBe(2);
    expect(circles("sink-1", 1600)).toBe(3);
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
