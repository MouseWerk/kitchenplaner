// Pendant heat lamps (Wärmelampen, Pendel): round shades with an infrared bulb, each hanging on
// its cord from a ceiling rail, in a row over a pass or a carving board.

import type { Front } from "../parts/elevation";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Spacing of the lamps along the rail (mm) and the shade's radius and height (m). */
const PITCH = 300;
const SHADE_R = 0.1;
const SHADE_H = 0.12;
/**
 * The shade in three tiers narrowing upwards (a cone as the parts allow): from the lower edge,
 * each tier's top (share of the shade's height) and radius (share of the shade's radius). The
 * plan and the elevations draw the same tiers.
 */
const TIERS = [
  { top: 0.5, r: 1 },
  { top: 0.8, r: 0.78 },
  { top: 1, r: 0.45 },
];
/** How far the bulb reaches below the shade's rim (m). */
const BULB = 0.006;

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
      for (const t of TIERS.slice(1)) s.circle("overhead", x, 0, r * t.r);
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
      // The tiers of the shade, the cord up to the rail.
      shadeFront(f, x, r, sh);
      f.line("detail", [x, z0 + sh], [x, top]);
    }
    f.line("detail", [f.l, top - 20], [f.r, top - 20]);
  },
  elevationSide(f) {
    const r = Math.min(SHADE_R * 1000, f.w / 2);
    const x = (f.l + f.r) / 2;
    shadeFront(f, x, r, SHADE_H * 1000);
    f.line("detail", [x, f.z0 + SHADE_H * 1000], [x, f.top]);
  },
  mesh(p, s, item) {
    const r = Math.min(SHADE_R, s.d / 2, s.w / lampCount(item.width) / 2);
    const sh = Math.min(SHADE_H, s.h / 3);
    for (const xm of lampXs(item.width)) {
      const x = xm / 1000;
      // The spun shade: a bell with a rolled rim, a satin reflector inside it and the red
      // infrared bulb hanging a little below the rim (the lowest part, so it shows from below);
      // the lamp holder on top and the cord up to the rail.
      p.lathe("steelDark", x, BULB, 0, [
        [r * 0.97, 0],
        [r, 0.002],
        [r, 0.006],
        [r * 0.9, sh * 0.3],
        [r * 0.62, sh * 0.72],
        [r * 0.42, sh * 0.92],
        [r * 0.3, sh - BULB],
        [0, sh - BULB],
        [0, sh - BULB - 0.004],
        [r * 0.38, sh * 0.88],
        [r * 0.58, sh * 0.7],
        [r * 0.86, sh * 0.3],
        [r * 0.95, 0.006],
        [r * 0.97, 0],
      ]);
      p.lathe("foodRed", x, 0, 0, [
        [0, 0],
        [r * 0.35, 0.004],
        [r * 0.55, sh * 0.25],
        [r * 0.5, sh * 0.42],
        [r * 0.2, sh * 0.6],
        [0, sh * 0.6],
      ]);
      p.lathe("knob", x, sh - 0.002, 0, [
        [0, 0],
        [0.02, 0],
        [0.02, 0.03],
        [0.012, 0.04],
        [0, 0.04],
      ]);
      p.rod("rubber", "y", x, (sh + 0.04 + s.h) / 2, 0, s.h - sh - 0.04, 0.003);
    }
    // The ceiling rail the lamps hang from, with its end caps.
    const rd = Math.min(0.06, s.d);
    p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - 0.03, s.h, -rd / 2, rd / 2, 0.008, "all", "x");
    p.roundedBox("steelDark", -s.w / 2 + 0.01, s.w / 2 - 0.01, s.h - 0.032, s.h - 0.029, -rd / 2 + 0.012, rd / 2 - 0.012, 0.002);
    // The rail reaches the depth with its ceiling plates at the ends.
    for (const x of [-s.w / 2 + 0.04, s.w / 2 - 0.04]) p.roundedBox("steelDark", x - 0.03, x + 0.03, s.h - 0.006, s.h, -s.d / 2, s.d / 2, 0.003);
  },
};

/** The tiers of a shade centred at x with radius r and height sh (mm), from the lower edge up. */
function shadeFront(f: Front, x: number, r: number, sh: number): void {
  let z = f.z0;
  for (const t of TIERS) {
    const z1 = f.z0 + sh * t.top;
    f.box("detail", x - r * t.r, x + r * t.r, z, z1);
    z = z1;
  }
}
