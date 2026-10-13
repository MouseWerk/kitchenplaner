import { describe, expect, it } from "vitest";
import { testItem, testProject } from "../model/testProject";
import { EYE_HEIGHT, intentOf, isFree, isWalkKey, look, startWalk, stepWalk, WALK_SPEED, WALL_CLEARANCE, walkSpace } from "./walk";

const room = testProject().room.points; // 8 x 6 m

describe("walk mode", () => {
  it("stands at eye height 1.65 m", () => {
    expect(EYE_HEIGHT).toBe(1.65);
  });

  it("maps W A S D and the arrow keys by position", () => {
    expect(intentOf(new Set(["KeyW"]), false)).toEqual({ forward: 1, right: 0, run: false });
    expect(intentOf(new Set(["ArrowDown", "KeyD"]), true)).toEqual({ forward: -1, right: 1, run: true });
    expect(intentOf(new Set(["KeyW", "KeyS"]), false).forward).toBe(0);
    expect(isWalkKey("KeyA")).toBe(true);
    expect(isWalkKey("KeyG")).toBe(false);
  });

  it("walks north at yaw 0 with the walking speed", () => {
    const space = walkSpace(room, []);
    const s = stepWalk({ x: 4000, y: 3000, yaw: 0, pitch: 0 }, intentOf(new Set(["KeyW"]), false), 1, space);
    expect(s.x).toBeCloseTo(4000, 6);
    expect(s.y).toBeCloseTo(3000 - WALK_SPEED * 1000, 6);
    // Turned left by 90 degrees, forward is west.
    const w = stepWalk({ x: 4000, y: 3000, yaw: Math.PI / 2, pitch: 0 }, intentOf(new Set(["KeyW"]), false), 0.5, space);
    expect(w.x).toBeCloseTo(4000 - WALK_SPEED * 500, 6);
    expect(w.y).toBeCloseTo(3000, 6);
  });

  it("stays inside the room and slides along a wall", () => {
    const space = walkSpace(room, []);
    let s = { x: 4000, y: 1000, yaw: Math.PI / 4, pitch: 0 }; // facing north-west
    for (let i = 0; i < 200; i++) s = stepWalk(s, intentOf(new Set(["KeyW"]), true), 0.05, space);
    expect(isFree(s, space)).toBe(true);
    expect(s.y).toBeGreaterThanOrEqual(WALL_CLEARANCE);
    expect(s.x).toBeGreaterThanOrEqual(WALL_CLEARANCE);
    // It slid into the corner instead of stopping at the first wall.
    expect(s.x).toBeLessThan(WALL_CLEARANCE + 300);
    expect(s.y).toBeLessThan(WALL_CLEARANCE + 300);
  });

  it("does not walk through floor equipment, but walks out of it", () => {
    const table = testItem("t", "table", 4000, 2000);
    const space = walkSpace(room, [table, testItem("h", "hood-wall", 4000, 3000)]);
    expect(isFree({ x: 4000, y: 2000 }, space)).toBe(false);
    // The hood hangs overhead: no obstacle.
    expect(isFree({ x: 4000, y: 3000 }, space)).toBe(true);
    let s = { x: 4000, y: 3500, yaw: 0, pitch: 0 };
    for (let i = 0; i < 40; i++) s = stepWalk(s, intentOf(new Set(["KeyW"]), false), 0.05, space);
    expect(s.y).toBeGreaterThan(2000 + 350);
    const inside = stepWalk({ x: 4000, y: 2000, yaw: 0, pitch: 0 }, intentOf(new Set(["KeyS"]), false), 0.1, space);
    expect(inside.y).toBeGreaterThan(2000);
  });

  it("looks around by dragging, never past straight up or down", () => {
    const s = look({ x: 0, y: 0, yaw: 0, pitch: 0 }, 100, 0);
    expect(s.yaw).toBeLessThan(0); // dragging right turns right (clockwise from above)
    expect(look(s, 0, -100000).pitch).toBeLessThan(Math.PI / 2);
    expect(look(s, 0, 100000).pitch).toBeGreaterThan(-Math.PI / 2);
  });

  it("starts at the free spot nearest to where the orbit looked, facing the same way", () => {
    const space = walkSpace(room, [testItem("t", "table-island", 4000, 3000)]);
    const s = startWalk({ x: 4000, y: 3000 }, { x: 0, y: -1 }, space)!;
    expect(isFree(s, space)).toBe(true);
    expect(Math.hypot(s.x - 4000, s.y - 3000)).toBeLessThan(1500);
    expect(s.yaw).toBeCloseTo(0, 9);
    expect(startWalk({ x: 0, y: 0 }, { x: 1, y: 0 }, walkSpace([], []))).toBeNull();
  });
});
