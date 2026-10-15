import { beforeEach, describe, expect, it } from "vitest";
import { bounds, footprint } from "../model/geometry";
import { testItem, testProject } from "../model/testProject";
import type { Item } from "../model/types";
import { useStore } from "../store/store";
import { alignItems, alignSelected, distributeItems, distributeSelected, packItems, packSelected } from "./align";

const st = () => useStore.getState();
/** A unit of `w` × `d` mm with its centre at x, y. */
const unit = (id: string, x: number, y: number, w: number, d: number, rotation = 0): Item => testItem(id, "table", x, y, rotation, { width: w, depth: d });
const box = (it: Item) => bounds(footprint(it));
/** The items with the moves applied. */
const applied = (items: Item[], moves: Map<string, { x: number; y: number }>) => items.map((it) => ({ ...it, ...moves.get(it.id) }));

describe("align", () => {
  const items = [unit("a", 1000, 1000, 600, 600), unit("b", 3000, 2000, 1200, 700), unit("c", 2000, 1500, 400, 400)];

  it("aligns left and right edges to the selection's box", () => {
    const left = applied(items, alignItems(items, "left"));
    expect(left.map((it) => box(it).minX)).toEqual([700, 700, 700]);
    // Only x changes.
    expect(left.map((it) => it.y)).toEqual([1000, 2000, 1500]);
    const right = applied(items, alignItems(items, "right"));
    expect(right.map((it) => box(it).maxX)).toEqual([3600, 3600, 3600]);
  });

  it("aligns tops, bottoms and the middles", () => {
    expect(applied(items, alignItems(items, "top")).map((it) => box(it).minY)).toEqual([700, 700, 700]);
    expect(applied(items, alignItems(items, "bottom")).map((it) => box(it).maxY)).toEqual([2350, 2350, 2350]);
    // The box runs from x 700 to 3600: its middle is 2150.
    expect(applied(items, alignItems(items, "centreX")).map((it) => it.x)).toEqual([2150, 2150, 2150]);
    expect(applied(items, alignItems(items, "centreY")).map((it) => it.y)).toEqual([1525, 1525, 1525]);
  });

  it("uses what a turned unit covers on the plan", () => {
    // 1200 wide, 600 deep, turned by 90°: it covers 600 × 1200, so its left edge is at x - 300.
    const turned = [unit("t", 2000, 1000, 1200, 600, 90), unit("s", 1000, 3000, 600, 600)];
    const left = applied(turned, alignItems(turned, "left"));
    expect(left[0].x).toBe(1000);
    expect(box(left[0]).minX).toBeCloseTo(700, 6);
    // At 45° the covered box is wider than the unit.
    const diag = [unit("d", 2000, 1000, 1000, 1000, 45), unit("e", 0, 3000, 600, 600)];
    const r = applied(diag, alignItems(diag, "right"));
    expect(box(r[0]).maxX).toBeCloseTo(box(r[1]).maxX, 0);
    expect(r[0].x).toBeCloseTo(box(r[1]).maxX - 500 * Math.SQRT2, 0);
  });

  it("leaves a single item and an aligned selection alone", () => {
    expect(alignItems([items[0]], "left").size).toBe(0);
    const done = applied(items, alignItems(items, "left"));
    expect(alignItems(done, "left").size).toBe(0);
  });
});

describe("distribute", () => {
  it("makes the gaps between the boxes equal, the outer items stay", () => {
    const items = [unit("a", 300, 0, 600, 600), unit("c", 4700, 0, 600, 600), unit("b", 1000, 0, 1000, 600), unit("d", 2600, 0, 400, 600)];
    const out = applied(items, distributeItems(items, "x"));
    const boxes = out.map(box).sort((p, q) => p.minX - q.minX);
    // From 0 to 5000 with 2600 mm of units: three gaps of 800.
    expect(boxes.map((b) => [b.minX, b.maxX])).toEqual([
      [0, 600],
      [1400, 2400],
      [3200, 3600],
      [4400, 5000],
    ]);
    expect(out.find((it) => it.id === "a")!.x).toBe(300);
    expect(out.find((it) => it.id === "c")!.x).toBe(4700);
  });

  it("distributes along y with turned units by their covered box", () => {
    const items = [unit("a", 0, 300, 600, 600), unit("b", 0, 1000, 1200, 600, 90), unit("c", 0, 4700, 600, 600)];
    const out = applied(items, distributeItems(items, "y"));
    // 5000 mm with 600 + 1200 + 600 of units: two gaps of 1300; b starts at 1900, its centre at 2500.
    expect(out[1].y).toBe(2500);
    expect(out[1].x).toBe(0);
  });

  it("needs three items", () => {
    expect(distributeItems([unit("a", 0, 0, 600, 600), unit("b", 3000, 0, 600, 600)], "x").size).toBe(0);
  });
});

describe("pack", () => {
  it("lines the items up without gaps from the first one, in their order along the axis", () => {
    const items = [unit("b", 2500, 500, 1000, 700), unit("a", 300, 0, 600, 600), unit("c", 6000, 0, 400, 600, 90)];
    const out = applied(items, packItems(items, "x"));
    const b = Object.fromEntries(out.map((it) => [it.id, box(it)]));
    expect(b.a.minX).toBe(0);
    expect(b.b.minX).toBe(600);
    expect(b.c.minX).toBeCloseTo(1600, 6);
    // Only the axis moves.
    expect(out.find((it) => it.id === "b")!.y).toBe(500);
  });

  it("packs along y", () => {
    const items = [unit("a", 0, 0, 600, 600), unit("b", 0, 5000, 600, 800)];
    const out = applied(items, packItems(items, "y"));
    expect(box(out[1]).minY).toBe(300);
  });
});

describe("the commands", () => {
  beforeEach(() => {
    st().load(testProject([unit("a", 1000, 1000, 600, 600), unit("b", 3000, 2000, 1200, 700), unit("c", 2000, 1500, 400, 400), unit("x", 5000, 5000, 600, 600)]), null);
    st().select({ items: ["a", "b", "c"] });
  });

  it("moves only the selection, as one undo step", () => {
    alignSelected("left");
    expect(st().past.length).toBe(1);
    expect(st().project.items.map((it) => it.x)).toEqual([1000, 1300, 900, 5000]);
    st().undo();
    expect(st().project.items.map((it) => it.x)).toEqual([1000, 3000, 2000, 5000]);
    distributeSelected("y");
    packSelected("x");
    expect(st().past.length).toBe(2);
  });

  it("leaves no undo step when nothing moves", () => {
    alignSelected("left");
    alignSelected("left");
    expect(st().past.length).toBe(1);
    st().select({ items: ["a"] });
    packSelected("x");
    expect(st().past.length).toBe(1);
  });
});
