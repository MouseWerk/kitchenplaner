import { describe, expect, it } from "vitest";
import { constrainMeasure, measure, measureTargets, snapMeasurePoint } from "./measure";
import { testItem, testProject } from "./testProject";

// An 8 × 6 m room with a 1200 × 600 table against the north wall (x 1000 to 2200, y 0 to 600)
// and a partition from (5000, 2000) to (5000, 6000), 100 thick.
const project = {
  ...testProject([testItem("t", "table", 1600, 300, 0, { width: 1200, depth: 600 })]),
};
project.room = { ...project.room, partitions: [{ id: "p", a: { x: 5000, y: 2000 }, b: { x: 5000, y: 6000 }, thickness: 100, height: 3000 }] };
const targets = measureTargets(project);

describe("measure snapping", () => {
  it("snaps to item corners and edge middles first", () => {
    expect(snapMeasurePoint({ x: 2190, y: 612 }, targets, 50, 50)).toEqual({ p: { x: 2200, y: 600 }, kind: "point" });
    expect(snapMeasurePoint({ x: 1610, y: 590 }, targets, 50, 50)).toEqual({ p: { x: 1600, y: 600 }, kind: "point" });
  });

  it("snaps to the room's corners and the partition's corners", () => {
    expect(snapMeasurePoint({ x: 7980, y: 5990 }, targets, 50, 50)).toEqual({ p: { x: 8000, y: 6000 }, kind: "point" });
    expect(snapMeasurePoint({ x: 4955, y: 2010 }, targets, 50, 50)).toEqual({ p: { x: 4950, y: 2000 }, kind: "point" });
  });

  it("snaps onto an edge (wall face, partition face, item edge) where no corner is near", () => {
    expect(snapMeasurePoint({ x: 7983, y: 3333 }, targets, 50, 50)).toEqual({ p: { x: 8000, y: 3333 }, kind: "edge" });
    expect(snapMeasurePoint({ x: 4940, y: 4321 }, targets, 50, 50)).toEqual({ p: { x: 4950, y: 4321 }, kind: "edge" });
    expect(snapMeasurePoint({ x: 1333, y: 620 }, targets, 50, 50)).toEqual({ p: { x: 1333, y: 600 }, kind: "edge" });
  });

  it("falls back to the grid, or to the free point without one", () => {
    expect(snapMeasurePoint({ x: 3333, y: 3377 }, targets, 50, 50)).toEqual({ p: { x: 3350, y: 3400 }, kind: "grid" });
    expect(snapMeasurePoint({ x: 3333.33, y: 3377.77 }, targets, 50, 0)).toEqual({ p: { x: 3333.3, y: 3377.8 }, kind: "free" });
  });

  it("follows the snap radius", () => {
    expect(snapMeasurePoint({ x: 2240, y: 640 }, targets, 30, 0).kind).toBe("free");
    expect(snapMeasurePoint({ x: 2240, y: 640 }, targets, 60, 0).kind).toBe("point");
  });
});

describe("Shift: 45° steps", () => {
  const a = { x: 1000, y: 3000 };
  it("holds the line horizontal and keeps the snapped end along it", () => {
    // Pointing at the east wall a bit off the horizontal: the end lies on the wall, on a's line.
    const s = constrainMeasure(a, { p: { x: 8000, y: 3150 }, kind: "edge" });
    expect(s.p).toEqual({ x: 8000, y: 3000 });
    expect(s.kind).toBe("free");
    // Already on the line: the snap stays.
    expect(constrainMeasure(a, { p: { x: 8000, y: 3000 }, kind: "edge" }).kind).toBe("edge");
  });

  it("turns to the diagonal", () => {
    const s = constrainMeasure(a, { p: { x: 2000, y: 2100 }, kind: "free" });
    expect(s.p.x - a.x).toBeCloseTo(-(s.p.y - a.y), 6);
  });
});

describe("measure", () => {
  it("gives the distance, the offsets along the axes and the direction", () => {
    expect(measure({ x: 0, y: 0 }, { x: 3000, y: 4000 })).toEqual({ a: { x: 0, y: 0 }, b: { x: 3000, y: 4000 }, length: 5000, dx: 3000, dy: 4000, angle: 53.1 });
    expect(measure({ x: 1000, y: 1000 }, { x: 1000, y: 0 }).angle).toBe(270);
    expect(measure({ x: 1000, y: 1000 }, { x: 0, y: 1000 })).toMatchObject({ length: 1000, dx: -1000, dy: 0, angle: 180 });
  });

  it("measures from the table's side to the partition's face", () => {
    const front = snapMeasurePoint({ x: 2195, y: 300 }, targets, 50, 50);
    expect(front).toEqual({ p: { x: 2200, y: 300 }, kind: "point" });
    expect(measure(front.p, snapMeasurePoint({ x: 4945, y: 2500 }, targets, 50, 50).p).dx).toBe(2750);
  });
});
