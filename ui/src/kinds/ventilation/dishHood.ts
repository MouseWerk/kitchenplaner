// Vapour hood over a dishwasher (Brüdenhaube): a box canopy with straight skirts over a hood-type
// or rack conveyor dishwasher that catches the hot vapour when the hood opens. Inside it a
// condensate gutter runs all round with a drain stub at a back corner, a labyrinth filter sits
// across the middle and the exhaust spigot on the top; the light and its switch on the front.

import { INSET } from "../parts/elevation";
import { cross, INSET as PLAN_INSET } from "../parts/plan";
import { SHEET, type Point2 } from "../parts/mesh";
import type { KindDef } from "../types";
import { levelSlots, spigotUp } from "./common";

/** Rolled lower edge (m) and the gutter round the inside (m). */
const ROLL = 0.006;
const GUTTER = { w: 0.04, h: 0.035 };
/** Exhaust spigot: radius (m) and how far it rises over the top (mm). */
const SPIGOT_R = 0.1;
const SPIGOT_RISE = 100;
/** Labyrinth filter across the middle: depth share and height under the top (m). */
const FILTER_SHARE = 0.4;
const FILTER_H = 0.05;

export const dishHood: KindDef = {
  kind: "dishHood",
  placement: "overhead",
  rise: SPIGOT_RISE,
  plan(s) {
    cross(s, "overhead");
    s.rect("overhead", s.L + PLAN_INSET, -s.d * FILTER_SHARE / 2, s.R - PLAN_INSET, (s.d * FILTER_SHARE) / 2);
    s.circle("overhead", 0, 0, SPIGOT_R * 1000);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.line("detail", [l, z0 + ROLL * 2000], [r, z0 + ROLL * 2000]);
    // The light switch at the right, the spigot on the top.
    f.box("detail", r - INSET * 3, r - INSET, (z0 + top) / 2 - 25, (z0 + top) / 2 + 25, "item-dark");
    const cx = (l + r) / 2;
    f.box("detail", cx - SPIGOT_R * 1000, cx + SPIGOT_R * 1000, top, top + SPIGOT_RISE);
  },
  elevationSide(f) {
    const { l, r, z0, top } = f;
    f.line("detail", [l, z0 + ROLL * 2000], [r, z0 + ROLL * 2000]);
    const cx = (l + r) / 2;
    f.box("detail", cx - SPIGOT_R * 1000, cx + SPIGOT_R * 1000, top, top + SPIGOT_RISE);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const t = SHEET;
    // The canopy: four straight skirts with a rolled lower edge, turned round the outline with
    // round corners, and the top sheet.
    const skirt: Point2[] = [
      [0, 0],
      [t + ROLL, 0],
      [t + ROLL, ROLL * 1.5],
      [t, ROLL * 2.5],
      [t, h - 0.01],
      [t - 0.004, h],
      [0, h],
      [0, 0],
    ];
    const hx = w / 2 - t - ROLL;
    const hz = d / 2 - t - ROLL;
    p.lathe("steel", 0, 0, 0, skirt, { rect: [hx, hz] });
    p.roundedBox("steel", -hx - t + 0.004, hx + t - 0.004, h - t, h, -hz - t + 0.004, hz + t - 0.004, 0.004, "top");
    // Condensate gutter all round inside the lower edge, the drain stub at the back right.
    p.lathe(
      "steelDark",
      0,
      0.004,
      0,
      [
        [0, 0],
        [GUTTER.w, 0],
        [GUTTER.w, GUTTER.h],
        [GUTTER.w - 0.002, GUTTER.h],
        [GUTTER.w - 0.002, 0.002],
        [0, 0.002],
        [0, 0],
      ],
      { rect: [hx - GUTTER.w, hz - GUTTER.w] },
    );
    p.lathe("satin", hx - GUTTER.w / 2, 0, -hz + GUTTER.w / 2, [
      [0, 0],
      [0.01, 0],
      [0.01, 0.006],
      [0.014, 0.008],
      [0.014, 0.012],
      [0, 0.012],
    ]);
    // Labyrinth filter across the middle, under the spigot: a dark frame with its slots.
    const fz = (d * FILTER_SHARE) / 2;
    p.roundedBox("steelDark", -hx + 0.02, hx - 0.02, h - t - FILTER_H, h - t, -fz, fz, 0.004);
    levelSlots(p, -hx + 0.05, hx - 0.05, -fz + 0.03, fz - 0.03, h - t - FILTER_H, Math.max(4, Math.round(w / 0.05)), 0.014);
    // A light in the canopy's ceiling in front of the filter, and the switch on the front.
    const lz = (fz + hz) / 2;
    p.roundedBox("satin", -0.2, 0.2, h - t - 0.012, h - t, lz - 0.05, lz + 0.05, 0.008, "vertical");
    p.roundedBox("panel", -0.18, 0.18, h - t - 0.016, h - t - 0.01, lz - 0.035, lz + 0.035, 0.006, "vertical");
    const sx = w / 2 - 0.09;
    p.plate("panelDark", sx - 0.04, sx + 0.04, h / 2 - 0.03, h / 2 + 0.03, d / 2 - ROLL - 0.0005, d / 2 - 0.002, 0.005, true);
    p.roundedBox("handle", sx - 0.012, sx + 0.012, h / 2 - 0.015, h / 2 + 0.015, d / 2 - 0.003, d / 2, 0.003, "top", "z");
    spigotUp(p, 0, h, 0, Math.min(SPIGOT_R, hx - 0.05, hz - 0.05), SPIGOT_RISE / 1000);
  },
};
