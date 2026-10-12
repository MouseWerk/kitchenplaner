import { describe, expect, it } from "vitest";
import { walls } from "./geometry";
import { insertCorner, isUsableOutline, moveCorner, removeCoincidentCorners } from "./roomEdit";
import { testProject } from "./testProject";
import type { Opening, Room } from "./types";

const opening = (id: string, wall: number, offset: number, width = 1000): Opening => ({ id, kind: "window", wall, offset, width, height: 1200, sill: 900 });

/** The 8 × 6 m test room (corners NW, NE, SE, SW) with the given openings. */
function room(openings: Opening[]): Room {
  return { ...testProject().room, openings };
}

/** Every opening lies inside its wall. */
function onTheirWalls(r: Room): boolean {
  const ws = walls(r);
  return r.openings.every((o) => ws[o.wall] && o.offset - o.width / 2 >= -1e-9 && o.offset + o.width / 2 <= ws[o.wall].length + 1e-9);
}

describe("insertCorner", () => {
  it("splits a wall and moves the openings of later walls one index on", () => {
    const r = insertCorner(room([opening("s", 2, 6800), opening("w", 3, 3000)]), 0, { x: 4000, y: 0 }, 50)!;
    expect(r.points).toEqual([{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }]);
    expect(r.openings.map((o) => [o.id, o.wall, o.offset])).toEqual([
      ["s", 3, 6800],
      ["w", 4, 3000],
    ]);
  });

  it("moves openings beyond the split to the new wall, counted from the new corner", () => {
    // Wall 2 runs from (8000, 6000) west to (0, 6000); the split at x 4000 lies 4000 along it.
    const r = insertCorner(room([opening("before", 2, 2000), opening("after", 2, 6800), opening("straddleA", 2, 3800), opening("straddleB", 2, 4200)]), 2, { x: 4000, y: 6000 }, 50)!;
    const at = Object.fromEntries(r.openings.map((o) => [o.id, [o.wall, o.offset]]));
    expect(at.before).toEqual([2, 2000]);
    expect(at.after).toEqual([3, 2800]);
    // Straddling openings stay in the half that holds their centre, pushed clear of the corner.
    expect(at.straddleA).toEqual([2, 3500]);
    expect(at.straddleB).toEqual([3, 500]);
    expect(onTheirWalls(r)).toBe(true);
  });

  it("refuses a corner within one grid step (at least 50 mm) of an existing one", () => {
    const r = room([]);
    expect(insertCorner(r, 0, { x: 0, y: 0 }, 50)).toBeNull();
    expect(insertCorner(r, 0, { x: 30, y: 0 }, 0)).toBeNull();
    expect(insertCorner(r, 0, { x: 7960, y: 0 }, 10)).toBeNull();
    expect(insertCorner(r, 0, { x: 80, y: 0 }, 100)).toBeNull();
    expect(insertCorner(r, 0, { x: 100, y: 0 }, 100)).not.toBeNull();
    expect(insertCorner(r, 0, { x: 50, y: 0 }, 0)).not.toBeNull();
  });
});

describe("moveCorner", () => {
  it("keeps the old position when the corner lands on a neighbouring one", () => {
    const r = room([]);
    expect(moveCorner(r, 1, { x: 0, y: 0 })).toBe(r);
    expect(moveCorner(r, 1, { x: 8000, y: 6000.5 })).toBe(r);
    expect(moveCorner(r, 0, { x: 0, y: 6000 })).toBe(r);
    expect(moveCorner(r, 1, { x: 8500, y: 0 }).points[1]).toEqual({ x: 8500, y: 0 });
  });

  it("clamps the openings of both walls at the corner into their new lengths", () => {
    // Moving the south-west corner to (0, 3000): wall 2 grows, wall 3 (west) shrinks to 3 m.
    const r = moveCorner(room([opening("south", 2, 6800, 1010), opening("west", 3, 5800), opening("north", 0, 7400)]), 3, { x: 0, y: 3000 });
    const at = Object.fromEntries(r.openings.map((o) => [o.id, [o.wall, o.offset]]));
    expect(at.south).toEqual([2, 6800]);
    expect(at.west).toEqual([3, 2500]);
    expect(at.north).toEqual([0, 7400]);
    expect(onTheirWalls(r)).toBe(true);

    // Moving it east shortens wall 2 to 3 m.
    const e = moveCorner(room([opening("south", 2, 6800, 1010)]), 3, { x: 5000, y: 6000 });
    expect(e.openings[0].offset).toBe(2495);
    expect(onTheirWalls(e)).toBe(true);
  });
});

describe("removeCoincidentCorners", () => {
  it("returns a room without repeated corners as it is", () => {
    const r = room([opening("a", 1, 3000)]);
    expect(removeCoincidentCorners(r)).toBe(r);
  });

  it("merges repeated corners, also at the end of the outline, and remaps the openings", () => {
    const r: Room = {
      ...room([]),
      points: [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000.4, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }, { x: 0, y: 0.2 }, { x: 0, y: 0 }],
      openings: [opening("east", 2, 3000), opening("gone", 1, 0, 400), opening("west", 4, 3000), opening("closing", 5, 0, 400)],
    };
    const out = removeCoincidentCorners(r);
    expect(out.points).toEqual([{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }]);
    expect(out.openings.map((o) => [o.id, o.wall])).toEqual([
      ["east", 1],
      ["west", 3],
    ]);
    expect(onTheirWalls(out)).toBe(true);
  });
});

describe("isUsableOutline", () => {
  it("needs three corners around a real floor area", () => {
    expect(isUsableOutline(room([]).points)).toBe(true);
    expect(isUsableOutline([{ x: 0, y: 0 }, { x: 1000, y: 0 }])).toBe(false);
    expect(isUsableOutline([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 2000, y: 0 }])).toBe(false);
    expect(isUsableOutline([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])).toBe(true);
  });
});
