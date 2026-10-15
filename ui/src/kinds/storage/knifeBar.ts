// Magnetic knife bar: a stainless bar with a black magnet strip on the wall and knives of several
// lengths held by the flat of their blades, blades up and round handles hanging below, as they
// are put on a magnet bar. The longest blade's tip is the unit's top.

import type { Parts } from "../parts/mesh";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Height of the bar and its depth from the wall. */
const BAR_H = 0.04;
const BAR_D = 0.02;
/** Handle length and bolster length. */
const HANDLE_L = 0.11;
const BOLSTER = 0.012;
/** Gap between the bar and the magnet strip's face, where the blades lie. */
const STRIP = 0.001;
/** The blade's heel lies this far below the bar. */
const HEEL_DROP = 0.012;
/** Blade thickness. */
const BLADE_T = 0.002;
/** Distance between two knives. */
const KNIFE_PITCH = 0.065;
/** Blade lengths as parts of the longest one (chef's knife first) and their widths (m). */
const BLADES = [1, 0.55, 0.85, 0.45, 0.75, 0.65];
const WIDTHS = [0.042, 0.018, 0.03, 0.016, 0.026, 0.022];

/** Positions of the knives along the width (m), centred on x = 0. */
function knives(w: number): number[] {
  const n = Math.max(2, Math.floor((w - 0.06) / KNIFE_PITCH));
  const span = (n - 1) * KNIFE_PITCH;
  return Array.from({ length: n }, (_, i) => -span / 2 + KNIFE_PITCH * i);
}

/**
 * Radius of a handle (m): the handles lie against the blades, the thickest (the chef's knife,
 * the first) reaches the front of the unit, the others are thinner by their blade's width.
 */
function handleR(d: number, i: number): number {
  const max = (d - BAR_D - STRIP - BLADE_T) / 2;
  return max * (0.7 + (0.3 * WIDTHS[i % WIDTHS.length]) / WIDTHS[0]);
}

/** Heights (m above the elevation): the blades' heel, the bar's lower edge, the longest tip. */
function levels(h: number) {
  const heel = Math.min(HANDLE_L + BOLSTER, h * 0.45);
  return { heel, bar: heel + HEEL_DROP, blade: h - heel };
}

/**
 * One blade from `y0` (the heel) up to `y0 + len`, `bw` wide, centred on `x`: the straight part
 * and the point, a square turned by 45 degrees whose upper half sticks out above it.
 */
function blade(p: Parts, x: number, bw: number, y0: number, len: number, z0: number) {
  const yp = y0 + len - bw / 2;
  p.box("steel", x - bw / 2, x + bw / 2, y0, yp, z0, z0 + BLADE_T);
  // A hair thinner than the blade, so its lower half hides inside it without shared faces.
  const side = bw / Math.SQRT2;
  const tip = p.box("steel", x - side / 2, x + side / 2, yp - side / 2, yp + side / 2, z0 + BLADE_T * 0.1, z0 + BLADE_T * 0.9);
  tip.rotation.z = Math.PI / 4;
}

export const knifeBar: KindDef = {
  kind: "knifeBar",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.B + BAR_D * 1000], [s.R, s.B + BAR_D * 1000]);
    // The handles, hanging in front of the bar.
    const z0 = s.B + (BAR_D + STRIP + BLADE_T) * 1000;
    knives(s.w / 1000).forEach((x, i) => {
      const r = handleR(s.d / 1000, i) * 1000;
      s.circle("overhead", x * 1000, z0 + r, r);
    });
  },
  elevation(f) {
    const { heel, bar, blade: longest } = levels(f.item.height / 1000);
    const z = (y: number) => f.z0 + y * 1000;
    f.box("detail", f.l, f.r, z(bar), z(bar + BAR_H));
    const c = (f.l + f.r) / 2;
    knives(f.w / 1000).forEach((x, i) => {
      const xc = c + x * 1000;
      const len = longest * BLADES[i % BLADES.length];
      const bw = WIDTHS[i % WIDTHS.length] * 1000;
      // Handle and bolster below the heel, the blade's outline with its point above it.
      const r = handleR(f.item.depth / 1000, i) * 1000;
      const yp = z(heel + len) - bw / 2;
      f.box("detail", xc - r, xc + r, f.z0, z(heel));
      f.line("detail", [xc - bw / 2, z(heel)], [xc - bw / 2, yp], [xc, z(heel + len)], [xc + bw / 2, yp], [xc + bw / 2, z(heel)]);
    });
  },
  mesh(p, s) {
    const B = -s.d / 2;
    const { heel, bar, blade: longest } = levels(s.h);
    p.box("steel", -s.w / 2, s.w / 2, bar, bar + BAR_H, B, B + BAR_D);
    p.box("knob", -s.w / 2 + 0.015, s.w / 2 - 0.015, bar + 0.008, bar + BAR_H - 0.008, B + BAR_D, B + BAR_D + STRIP);
    const zb = B + BAR_D + STRIP;
    knives(s.w).forEach((x, i) => {
      const r = handleR(s.d, i);
      const zh = zb + BLADE_T + r;
      blade(p, x, WIDTHS[i % WIDTHS.length], heel, longest * BLADES[i % BLADES.length], zb);
      // The bolster and the round handle hanging below the heel.
      p.rod("steel", "y", x, heel - BOLSTER / 2, zh, BOLSTER, r * 0.8);
      p.rod("knob", "y", x, (heel - BOLSTER) / 2, zh, heel - BOLSTER, r);
    });
  },
};
