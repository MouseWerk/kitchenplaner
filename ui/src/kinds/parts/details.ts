// Small details of machines that several areas share in 3D: pressed housings, the dark control
// panel, displays, rating plates and vent slots (m, in the item frame as in kinds/README.md).
// What only one area uses stays in that area (cooking/details.ts, washing/details.ts,
// prep/machine.ts, serving/common.ts).

import { BODY_RADIUS, type MaterialId, type Parts } from "./mesh";

/** Edge radius of pressed and deep-drawn housings (ovens, machines, table-top units; m). */
export const HOUSING_RADIUS = 0.008;
/** Corner radius of displays (m). */
const DISPLAY_RADIUS = 0.004;
/** How far a display stands on its panel (m). */
const DISPLAY_PROUD = 0.003;

/** A pressed housing filling the box, all edges rounded (`HOUSING_RADIUS`). */
export function housing(p: Parts, mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r = HOUSING_RADIUS): void {
  p.roundedBox(mat, x0, x1, y0, y1, z0, z1, r);
}

/** A dark control panel from `zBack` to its face at `zFace`, rounded at the front. */
export function controlPanel(p: Parts, x0: number, x1: number, y0: number, y1: number, zBack: number, zFace: number): void {
  p.roundedBox("panelDark", x0, x1, y0, y1, zBack, zFace, BODY_RADIUS, "top", "z");
}

/** A display (tinted glass with round corners) centred at (cx, cy) on a face at `zFace`. */
export function display(p: Parts, cx: number, cy: number, w: number, h: number, zFace: number): void {
  p.plate("glassDark", cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, zFace, zFace + DISPLAY_PROUD, Math.min(DISPLAY_RADIUS, w / 4, h / 4), true);
}

/** The rating plate (Typenschild) centred at (cx, cy): a small satin plate a millimetre on a face at `zFace`. */
export function ratingPlate(p: Parts, cx: number, cy: number, zFace: number, w = 0.07, h = 0.04): void {
  p.plate("satin", cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, zFace, zFace + 0.001, 0.002);
}

/**
 * Vent slots on a face at `zFace` (m): `n` slots with round ends, long along x (stacked from y0
 * to y1) or along y (side by side from x0 to x1), let a millimetre into the face's plane (the
 * `slot` material draws over it).
 */
export function ventSlots(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, n: number, along: "x" | "y" = "x"): void {
  if (along === "x") {
    const pitch = (y1 - y0) / n;
    const t = Math.min(0.008, pitch * 0.5);
    for (let i = 0; i < n; i++) {
      const y = y0 + pitch * (i + 0.5);
      p.plate("slot", x0, x1, y - t / 2, y + t / 2, zFace, zFace + 0.001, t / 2);
    }
  } else {
    const pitch = (x1 - x0) / n;
    const t = Math.min(0.008, pitch * 0.5);
    for (let i = 0; i < n; i++) {
      const x = x0 + pitch * (i + 0.5);
      p.plate("slot", x - t / 2, x + t / 2, y0, y1, zFace, zFace + 0.001, t / 2);
    }
  }
}
