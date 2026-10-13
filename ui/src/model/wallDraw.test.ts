import { describe, expect, it } from "vitest";
import { rectRoom } from "./geometry";
import { testProject } from "./testProject";
import { closesOutline, isValidOutline, nextPoint, pointAt, replaceOutline, selfIntersects, snapDirection, snapPoint } from "./wallDraw";

const opts = { grid: 50, radius: 100, corners: [], free: false, typed: null };

describe("snapDirection", () => {
  it("turns the direction to the nearest 45° step", () => {
    expect(snapDirection({ x: 0, y: 0 }, { x: 1000, y: 80 })).toEqual({ x: 1, y: 0 });
    expect(snapDirection({ x: 0, y: 0 }, { x: -50, y: 1000 })).toEqual({ x: 0, y: 1 });
    const d = snapDirection({ x: 0, y: 0 }, { x: 1000, y: 900 });
    expect(d.x).toBeCloseTo(Math.SQRT1_2);
    expect(d.y).toBeCloseTo(Math.SQRT1_2);
    expect(snapDirection({ x: 0, y: 0 }, { x: -1000, y: 10 })).toEqual({ x: -1, y: 0 });
  });
});

describe("nextPoint", () => {
  it("snaps the direction and the length to the grid", () => {
    expect(nextPoint({ x: 0, y: 0 }, { x: 2420, y: 130 }, opts).p).toEqual({ x: 2400, y: 0 });
    expect(nextPoint({ x: 0, y: 0 }, { x: 60, y: -1630 }, opts).p).toEqual({ x: 0, y: -1650 });
  });

  it("draws freely with `free`, still on the grid", () => {
    expect(nextPoint({ x: 0, y: 0 }, { x: 2420, y: 130 }, { ...opts, free: true }).p).toEqual({ x: 2400, y: 150 });
  });

  it("takes a typed length exactly, in the snapped direction of the cursor", () => {
    expect(nextPoint({ x: 100, y: 100 }, { x: 900, y: 140 }, { ...opts, typed: 3725 }).p).toEqual({ x: 3825, y: 100 });
    expect(nextPoint({ x: 0, y: 0 }, { x: 10, y: 900 }, { ...opts, typed: 1234.5 }).p).toEqual({ x: 0, y: 1234.5 });
  });

  it("snaps onto a corner within the radius", () => {
    const r = nextPoint({ x: 0, y: 0 }, { x: 3030, y: 1950 }, { ...opts, corners: [{ x: 3000, y: 2000 }] });
    expect(r.p).toEqual({ x: 3000, y: 2000 });
    expect(r.target).toEqual({ x: 3000, y: 2000 });
  });

  it("stops an axis-aligned wall where it lines up with another corner, with a guide", () => {
    const r = nextPoint({ x: 0, y: 3000 }, { x: 4020, y: 3010 }, { ...opts, grid: 100, corners: [{ x: 4033, y: 0 }] });
    expect(r.p).toEqual({ x: 4033, y: 3000 });
    expect(r.guides).toEqual([{ from: { x: 4033, y: 0 }, to: { x: 4033, y: 3000 } }]);
  });

  it("stops where the wall meets a segment near the cursor", () => {
    const r = nextPoint({ x: 0, y: 0 }, { x: 2980, y: 0 }, { ...opts, grid: 100, segments: [{ a: { x: 2975, y: -1000 }, b: { x: 2975, y: 1000 } }] });
    expect(r.p).toEqual({ x: 2975, y: 0 });
  });
});

describe("snapPoint", () => {
  it("prefers corners, then aligns each axis with a corner, else the grid", () => {
    const corners = [{ x: 1000, y: 1000 }];
    expect(snapPoint({ x: 1040, y: 980 }, { grid: 50, radius: 100, corners }).p).toEqual({ x: 1000, y: 1000 });
    const a = snapPoint({ x: 1030, y: 4020 }, { grid: 50, radius: 50, corners });
    expect(a.p).toEqual({ x: 1000, y: 4000 });
    expect(a.guides).toHaveLength(1);
    expect(snapPoint({ x: 3030, y: 4020 }, { grid: 50, radius: 50, corners }).p).toEqual({ x: 3050, y: 4000 });
  });
});

describe("pointAt", () => {
  it("measures along a unit direction", () => {
    expect(pointAt({ x: 10, y: 20 }, { x: 0, y: -1 }, 500)).toEqual({ x: 10, y: -480 });
  });
});

describe("closesOutline", () => {
  const pts = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }];
  it("closes on the first point with three or more points", () => {
    expect(closesOutline(pts, { x: 20, y: 30 }, 50)).toBe(true);
    expect(closesOutline(pts, { x: 200, y: 30 }, 50)).toBe(false);
    expect(closesOutline(pts.slice(0, 2), { x: 0, y: 0 }, 50)).toBe(false);
  });
});

describe("outline validity", () => {
  it("accepts simple polygons, rejects crossing, folded and degenerate ones", () => {
    expect(isValidOutline(rectRoom(4000, 3000))).toBe(true);
    const bowtie = [{ x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 1000, y: 0 }, { x: 0, y: 1000 }];
    expect(selfIntersects(bowtie)).toBe(true);
    expect(isValidOutline(bowtie)).toBe(false);
    // A wall running back over its neighbour.
    expect(isValidOutline([{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }])).toBe(false);
    expect(isValidOutline([{ x: 0, y: 0 }, { x: 1000, y: 0 }])).toBe(false);
    expect(isValidOutline([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 }])).toBe(false);
    expect(isValidOutline([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 0.5 }, { x: 1000, y: 1000 }])).toBe(false);
  });
});

describe("replaceOutline", () => {
  it("keeps openings on walls that still run through them, wherever the drawing started", () => {
    const room = testProject().room;
    // The same room drawn counter-clockwise from the south-west corner: the door (x 755 to 1765 on the south wall) stays.
    const redrawn = replaceOutline(room, [{ x: 0, y: 6000 }, { x: 8000, y: 6000 }, { x: 8000, y: 0 }, { x: 0, y: 0 }]);
    expect(redrawn.openings).toHaveLength(1);
    expect(redrawn.openings[0]).toMatchObject({ id: "door1", wall: 0, offset: 1200 });
  });

  it("drops openings whose wall moved and keeps partition openings", () => {
    const base = testProject().room;
    const room = {
      ...base,
      partitions: [{ id: "p", a: { x: 4000, y: 0 }, b: { x: 4000, y: 3000 }, thickness: 100, height: 3000 }],
      openings: [...base.openings, { id: "h", kind: "hatch" as const, wall: 0, partition: "p", offset: 1500, width: 1200, height: 800, sill: 900 }],
    };
    const next = replaceOutline(room, rectRoom(8000, 5000));
    expect(next.openings.map((o) => o.id)).toEqual(["h"]);
    expect(next.partitions).toBe(room.partitions);
  });
});
