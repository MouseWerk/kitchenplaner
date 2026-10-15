// Parts the storage cabinets share: hinge barrels, lock cylinders, louvred vents and the small
// label plates of lockers and chemical cabinets.

import { GAP, type MaterialId, type Parts } from "../parts/mesh";

/** Radius and length of a hinge barrel (m). */
const HINGE_R = 0.006;
const HINGE_L = 0.05;
/** Radius of a lock cylinder's rosette (m). */
const LOCK_R = 0.011;

/**
 * Hinge barrels on the outer edges of `n` doors side by side (from x0 to x1, y0 to y1) whose
 * leaves stand in front of `zBody`, as `doors` in parts/mesh.ts hangs them: a single door on
 * the left, pairs from the middle.
 */
export function hinges(p: Parts, x0: number, x1: number, y0: number, y1: number, zBody: number, n: number): void {
  const dw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const left = n === 1 || i % 2 === 0;
    const x = left ? x0 + i * dw + GAP + HINGE_R : x0 + (i + 1) * dw - GAP - HINGE_R;
    const span = y1 - y0;
    for (const y of [y0 + span * 0.08, y1 - span * 0.08 - HINGE_L]) hingeBarrel(p, x, y, zBody + HINGE_R);
  }
}

/** One turned hinge barrel standing at (x, y) to y + `HINGE_L`, its axis at z. */
export function hingeBarrel(p: Parts, x: number, y: number, z: number): void {
  p.lathe("satin", x, y, z, [
    [0, 0],
    [HINGE_R * 0.7, 0],
    [HINGE_R, HINGE_R * 0.4],
    [HINGE_R, HINGE_L - HINGE_R * 0.4],
    [HINGE_R * 0.7, HINGE_L],
    [0, HINGE_L],
  ]);
}

/** A lock cylinder in a door face at `zFace`: a turned rosette with the dark keyway, at (x, y). */
export function lock(p: Parts, x: number, y: number, zFace: number, r = LOCK_R): void {
  p.lathe(
    "satin",
    x,
    y,
    zFace - 0.001,
    [
      [0, 0],
      [r, 0],
      [r, 0.002],
      [r * 0.8, 0.005],
      [0, 0.005],
    ],
    { axis: "z" },
  );
  p.box("slot", x - r * 0.12, x + r * 0.12, y - r * 0.5, y + r * 0.5, zFace + 0.004, zFace + 0.0045);
}

/**
 * A louvred vent in a face at `zFace` from x0 to x1 and y0 to y1: rows of slots with round ends,
 * as punched into locker doors.
 */
export function louvres(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, pitch = 0.016): void {
  const h = Math.min(0.006, pitch * 0.45);
  const n = Math.max(1, Math.floor((y1 - y0) / pitch));
  for (let i = 0; i < n; i++) {
    const y = y0 + pitch * (i + 0.5);
    p.plate("slot", x0, x1, y - h / 2, y + h / 2, zFace - 0.001, zFace + 0.0008, h / 2);
  }
}

/** A small label plate (a number or a warning sign) on a face at `zFace`, centred at (x, y). */
export function labelPlate(p: Parts, x: number, y: number, w: number, h: number, zFace: number, mat: MaterialId = "panel"): void {
  p.plate(mat, x - w / 2, x + w / 2, y - h / 2, y + h / 2, zFace - 0.0005, zFace + 0.0012, Math.min(w, h) * 0.12);
}
