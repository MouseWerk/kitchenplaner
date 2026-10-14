import { describe, expect, it } from "vitest";
import { checkProject } from "./checks";
import { testItem, testProject } from "./testProject";
import { lRoom } from "./geometry";
import type { Opening, Partition } from "./types";

describe("checkProject", () => {
  it("reports a room outline that crosses itself (opened from a file)", () => {
    const p = testProject();
    p.room = { ...p.room, points: [{ x: 0, y: 0 }, { x: 8000, y: 6000 }, { x: 8000, y: 0 }, { x: 0, y: 6000 }], openings: [] };
    expect(checkProject(p)).toEqual([{ key: "check.outlineInvalid", vars: {}, itemIds: [] }]);
  });

  it("finds nothing in a clean plan", () => {
    const p = testProject([testItem("r", "range-6", 4000, 450), testItem("h", "hood-wall", 4000, 550)]);
    // The hood above the range is the normal case, not an overlap.
    expect(checkProject(p)).toEqual([]);
  });

  it("reports overlapping floor items and overlapping overhead items, not touching ones", () => {
    const p = testProject([
      testItem("a", "table", 2000, 350),
      testItem("b", "table", 2600, 350),
      testItem("c", "table", 3800, 350),
      testItem("h1", "wall-shelf", 2000, 175),
      testItem("h2", "wall-shelf", 2500, 175),
    ]);
    // a: 1400-2600, b: 2000-3200 overlap; c: 3200-4400 only touches b.
    expect(checkProject(p)).toEqual([
      { key: "check.overlap", vars: { a: 1, b: 2 }, itemIds: ["a", "b"] },
      { key: "check.overlap", vars: { a: 4, b: 5 }, itemIds: ["h1", "h2"] },
    ]);
  });

  it("lets table-top units stand on a table and collide only with each other", () => {
    const p = testProject([
      testItem("t", "table", 2000, 350),
      // Slicer 1425-1975 and table mixer 1890-2310 overlap each other, both stand on the table.
      testItem("s", "prep-slicer", 1700, 300),
      testItem("m", "prep-mixer-10", 2100, 250),
      // A scale at 2400-2750 next to them: free.
      testItem("w", "prep-scale", 2575, 200),
      testItem("h", "wall-shelf", 2000, 175),
    ]);
    expect(checkProject(p)).toEqual([{ key: "check.overlap", vars: { a: 2, b: 3 }, itemIds: ["s", "m"] }]);
  });

  it("lets flat units (drains, channels, platforms) lie under and across anything", () => {
    const p = testProject([
      testItem("sink", "sink-1", 4000, 350),
      testItem("drain", "floor-drain", 4000, 350),
      // A channel across the sink and the drain, a platform under a table.
      testItem("ch", "drain-channel-200", 4000, 400),
      testItem("pf", "platform", 2000, 400),
      testItem("t", "table", 2000, 350),
    ]);
    expect(checkProject(p)).toEqual([]);
  });

  it("lets only floor units block a door, and flat units lie across a partition", () => {
    // The door spans x 695 to 1705 in the south wall; its free square reaches up to y 4990.
    const door = testProject([testItem("d", "floor-drain", 1200, 5300), testItem("t", "table", 1200, 5300), testItem("s", "prep-slicer", 1200, 5300)]);
    expect(checkProject(door)).toEqual([{ key: "check.doorBlocked", vars: { pos: 2 }, itemIds: ["t"] }]);
    const p = testProject([testItem("d", "drain-channel-200", 3000, 1500, 90)]);
    p.room.partitions = [{ id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 3000 }, thickness: 100, height: 3000 }];
    expect(checkProject(p)).toEqual([]);
  });

  it("reports items reaching outside the room", () => {
    const p = testProject([testItem("a", "table", 300, 3000), testItem("b", "table", 4000, 3000)]);
    expect(checkProject(p)).toEqual([{ key: "check.outside", vars: { pos: 1 }, itemIds: ["a"] }]);
  });

  it("reports floor items in front of a door, but not hoods above it", () => {
    // The door spans x 695 to 1705 in the south wall; its free square reaches up to y 4990.
    const p = testProject([testItem("t", "table", 1200, 5300), testItem("h", "wall-shelf", 1200, 5700), testItem("ok", "table", 1200, 4500)]);
    expect(checkProject(p)).toEqual([{ key: "check.doorBlocked", vars: { pos: 1 }, itemIds: ["t"] }]);
  });

  it("reports items higher than the room", () => {
    const p = testProject([testItem("h", "hood-wall", 4000, 550, 0, { elevation: 2700 })]);
    expect(checkProject(p)).toEqual([{ key: "check.tooHigh", vars: { pos: 1 }, itemIds: ["h"] }]);
  });

  it("lists findings in a stable order: overlaps, outside, doors, height", () => {
    const p = testProject([
      testItem("tall", "table", 4000, 3000, 0, { height: 3500 }),
      testItem("door", "table", 1200, 5300),
      testItem("out", "table", 300, 3000),
      testItem("o1", "table", 4000, 3300),
    ]);
    expect(checkProject(p).map((i) => i.key)).toEqual(["check.overlap", "check.outside", "check.doorBlocked", "check.tooHigh"]);
    expect(checkProject(p)).toEqual(checkProject(structuredClone(p)));
  });
});

describe("checkProject partitions", () => {
  /** From the north wall's face 3 m south at x 3000, 100 mm thick, full height. */
  const N: Partition = { id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 3000 }, thickness: 100, height: 3000 };

  function withPartitions(items: ReturnType<typeof testItem>[], partitions: Partition[], openings: Opening[] = []) {
    const p = testProject(items);
    p.room.partitions = partitions;
    p.room.openings.push(...openings);
    return p;
  }

  it("accepts a partition joined to the walls and items standing against it", () => {
    // A table with its side against the partition's east face (x 3050 to 4250).
    expect(checkProject(withPartitions([testItem("t", "table", 3650, 1000)], [N]))).toEqual([]);
    // From wall face to wall face across the room, and into the wall's middle.
    const across: Partition = { id: "x", a: { x: -120, y: 4000 }, b: { x: 8000, y: 4000 }, thickness: 100, height: 3000 };
    expect(checkProject(withPartitions([], [across]))).toEqual([]);
  });

  it("reports floor items standing in a partition", () => {
    const p = withPartitions([testItem("t", "table", 3400, 1000), testItem("ok", "table", 5000, 1000)], [N]);
    expect(checkProject(p)).toEqual([{ key: "check.partitionOverlap", vars: { pos: 1 }, itemIds: ["t"], partitionIds: ["n"] }]);
  });

  it("lets overhead items hang above a half-height partition, but not cross a full one", () => {
    const shelf = testItem("s", "wall-shelf", 3000, 1500, 90);
    expect(checkProject(withPartitions([shelf], [{ ...N, height: 1200 }]))).toEqual([]);
    expect(checkProject(withPartitions([shelf], [N])).map((i) => i.key)).toEqual(["check.partitionOverlap"]);
  });

  it("reports partitions reaching outside the room", () => {
    const out: Partition = { id: "o", a: { x: 4000, y: 3000 }, b: { x: 9000, y: 3000 }, thickness: 100, height: 3000 };
    expect(checkProject(withPartitions([], [N, out]))).toEqual([{ key: "check.partitionOutside", vars: {}, itemIds: [], partitionIds: ["o"] }]);
  });

  it("reports a partition across the notch of an L-shaped room, though both ends are inside", () => {
    const p = withPartitions([], [{ id: "d", a: { x: 4000, y: 5000 }, b: { x: 7000, y: 3000 }, thickness: 100, height: 3000 }]);
    p.room.points = lRoom(8000, 6000, 3000, 2000);
    p.room.openings = [];
    expect(checkProject(p).map((i) => i.key)).toEqual(["check.partitionOutside"]);
  });

  it("reports floor items in front of a door in a partition, on the side it opens to", () => {
    // N runs south: its door opens to the left, east. The door spans y 1000 to 1900.
    const door: Opening = { id: "d", kind: "door", wall: 0, partition: "n", offset: 1450, width: 900, height: 2100, sill: 0 };
    const east = testItem("e", "table", 3650, 1450, 90);
    const west = testItem("w", "table", 2600, 1450, 90);
    const p = withPartitions([east, west], [N], [door]);
    expect(checkProject(p)).toEqual([{ key: "check.doorBlocked", vars: { pos: 1 }, itemIds: ["e"] }]);
  });
});
