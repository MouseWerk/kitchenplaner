// The freezer mark (Tiefkühl-Kennzeichnung) in every view: a frost-blue label strip across a door
// leaf with a snowflake badge in its middle in 3D, the strip and the snowflake in the front
// elevation, the snowflake in the plan. It is what tells a freezer from the fridge of the same
// size; any unit that keeps things frozen (freezers, freezer rooms, blast freezers) uses it.

import { MM_PER_UNIT } from "../../three/shared";
import type { Front } from "./elevation";
import type { Parts } from "./mesh";
import type { PlanSketch } from "./plan";

/**
 * Sizes of the mark on a door (m): the strip's height and inset from the leaf's edges, the
 * badge's radius and the length of a ray.
 */
const FROST = { h: 0.05, inset: 0.035, badge: 0.032, ray: 0.026 };

/**
 * The freezer mark on a door leaf whose face is at `zLeaf`: the frost strip from `y0` to `y1`
 * between the leaf's edges `x0` and `x1`, and the snowflake badge in its middle.
 */
export function frostMark(p: Parts, x0: number, x1: number, y0: number, y1: number, zLeaf: number): void {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  p.box("water", x0 + FROST.inset, x1 - FROST.inset, y0, y1, zLeaf, zLeaf + 0.002);
  const r = Math.min(FROST.badge, (x1 - x0) / 4);
  p.rod("panelDark", "z", cx, cy, zLeaf + 0.003, 0.006, r);
  // Three bars through the middle make the six rays of the snowflake.
  const ray = r * (FROST.ray / FROST.badge);
  const z = zLeaf + 0.006;
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const dx = Math.cos(a) * ray;
    const dy = Math.sin(a) * ray;
    p.bar("handle", { x: cx - dx, y: cy - dy, z }, { x: cx + dx, y: cy + dy, z }, 0.0025);
  }
}

/** Height of the frost strip of a freezer door (m). */
export const FROST_STRIP = FROST.h;

/**
 * The freezer mark in the elevation: the frost strip (glass fill) from z0 to z1 between a and b,
 * with the snowflake in its middle.
 */
export function frostFront(f: Front, a: number, b: number, z0: number, z1: number): void {
  const inset = FROST.inset * MM_PER_UNIT;
  f.box("detail", a + inset, b - inset, z0, z1, "glass");
  snowflake((x0, y0, x1, y1) => f.line("detail", [x0, y0], [x1, y1]), (a + b) / 2, (z0 + z1) / 2, Math.min(FROST.ray * MM_PER_UNIT, (b - a) / 6));
}

/** Six rays round (x, y) of length r, drawn as three lines through the middle. */
function snowflake(line: (x0: number, y0: number, x1: number, y1: number) => void, x: number, y: number, r: number): void {
  for (const a of [Math.PI / 2, Math.PI / 2 + Math.PI / 3, Math.PI / 2 + (2 * Math.PI) / 3]) {
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    line(x - dx, y - dy, x + dx, y + dy);
  }
}

/** Radius of the snowflake that marks a freezer in the plan (mm). */
const SNOWFLAKE_MM = 90;

/** The freezer mark in the plan: a snowflake at (x, y) of radius `size`, smaller on a small unit. */
export function frostPlan(s: PlanSketch, x: number, y: number, size = SNOWFLAKE_MM): void {
  const r = Math.min(size, s.w / 5, s.d / 5);
  snowflake((x0, y0, x1, y1) => s.line("detail", [x0, y0], [x1, y1]), x, y, r);
}
