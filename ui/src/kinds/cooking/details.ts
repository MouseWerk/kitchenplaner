// Details the cooking units share in 3D: buttons and pilot lights, vent slots, splash guards,
// door windows with their seals, dials, hinged lids and the short feet of table-top units.
// Housings, control panels, displays and rating plates are in parts/details.ts.

import { foot, TOP_RADIUS, type Parts, type Size } from "../parts/mesh";

/** Corner radius of door windows (m). */
const WINDOW_RADIUS = 0.03;
/** Width of the black seal round a door window as seen from the front (m). */
const WINDOW_SEAL = 0.006;
/** How far a button stands on its panel (m). */
const BUTTON_PROUD = 0.002;
/** Radius of the short feet of table-top units (m). */
const TABLE_FOOT = 0.016;
/** Thickness of a splash guard (m). */
const GUARD_SHEET = 0.008;

/** A row of `n` push buttons of size `b` from x0 to x1 at height y on a face at `zFace`. */
export function buttons(p: Parts, x0: number, x1: number, y: number, zFace: number, n: number, b = 0.014): void {
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5);
    p.plate("satin", cx - b / 2, cx + b / 2, y - b / 2, y + b / 2, zFace, zFace + BUTTON_PROUD, b * 0.3, true);
  }
}

/** A pilot light at (x, y) on a face at `zFace`: a satin bezel and a white domed lens. */
export function pilot(p: Parts, x: number, y: number, zFace: number, r = 0.006): void {
  p.lathe("satin", x, y, zFace, [
    [0, 0],
    [r * 1.4, 0],
    [r * 1.4, 0.002],
    [r * 1.1, 0.003],
    [0, 0.003],
  ], { axis: "z" });
  p.lathe("panel", x, y, zFace + 0.003, [
    [0, 0],
    [r, 0],
    [r * 0.7, r * 0.5],
    [0, r * 0.6],
  ], { axis: "z" });
}

/** Vent slots with round ends across a front face at `zFace`, `n` of them from x0 to x1. */
export function frontSlots(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, n: number): void {
  const step = (x1 - x0) / n;
  const sw = step * 0.45;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5);
    p.plate("slot", cx - sw / 2, cx + sw / 2, y0, y1, zFace, zFace + 0.001, sw / 2);
  }
}

/** Vent slots with round ends lying in a top at `y` (front to back), `n` of them from x0 to x1. */
export function topSlots(p: Parts, x0: number, x1: number, z0: number, z1: number, y: number, n: number): void {
  const step = (x1 - x0) / n;
  const sw = step * 0.45;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5);
    p.roundedBox("slot", cx - sw / 2, cx + sw / 2, y - 0.001, y + 0.001, z0, z1, sw / 2, "vertical");
  }
}

/**
 * Splash guards over a cooking top at `y0`, up to `y1`: one along the back, its top edge rounded,
 * and one at each side reaching `sideTo` towards the front (m), falling from the full height at
 * the back to a low edge at the front.
 */
export function splashGuards(p: Parts, s: Size, y0: number, y1: number, sideTo: number): void {
  p.roundedBox("steel", -s.w / 2, s.w / 2, y0, y1, -s.d / 2, -s.d / 2 + GUARD_SHEET, TOP_RADIUS, "top");
  const zb = -s.d / 2 + GUARD_SHEET;
  const zk = zb + (sideTo - zb) * 0.35;
  const low = Math.min(GUARD_LOW, y1 - y0);
  for (const sx of [-1, 1]) {
    const x = sx * (s.w / 2 - GUARD_SHEET / 2);
    p.extrude("steel", "x", x - GUARD_SHEET / 2, x + GUARD_SHEET / 2, [
      [zb, y0],
      [sideTo, y0],
      [sideTo, y0 + low],
      [zk, y1],
      [zb, y1],
    ]);
  }
}

/**
 * A hand wheel facing the front, its hub at (x, y) on a face at `zFace` (m): a turned rim of
 * radius `r` on three spokes, and a grip on the rim that turns it. Ends at `zFace + depth`.
 */
export function handWheel(p: Parts, x: number, y: number, zFace: number, r: number, depth = 0.04): void {
  const rb = Math.min(0.008, r * 0.12);
  const zr = zFace + depth * 0.45;
  // The hub on its spindle.
  p.lathe("satin", x, y, zFace, [
    [0, 0],
    [r * 0.2, 0],
    [r * 0.2, depth * 0.35],
    [r * 0.14, depth * 0.55],
    [0, depth * 0.55],
  ], { axis: "z" });
  // The rim: a ring of round section, turned about the z axis.
  const steps = 8;
  p.lathe(
    "satin",
    x,
    y,
    zr - rb,
    Array.from({ length: steps + 1 }, (_, k) => {
      const a = -Math.PI + (k / steps) * Math.PI * 2;
      return [r - rb + rb * Math.cos(a), rb + rb * Math.sin(a), Math.cos(a), Math.sin(a)] as const;
    }),
    { axis: "z" },
  );
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
    p.bar("satin", { x: x + r * 0.18 * Math.cos(a), y: y + r * 0.18 * Math.sin(a), z: zr }, { x: x + (r - rb) * Math.cos(a), y: y + (r - rb) * Math.sin(a), z: zr }, rb * 0.6);
  }
  // The grip on the rim, standing out to the front.
  const ga = -Math.PI / 6;
  gripZ(p, x + (r - rb) * Math.cos(ga), y + (r - rb) * Math.sin(ga), zr, zFace + depth, Math.min(0.009, rb * 1.2));
}

/** Height of the side splash guards at their front end (m). */
const GUARD_LOW = 0.025;

/**
 * A door window from x0 to x1 and y0 to y1 on a face at `zFace` (m): the tinted pane with round
 * corners in a black seal that shows round it.
 */
export function doorWindow(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number): void {
  const r = Math.min(WINDOW_RADIUS, (x1 - x0) / 4, (y1 - y0) / 4);
  p.plate("rubber", x0 - WINDOW_SEAL, x1 + WINDOW_SEAL, y0 - WINDOW_SEAL, y1 + WINDOW_SEAL, zFace, zFace + 0.0015, r + WINDOW_SEAL);
  p.plate("glassDark", x0, x1, y0, y1, zFace, zFace + 0.003, r, true);
}

/**
 * The central dial of a control panel at (cx, cy) on a face at `zFace` (m): a large knob of radius
 * `r` in a satin bezel ring, ending at `zFront`.
 */
export function dial(p: Parts, cx: number, cy: number, zFace: number, zFront: number, r: number): void {
  const t = 0.004;
  p.lathe(
    "satin",
    cx,
    cy,
    zFace,
    [
      [0, 0],
      [r * 1.25, 0],
      [r * 1.25, t * 0.4],
      [r * 1.12, t],
      [0, t],
    ],
    { axis: "z" },
  );
  p.knob(cx, cy, zFace + t, zFront, r);
}

/** Short round feet under a table-top unit at its corners, inset by `inset` (m); returns their height. */
export function tableFeet(p: Parts, w: number, d: number, h: number, inset = 0.03, r = TABLE_FOOT): number {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) foot(p, sx * (w / 2 - inset), sz * (d / 2 - inset), h, r);
  }
  return h;
}

/** Hinge barrels along x at height y and depth z (m): `n` short satin cylinders from x0 to x1. */
export function hinges(p: Parts, x0: number, x1: number, y: number, z: number, n: number, r = 0.008, len = 0.04): void {
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5);
    p.lathe("satin", cx - len / 2, y, z, [
      [0, 0],
      [r * 0.8, 0],
      [r, r * 0.3],
      [r, len - r * 0.3],
      [r * 0.8, len],
      [0, len],
    ], { axis: "x" });
  }
}

/**
 * A turned black grip along z from `z0` to `z1` at (x, y): the handle of a basket, a lid or a
 * plate, rounded at both ends.
 */
export function gripZ(p: Parts, x: number, y: number, z0: number, z1: number, r = 0.01): void {
  const l = z1 - z0;
  p.lathe("knob", x, y, z0, [
    [0, 0],
    [r * 0.8, 0],
    [r, Math.min(r * 0.6, l / 4)],
    [r, l - Math.min(r * 0.6, l / 4)],
    [r * 0.8, l],
    [0, l],
  ], { axis: "z" });
}

/** The same grip along x from `x0` to `x1` at (y, z). */
export function gripX(p: Parts, x0: number, x1: number, y: number, z: number, r = 0.01): void {
  const l = x1 - x0;
  p.lathe("knob", x0, y, z, [
    [0, 0],
    [r * 0.8, 0],
    [r, Math.min(r * 0.6, l / 4)],
    [r, l - Math.min(r * 0.6, l / 4)],
    [r * 0.8, l],
    [0, l],
  ], { axis: "x" });
}
