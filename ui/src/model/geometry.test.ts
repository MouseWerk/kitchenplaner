import { describe, expect, it } from "vitest";
import { angleDiff, convexOverlap, footprint, frontOf, itemsInFrame, lRoom, normalizeAngle, pointInPolygon, rectRoom, signedArea, snapItem, walls } from "./geometry";
import type { Item } from "./types";

const item = (over: Partial<{ x: number; y: number; rotation: number; width: number; depth: number }> = {}) => ({ x: 0, y: 0, rotation: 0, width: 1000, depth: 700, ...over });

describe("angles and directions", () => {
  it("normalizes angles into [0, 360)", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-0)).toBe(0);
  });

  it("measures the smaller angle between two directions", () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
  });

  it("faces south at 0 and west at 90 degrees", () => {
    const s = frontOf(0);
    expect(s.x).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(1);
    const w = frontOf(90);
    expect(w.x).toBeCloseTo(-1);
    expect(w.y).toBeCloseTo(0);
  });
});

describe("footprints and overlap", () => {
  it("swaps width and depth when turned by 90 degrees", () => {
    const fp = footprint(item({ rotation: 90 }));
    const xs = fp.map((p) => p.x);
    const ys = fp.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(700);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1000);
  });

  it("does not count touching items as overlapping", () => {
    expect(convexOverlap(footprint(item()), footprint(item({ x: 1000 })))).toBe(false);
    expect(convexOverlap(footprint(item()), footprint(item({ x: 999 })))).toBe(true);
  });

  it("detects overlap of a turned item", () => {
    expect(convexOverlap(footprint(item()), footprint(item({ x: 800, rotation: 45 })))).toBe(true);
  });
});

describe("walls", () => {
  it("points the normals into the room in either corner order", () => {
    for (const pts of [rectRoom(4000, 3000), [...rectRoom(4000, 3000)].reverse()]) {
      for (const w of walls({ points: pts })) {
        const mid = { x: (w.a.x + w.b.x) / 2 + w.inward.x * 10, y: (w.a.y + w.b.y) / 2 + w.inward.y * 10 };
        expect(pointInPolygon(mid, pts)).toBe(true);
      }
    }
  });

  it("knows the inside of an L-shaped room", () => {
    const pts = lRoom(10000, 8000, 4000, 3000);
    expect(signedArea(pts)).toBeGreaterThan(0);
    expect(pointInPolygon({ x: 1000, y: 7000 }, pts)).toBe(true);
    expect(pointInPolygon({ x: 9000, y: 7000 }, pts)).toBe(false);
  });
});

describe("snapItem", () => {
  const room = { points: rectRoom(8000, 6000) };

  it("pulls an item against the north wall facing into the room", () => {
    const s = snapItem(item({ x: 2030, y: 420, rotation: 0 }), room, [], 50, true);
    expect(s).toMatchObject({ x: 2050, y: 350, rotation: 0, wall: 0 });
  });

  it("turns an item dropped near the west wall to face east", () => {
    const s = snapItem(item({ x: 400, y: 3000, rotation: 0 }), room, [], 50, true);
    expect(s.rotation).toBe(270);
    expect(s.x).toBe(350);
    expect(frontOf(s.rotation).x).toBeCloseTo(1);
  });

  it("keeps the rotation of a moved item and ignores walls it does not face", () => {
    const s = snapItem(item({ x: 400, y: 3000, rotation: 0 }), room, [], 50, false);
    expect(s.rotation).toBe(0);
    expect(s.wall).toBeNull();
  });

  it("keeps the item inside the wall's length", () => {
    const s = snapItem(item({ x: 7900, y: 360 }), room, [], 50, true);
    expect(s.x).toBe(7500);
  });

  it("aligns an item flush with its neighbour in the same row", () => {
    const neighbour = item({ x: 500, y: 350 });
    const s = snapItem(item({ x: 1530, y: 350 }), room, [neighbour], 0, false);
    expect(s.x).toBe(1500);
  });

  it("places freely in the middle of the room on the grid", () => {
    const s = snapItem(item({ x: 4012, y: 3038, rotation: 30 }), room, [], 50, true);
    expect(s).toMatchObject({ x: 4000, y: 3050, rotation: 30, wall: null });
  });

  it("ignores a zero-length wall (a corner repeated on the spot)", () => {
    // Without the guard the zero wall has gap 0 everywhere and pulls the item onto its corner.
    const pts = rectRoom(8000, 6000);
    const doubled = { points: [pts[0], pts[1], { ...pts[1] }, pts[2], pts[3]] };
    expect(snapItem(item({ x: 4012, y: 3038, rotation: 30 }), doubled, [], 50, true)).toMatchObject({ x: 4000, y: 3050, rotation: 30, wall: null });
    // Real walls still snap.
    expect(snapItem(item({ x: 2030, y: 420, rotation: 0 }), doubled, [], 50, true)).toMatchObject({ y: 350, wall: 0 });
  });
});

describe("snapItem against partitions", () => {
  // A partition across the room, its centre line at y 3000, 100 mm thick: faces at 2950 and 3050.
  const room = { points: rectRoom(8000, 6000), partitions: [{ id: "p1", a: { x: 2000, y: 3000 }, b: { x: 6000, y: 3000 }, thickness: 100, height: 3000 }] };

  it("pulls an item with its back against the partition face it stands in front of", () => {
    expect(snapItem(item({ x: 4010, y: 3430 }), room, [], 50, false)).toMatchObject({ x: 4000, y: 3400, rotation: 0, wall: null });
  });

  it("turns an item dropped north of the partition to face north", () => {
    expect(snapItem(item({ x: 4000, y: 2580 }), room, [], 50, true)).toMatchObject({ y: 2600, rotation: 180 });
  });

  it("does not reach past the partition's ends", () => {
    expect(snapItem(item({ x: 7000, y: 3430 }), room, [], 50, false)).toMatchObject({ y: 3450, wall: null });
  });
});

describe("itemsInFrame", () => {
  const box = (id: string, x: number, y: number) => ({ ...item({ x, y }), id }) as unknown as Item;
  // a spans x 500..1500, b 2500..3500; both y 650..1350.
  const items = [box("a", 1000, 1000), box("b", 3000, 1000)];

  it("left to right picks only items fully inside (window)", () => {
    expect(itemsInFrame(items, { x: 0, y: 0 }, { x: 3000, y: 2000 })).toEqual(["a"]);
    expect(itemsInFrame(items, { x: 0, y: 0 }, { x: 4000, y: 2000 })).toEqual(["a", "b"]);
  });

  it("right to left picks every item it touches (crossing)", () => {
    expect(itemsInFrame(items, { x: 3000, y: 2000 }, { x: 0, y: 0 })).toEqual(["a", "b"]);
    expect(itemsInFrame(items, { x: 2000, y: 2000 }, { x: 1600, y: 0 })).toEqual([]);
  });

  it("is the same whichever vertical direction the frame is drawn in", () => {
    expect(itemsInFrame(items, { x: 0, y: 2000 }, { x: 3000, y: 0 })).toEqual(["a"]);
  });
});
