// Cutlery and tray station (Besteck- und Tablettstation): cutlery holders and a napkin box on
// the top, open shelves with tray stacks below, open to the guest side (the front).

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { BODY_RADIUS, PLINTH, plinth, SHEET, TOP, TOP_RADIUS, worktop } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { trayStack } from "./common";

/** Cutlery holders on the top: pitch, radius and height (mm). */
const HOLDER_PITCH = 130;
const HOLDER_R = 50;
const HOLDER_H = 150;
/** Cutlery handles stand this far out of the holders (mm). */
const CUTLERY = 50;
/** Napkin box on the top (mm). */
const NAPKINS = { w: 220, d: 180, h: 110 };
/** Trays in each stack and their thickness (m). */
const TRAYS = 6;
const TRAY = 0.02;

/** Centres of the cutlery holders along the width (mm), leaving room for the napkin box at the right. */
function holderXs(width: number): number[] {
  const span = width - NAPKINS.w - INSET * 3;
  const n = Math.max(1, Math.min(6, Math.floor(span / HOLDER_PITCH)));
  const x0 = -width / 2 + INSET + HOLDER_PITCH / 2;
  return Array.from({ length: n }, (_, i) => x0 + i * HOLDER_PITCH);
}

export const cutleryStation: KindDef = {
  kind: "cutleryStation",
  rise: HOLDER_H + CUTLERY,
  plan(s) {
    for (const x of holderXs(s.w)) s.circle("detail", x, 0, HOLDER_R);
    s.rect("detail", s.R - INSET - NAPKINS.w, -NAPKINS.d / 2, s.R - INSET, NAPKINS.d / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    f.worktop();
    // Two open shelves with tray stacks.
    const mid = (z0 + top) / 2;
    f.box("detail", l + I, r - I, z0 + PLINTH * 1000, mid - I / 2, "item-dark");
    f.box("detail", l + I, r - I, mid + I / 2, top - FRONT_TOP - I / 2, "item-dark");
    const scale = f.w / f.item.width;
    const cx = (l + r) / 2;
    for (const x of holderXs(f.item.width)) {
      const a = cx + x * scale;
      f.box("detail", a - HOLDER_R * scale, a + HOLDER_R * scale, top, top + HOLDER_H);
      f.line("detail", [a - 10 * scale, top + HOLDER_H], [a - 10 * scale, top + HOLDER_H + CUTLERY]);
      f.line("detail", [a + 10 * scale, top + HOLDER_H], [a + 10 * scale, top + HOLDER_H + CUTLERY]);
    }
    const nx = cx + (f.item.width / 2 - INSET) * scale;
    f.box("detail", nx - NAPKINS.w * scale, nx, top, top + NAPKINS.h);
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    plinth(p, w, d);
    // Carcass open to the front: sides, back, bottom, middle shelf and top, the shelves with a
    // rounded front edge.
    const t = SHEET * 2;
    p.roundedBox("steel", -w / 2, -w / 2 + t, PLINTH, h - TOP, -d / 2, d / 2, BODY_RADIUS);
    p.roundedBox("steel", w / 2 - t, w / 2, PLINTH, h - TOP, -d / 2, d / 2, BODY_RADIUS);
    p.box("steelDark", -w / 2 + t, w / 2 - t, PLINTH, h - TOP, -d / 2, -d / 2 + t);
    p.roundedBox("steel", -w / 2 + t - 0.001, w / 2 - t + 0.001, PLINTH, PLINTH + t, -d / 2 + t, d / 2 - 0.002, TOP_RADIUS);
    const mid = (PLINTH + h - TOP) / 2;
    p.roundedBox("steel", -w / 2 + t - 0.001, w / 2 - t + 0.001, mid - SHEET, mid + SHEET, -d / 2 + t, d / 2 - 0.002, TOP_RADIUS);
    worktop(p, "steel", -w / 2, w / 2, h - TOP, h, -d / 2, d / 2);
    // Tray stacks on both shelves.
    const tw = Math.min(0.265, (w - t * 2) / 2 - 0.01);
    const td = Math.min(0.185, d / 2 - t - 0.01);
    for (const y0 of [PLINTH + t, mid + SHEET]) trayStack(p, -tw, tw, y0, -td + SHEET, td + SHEET, TRAYS, TRAY);
    // Cutlery holders: perforated quivers with a rolled rim, knives, forks and spoons standing in
    // them handle up.
    const hh = HOLDER_H / 1000;
    for (const [k, xm] of holderXs(item.width).entries()) {
      const x = xm / 1000;
      const r = HOLDER_R / 1000;
      p.lathe("satin", x, h, 0, [
        [0, 0],
        [r * 0.9, 0],
        [r, 0.006],
        [r, hh - 0.006],
        [r + 0.003, hh - 0.003],
        [r, hh],
        [r - 0.003, hh],
        [r - 0.003, 0.01],
        [0, 0.01],
      ]);
      for (const y of [0.04, 0.07, 0.1]) p.plate("slot", x - 0.012, x + 0.012, h + y - 0.006, h + y + 0.006, r - 0.0005, r + 0.0005, 0.005);
      for (const [j, dx] of [-0.016, 0, 0.016].entries()) {
        const top = h + (HOLDER_H + CUTLERY) / 1000 - (j === 1 ? 0 : 0.012) - (k % 2) * 0.006;
        p.roundedBox("handle", x + dx - 0.005, x + dx + 0.005, h + hh - 0.06, top, -0.002 + dx * 0.3, 0.002 + dx * 0.3, 0.0015, "vertical", "z");
      }
    }
    // Napkin box with the napkins showing in its slot.
    const nx = w / 2 - INSET / 1000;
    const nw = NAPKINS.w / 1000;
    const nh = NAPKINS.h / 1000;
    p.roundedBox("steel", nx - nw, nx, h, h + nh, -NAPKINS.d / 2000, NAPKINS.d / 2000, 0.01);
    p.roundedBox("slot", nx - nw + 0.03, nx - 0.03, h + nh - 0.002, h + nh + 0.0005, -0.025, 0.025, 0.012, "vertical");
    p.roundedBox("panel", nx - nw + 0.04, nx - 0.04, h + nh - 0.004, h + nh + 0.002, -0.015, 0.015, 0.006);
  },
};
