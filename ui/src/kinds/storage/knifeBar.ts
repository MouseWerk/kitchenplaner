// Magnetic knife bar: a stainless bar with a black magnet strip on the wall, knives of several
// lengths held by their blades, handles up. The longest blade's tip defines the unit's height.

import type { KindDef } from "../types";

// Construction sizes (m).
/** Height of the bar and its depth from the wall. */
const BAR_H = 0.05;
const BAR_D = 0.02;
/** Lower edge of the bar below the top. */
const BAR_DROP = 0.1;
/** Handle length (the handles reach the front of the unit). */
const HANDLE_L = 0.12;
/** Distance between two knives. */
const KNIFE_PITCH = 0.065;
/** Blade lengths as parts of the longest one (chef's knife first). */
const BLADES = [1, 0.6, 0.85, 0.5, 0.75, 0.65];

/** Positions of the knives along the width (m), centred on x = 0. */
function knives(w: number): number[] {
  const n = Math.max(2, Math.floor((w - 0.06) / KNIFE_PITCH));
  const span = (n - 1) * KNIFE_PITCH;
  return Array.from({ length: n }, (_, i) => -span / 2 + KNIFE_PITCH * i);
}

export const knifeBar: KindDef = {
  kind: "knifeBar",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.B + BAR_D * 1000], [s.R, s.B + BAR_D * 1000]);
  },
  elevation(f) {
    const zb = f.top - BAR_DROP * 1000;
    f.box("detail", f.l, f.r, zb, zb + BAR_H * 1000);
    const c = (f.l + f.r) / 2;
    const blade = (f.top - HANDLE_L * 1000 - f.z0) / 1000;
    knives(f.w / 1000).forEach((x, i) => {
      const xc = c + x * 1000;
      const hz = f.top - HANDLE_L * 1000;
      f.box("detail", xc - 11, xc + 11, hz, f.top);
      f.line("detail", [xc - 12, hz], [xc - 12, hz - blade * 1000 * BLADES[i % BLADES.length]], [xc + 12, hz - 40]);
    });
  },
  mesh(p, s) {
    const B = -s.d / 2;
    const yb = s.h - BAR_DROP;
    p.box("steel", -s.w / 2, s.w / 2, yb, yb + BAR_H, B, B + BAR_D);
    p.box("knob", -s.w / 2 + 0.02, s.w / 2 - 0.02, yb + 0.01, yb + BAR_H - 0.01, B + BAR_D, B + BAR_D + 0.002);
    const zf = B + BAR_D + 0.002;
    const hy = s.h - HANDLE_L;
    knives(s.w).forEach((x, i) => {
      const len = hy * BLADES[i % BLADES.length];
      const bw = 0.022 + 0.018 * BLADES[i % BLADES.length];
      // The blade, a narrower tip, the bolster and the handle.
      p.box("steel", x - bw / 2, x + bw / 2, hy - len + 0.04, hy, zf, zf + 0.002);
      p.box("steel", x - bw / 2, x + bw * 0.1, hy - len, hy - len + 0.04, zf, zf + 0.002);
      p.box("handle", x - bw / 2, x + bw / 2, hy - 0.012, hy, zf, (zf + s.d / 2) / 2);
      p.box("knob", x - 0.011, x + 0.011, hy, s.h, zf + 0.002, s.d / 2);
    });
  },
};
