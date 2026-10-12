import { describe, expect, it } from "vitest";
import { checkProject } from "./checks";
import { testItem, testProject } from "./testProject";

describe("checkProject", () => {
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
