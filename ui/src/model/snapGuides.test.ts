import { describe, expect, it } from "vitest";
import { rectRoom } from "./geometry";
import { snapBox, snapGroupGuides, snapItemGuides } from "./snapGuides";

const item = (over: Partial<{ x: number; y: number; rotation: number; width: number; depth: number }> = {}) => ({ x: 0, y: 0, rotation: 0, width: 1000, depth: 700, ...over });
const room = { points: rectRoom(8000, 6000), partitions: [] };

describe("snapBox", () => {
  const target = { minX: 1000, minY: 1000, maxX: 2000, maxY: 2000 };

  it("aligns edges within reach and returns a guide across both boxes", () => {
    const s = snapBox({ minX: 1030, minY: 3000, maxX: 1530, maxY: 3500 }, [target], [], 50);
    expect(s.dx).toBe(-30);
    expect(s.dy).toBe(0);
    expect(s.guides).toEqual([{ a: { x: 1000, y: 1000 }, b: { x: 1000, y: 3500 }, kind: "edge" }]);
    expect(s.marks).toEqual([{ x: 1000, y: 3000 }, { x: 1000, y: 3500 }]);
  });

  it("aligns centres", () => {
    const s = snapBox({ minX: 1220, minY: 3000, maxX: 1820, maxY: 3200 }, [target], [], 50);
    expect(s.dx).toBe(-20);
    expect(s.guides[0].kind).toBe("centre");
  });

  it("puts boxes flush side by side", () => {
    const s = snapBox({ minX: 2040, minY: 1000, maxX: 2540, maxY: 1500 }, [target], [], 50);
    expect(s.dx).toBe(-40);
    expect(s.dy).toBe(0);
  });

  it("leaves boxes out of reach and locked axes alone", () => {
    expect(snapBox({ minX: 1100, minY: 3000, maxX: 1600, maxY: 3500 }, [target], [], 50).guides).toEqual([]);
    const locked = snapBox({ minX: 1030, minY: 1030, maxX: 1530, maxY: 1530 }, [target], [], 50, { x: true });
    expect(locked).toMatchObject({ dx: 0, dy: -30 });
  });
});

describe("snapItemGuides", () => {
  it("puts the back against a wall and shows the wall as a guide", () => {
    const s = snapItemGuides(item({ x: 2030, y: 420 }), room, [], 50, 40);
    expect(s).toMatchObject({ x: 2050, y: 350, rotation: 0 });
    expect(s.guides).toContainEqual({ a: { x: 0, y: 0 }, b: { x: 8000, y: 0 }, kind: "wall" });
    expect(s.marks).toContainEqual({ x: 2050, y: 0 });
  });

  it("slides along the wall into the corner, flush with the side wall", () => {
    const s = snapItemGuides(item({ x: 530, y: 360 }), room, [], 0, 40);
    expect(s).toMatchObject({ x: 500, y: 350 });
    expect(s.guides.filter((g) => g.kind === "wall")).toHaveLength(2);
  });

  it("aligns with a neighbour against the same wall", () => {
    const s = snapItemGuides(item({ x: 1525, y: 360 }), room, [item({ x: 500, y: 350 })], 0, 40);
    expect(s).toMatchObject({ x: 1500, y: 350 });
  });

  it("stands against a partition face", () => {
    const withWall = { ...room, partitions: [{ id: "p", a: { x: 2000, y: 3000 }, b: { x: 6000, y: 3000 }, thickness: 100, height: 3000 }] };
    const s = snapItemGuides(item({ x: 4000, y: 3420 }), withWall, [], 50, 40);
    expect(s).toMatchObject({ x: 4000, y: 3400 });
    expect(s.guides).toContainEqual({ a: { x: 2000, y: 3050 }, b: { x: 6000, y: 3050 }, kind: "wall" });
  });

  it("keeps the grid in the open floor when nothing is in reach", () => {
    const s = snapItemGuides(item({ x: 4012, y: 3038 }), room, [], 50, 40);
    expect(s).toMatchObject({ x: 4000, y: 3050, guides: [], marks: [] });
  });
});

describe("snapGroupGuides", () => {
  it("snaps the group's box against a wall", () => {
    const s = snapGroupGuides([item({ x: 1000, y: 380 }), item({ x: 2000, y: 400 })], room, [], 40);
    // The box's top edge (y 30) goes to the north wall (y 0).
    expect(s.dy).toBe(-30);
    expect(s.guides.some((g) => g.kind === "wall")).toBe(true);
  });
});
