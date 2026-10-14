// Pendant heat lamps (Wärmelampen, Pendel): round shades with an infrared bulb, each hanging on
// its cord from a ceiling rail, in a row over a pass or a carving board.

import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Spacing of the lamps along the rail (mm) and the shade's radius and height (m). */
const PITCH = 300;
const SHADE_R = 0.1;
const SHADE_H = 0.12;

/** Number of lamps on a rail of the given width (mm). */
export function lampCount(width: number): number {
  return Math.max(1, Math.floor(width / PITCH));
}

/** Centres of the lamps along the width (mm). */
function lampXs(width: number): number[] {
  const n = lampCount(width);
  const pitch = width / n;
  return Array.from({ length: n }, (_, i) => -width / 2 + pitch * (i + 0.5));
}

export const heatLampPendant: KindDef = {
  kind: "heatLampPendant",
  placement: "overhead",
  plan(s) {
    const r = Math.min(SHADE_R * 1000, s.d / 2, s.w / lampCount(s.w) / 2);
    for (const x of lampXs(s.w)) {
      s.circle("overhead", x, 0, r);
      s.circle("overhead", x, 0, r / 2);
    }
    s.line("overhead", [s.L + INSET / 2, 0], [s.R - INSET / 2, 0]);
  },
  elevation(f) {
    const { z0, top } = f;
    const sh = SHADE_H * 1000;
    const scale = f.w / f.item.width;
    const r = Math.min(SHADE_R * 1000, f.item.width / lampCount(f.item.width) / 2) * scale;
    for (const x0 of lampXs(f.item.width)) {
      const x = (f.l + f.r) / 2 + x0 * scale;
      // Shade as a trapezoid, the cord up to the rail.
      f.line("detail", [x - r, z0], [x - r / 2, z0 + sh], [x + r / 2, z0 + sh], [x + r, z0], [x - r, z0]);
      f.line("detail", [x, z0 + sh], [x, top]);
    }
    f.line("detail", [f.l, top - 20], [f.r, top - 20]);
  },
  elevationSide(f) {
    const r = Math.min(SHADE_R * 1000, f.w / 2);
    const x = (f.l + f.r) / 2;
    f.line("detail", [x - r, f.z0], [x - r / 2, f.z0 + SHADE_H * 1000], [x + r / 2, f.z0 + SHADE_H * 1000], [x + r, f.z0], [x - r, f.z0]);
  },
  mesh(p, s, item) {
    const r = Math.min(SHADE_R, s.d / 2, s.w / lampCount(item.width) / 2);
    const sh = Math.min(SHADE_H, s.h / 3);
    for (const xm of lampXs(item.width)) {
      const x = xm / 1000;
      // A stepped shade (wide rim, narrower crown), the bulb in it, the cord and its strain relief.
      p.cyl("steelDark", x, 0, sh * 0.25, sh * 0.7, r);
      p.cyl("steelDark", x, 0, sh * 0.7, sh, r * 0.55);
      p.cyl("handle", x, 0, 0, sh * 0.25, r * 0.92);
      p.cyl("glass", x, 0, sh * 0.05, sh * 0.6, r * 0.6);
      p.rod("rubber", "y", x, (sh + s.h) / 2, 0, s.h - sh, 0.003);
    }
    // The ceiling plate the lamps hang from.
    p.box("steel", -s.w / 2, s.w / 2, s.h - 0.02, s.h, -s.d / 2, s.d / 2);
  },
};
