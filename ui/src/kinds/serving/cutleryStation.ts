// Cutlery and tray station (Besteck- und Tablettstation): cutlery holders and a napkin box on
// the top, open shelves with tray stacks below, open to the guest side (the front).

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { PLINTH, plinth, SHEET, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

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
    // Carcass open to the front: sides, back, bottom, middle shelf and top.
    p.box("steel", -w / 2, -w / 2 + SHEET * 2, PLINTH, h - TOP, -d / 2, d / 2);
    p.box("steel", w / 2 - SHEET * 2, w / 2, PLINTH, h - TOP, -d / 2, d / 2);
    p.box("steel", -w / 2, w / 2, PLINTH, h - TOP, -d / 2, -d / 2 + SHEET * 2);
    p.box("steel", -w / 2, w / 2, PLINTH, PLINTH + SHEET * 2, -d / 2, d / 2);
    const mid = (PLINTH + h - TOP) / 2;
    p.box("steel", -w / 2, w / 2, mid - SHEET, mid + SHEET, -d / 2, d / 2);
    p.box("steel", -w / 2, w / 2, h - TOP, h, -d / 2, d / 2);
    // Tray stacks on both shelves.
    const tw = Math.min(0.265, (w - SHEET * 4) / 2 - 0.01);
    const td = Math.min(0.185, d / 2 - SHEET * 2 - 0.01);
    for (const y0 of [PLINTH + SHEET * 2, mid + SHEET]) {
      for (let i = 0; i < TRAYS; i++) {
        const y = y0 + i * TRAY;
        p.box(i % 2 === 0 ? "panelDark" : "knob", -tw, tw, y, y + TRAY, -td + SHEET, td + SHEET);
      }
    }
    // Cutlery holders with knives, forks and spoons standing in them.
    for (const xm of holderXs(item.width)) {
      const x = xm / 1000;
      const r = HOLDER_R / 1000;
      p.cyl("steel", x, 0, h, h + HOLDER_H / 1000, r);
      p.cyl("steelDark", x, 0, h + HOLDER_H / 1000 - 0.004, h + HOLDER_H / 1000, r * 0.85);
      for (const dx of [-0.015, 0, 0.015]) p.box("handle", x + dx - 0.003, x + dx + 0.003, h + HOLDER_H / 1000, h + (HOLDER_H + CUTLERY) / 1000 - (dx === 0 ? 0 : 0.01), -0.008, 0.008);
    }
    const nx = w / 2 - INSET / 1000;
    p.box("steel", nx - NAPKINS.w / 1000, nx, h, h + NAPKINS.h / 1000, -NAPKINS.d / 2000, NAPKINS.d / 2000);
    // The napkins show through the slot in the box's lid.
    p.box("panel", nx - NAPKINS.w / 1000 + 0.03, nx - 0.03, h + NAPKINS.h / 1000, h + NAPKINS.h / 1000 + 0.004, -0.02, 0.02);
  },
};
