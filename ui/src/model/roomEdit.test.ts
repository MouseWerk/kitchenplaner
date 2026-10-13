import { describe, expect, it } from "vitest";
import { clampOpening, walls } from "./geometry";
import {
  clampToHost,
  combine,
  frameSelect,
  hitRoom,
  insertCorner,
  isUsableOutline,
  lineAngle,
  moveCorner,
  moveCorners,
  movePartitions,
  removeCoincidentCorners,
  removeCorners,
  selectedWall,
  setPartitionLength,
  setWallLength,
  slideOpening,
} from "./roomEdit";
import { testProject } from "./testProject";
import type { Opening, Partition, Room } from "./types";

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

const partition = (id: string, a: [number, number], b: [number, number]): Partition => ({ id, a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, thickness: 100, height: 3000 });
const hatch = (id: string, part: string, offset: number): Opening => ({ id, kind: "hatch", wall: 0, partition: part, offset, width: 1200, height: 800, sill: 900 });

describe("partition openings", () => {
  it("are left alone by the outer wall edits", () => {
    const r = { ...room([hatch("h", "p", 2500)]), partitions: [partition("p", [4000, 0], [4000, 3000])] };
    expect(moveCorner(r, 1, { x: 5000, y: 0 }).openings[0]).toEqual(r.openings[0]);
    expect(insertCorner(r, 0, { x: 2000, y: 0 }, 50)!.openings[0]).toEqual(r.openings[0]);
    // Its `wall` index (0, 8 m long) must not shrink it to a 3 m wall 0, nor move it with wall indices.
    expect(moveCorners(r, [0], { x: 5000, y: 0 }).openings[0]).toEqual(r.openings[0]);
    expect(removeCorners(r, [1])!.openings[0]).toEqual(r.openings[0]);
    const dup = { ...r, points: [r.points[0], r.points[0], ...r.points.slice(1)] };
    expect(removeCoincidentCorners(dup).openings[0]).toEqual(r.openings[0]);
  });

  it("are clamped into their partition, not into the outer wall of their index", () => {
    const r = { ...room([hatch("h", "p", 2500)]), partitions: [partition("p", [4000, 0], [4000, 3000])] };
    // Wall 0 is 8 m long; the partition 3 m: offset 2500 with 1200 width sticks out of the partition.
    expect(clampOpening(r, r.openings[0]).offset).toBe(2400);
    expect(clampToHost(r, r.openings[0]).offset).toBe(2400);
    // Without the partitions at hand it stays as it is.
    expect(clampOpening({ points: r.points }, r.openings[0])).toEqual(r.openings[0]);
  });
});

describe("moveCorners", () => {
  it("moves a whole wall and keeps its openings", () => {
    const r = moveCorners(room([opening("n", 0, 4000)]), [0, 1], { x: 0, y: 500 });
    expect(r.points.slice(0, 2)).toEqual([{ x: 0, y: 500 }, { x: 8000, y: 500 }]);
    expect(r.openings[0].offset).toBe(4000);
  });

  it("refuses a move that puts a corner on its neighbour", () => {
    const r = room([]);
    expect(moveCorners(r, [1], { x: -8000, y: 0 })).toBe(r);
  });
});

describe("removeCorners", () => {
  it("merges the walls at a removed corner and keeps openings where they are on the plan", () => {
    // An L-ish room: remove the extra corner on the south wall again.
    const split = insertCorner(room([opening("s", 2, 1000), opening("w", 3, 3000)]), 2, { x: 4000, y: 6000 }, 50)!;
    expect(split.openings.map((o) => [o.id, o.wall, o.offset])).toEqual([
      ["s", 2, 1000],
      ["w", 4, 3000],
    ]);
    const back = removeCorners(split, [3])!;
    expect(back.points).toEqual(testProject().room.points);
    expect(back.openings.map((o) => [o.id, o.wall, o.offset])).toEqual([
      ["s", 2, 1000],
      ["w", 3, 3000],
    ]);
  });

  it("projects an opening of a vanished wall onto the merged wall", () => {
    // Removing the south-east corner: the east wall's window lands on the diagonal from NE to SW.
    const r = removeCorners(room([opening("e", 1, 3000, 1000)]), [2])!;
    expect(r.points).toHaveLength(3);
    expect(r.openings).toHaveLength(1);
    expect(r.openings[0].wall).toBe(1);
    expect(onTheirWalls(r)).toBe(true);
  });

  it("keeps at least three corners and a valid outline", () => {
    expect(removeCorners(room([]), [0, 1])).toBeNull();
    expect(removeCorners(room([]), [])).toEqual(room([]));
  });
});

describe("setWallLength", () => {
  it("moves the end corner along the wall", () => {
    const r = setWallLength(room([]), 1, 4500);
    expect(r.points[2]).toEqual({ x: 8000, y: 4500 });
    expect(r.points[3]).toEqual({ x: 0, y: 6000 });
  });

  it("refuses lengths that break the outline", () => {
    const r = room([]);
    expect(setWallLength(r, 0, 0)).toBe(r);
  });
});

describe("lineAngle", () => {
  it("measures clockwise from east", () => {
    expect(lineAngle({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
    expect(lineAngle({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(90);
    expect(lineAngle({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(180);
    expect(lineAngle({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(270);
  });
});

describe("partitions", () => {
  it("move whole, change length from end a and keep their openings inside", () => {
    const r = { ...room([hatch("h", "p", 2500)]), partitions: [partition("p", [4000, 0], [4000, 3000])] };
    const moved = movePartitions(r, ["p"], { x: 100, y: 0 });
    expect(moved.partitions[0].a).toEqual({ x: 4100, y: 0 });
    const shorter = setPartitionLength(r, "p", 2000);
    expect(shorter.partitions[0].b).toEqual({ x: 4000, y: 2000 });
    expect(shorter.openings[0].offset).toBe(1400);
  });

  it("slide openings along their host only", () => {
    const r = { ...room([hatch("h", "p", 1500)]), partitions: [partition("p", [4000, 0], [4000, 3000])] };
    expect(slideOpening(r, r.openings[0], { x: 900, y: 500 }).offset).toBe(2000);
    expect(slideOpening(r, r.openings[0], { x: 0, y: 5000 }).offset).toBe(2400);
    expect(clampToHost(r, { ...r.openings[0], offset: -10 }).offset).toBe(600);
    // The door on the south wall (running west) moves east by moving against the wall direction.
    const door = testProject().room.openings[0];
    expect(slideOpening(testProject().room, door, { x: 200, y: 0 }).offset).toBe(6600);
  });
});

describe("hitRoom", () => {
  const r = { ...room([opening("n", 0, 4000), hatch("h", "p", 1500)]), partitions: [partition("p", [4000, 3000], [4000, 6000])] };
  it("picks corners and partition ends first, then openings, partitions and walls", () => {
    expect(hitRoom(r, { x: 10, y: -10 }, 50)).toEqual({ kind: "corner", index: 0 });
    expect(hitRoom(r, { x: 4010, y: 3020 }, 50)).toEqual({ kind: "end", id: "p", end: "a" });
    expect(hitRoom(r, { x: 4000, y: -100 }, 20)).toEqual({ kind: "opening", id: "n" });
    expect(hitRoom(r, { x: 4030, y: 4500 }, 20)).toEqual({ kind: "opening", id: "h" });
    expect(hitRoom(r, { x: 4030, y: 5500 }, 20)).toEqual({ kind: "partition", id: "p" });
    expect(hitRoom(r, { x: 2000, y: -100 }, 20)).toEqual({ kind: "wall", index: 0 });
    expect(hitRoom(r, { x: 2000, y: 2000 }, 20)).toBeNull();
    // Outside the wall thickness nothing is hit.
    expect(hitRoom(r, { x: 2000, y: -400 }, 20)).toBeNull();
  });
});

describe("frameSelect", () => {
  const r = { ...room([]), partitions: [partition("p", [4000, 3000], [4000, 6000])] };
  it("takes what lies fully inside a window", () => {
    expect(frameSelect(r, { minX: -100, minY: -100, maxX: 8100, maxY: 100 }, false)).toEqual({ corners: [0, 1], partitions: [] });
    expect(frameSelect(r, { minX: 3000, minY: 2000, maxX: 5000, maxY: 6100 }, false)).toEqual({ corners: [], partitions: ["p"] });
  });

  it("takes walls and partitions a crossing frame touches", () => {
    expect(frameSelect(r, { minX: 3000, minY: 5000, maxX: 5000, maxY: 6100 }, true)).toEqual({ corners: [2, 3], partitions: ["p"] });
  });
});

describe("combine and selectedWall", () => {
  it("replaces, adds and toggles", () => {
    expect(combine([1, 2], [2, 3], "replace")).toEqual([2, 3]);
    expect(combine([1, 2], [2, 3], "add")).toEqual([1, 2, 3]);
    expect(combine([1, 2], [2, 3], "toggle")).toEqual([1, 3]);
  });

  it("finds the wall of two neighbouring corners, also the closing wall", () => {
    const r = room([]);
    expect(selectedWall(r, [2, 1])).toBe(1);
    expect(selectedWall(r, [0, 3])).toBe(3);
    expect(selectedWall(r, [0, 2])).toBeNull();
    expect(selectedWall(r, [0])).toBeNull();
  });
});
