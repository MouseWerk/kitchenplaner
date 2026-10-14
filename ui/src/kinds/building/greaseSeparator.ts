// Grease separator (Fettabscheider): a free-standing stainless tank on feet with a sludge trap and
// a separator chamber under manhole covers, the inlet on the left, the outlet lower on the right,
// a sight glass and the disposal connection at the front.

import { FEET } from "../parts/elevation";
import type { KindDef } from "../types";

// Sizes (m).
/** Height of the feet. */
const LEGS = 0.1;
/** Radius of the inlet and outlet pipes (DN 100) and how far they stand out at the sides. */
const PIPE = 0.055;
const PIPE_OUT = 0.08;
/** Height of a manhole cover with its handle. */
const COVER = 0.05;
/** Depth of the disposal connection in front of the tank. */
const DISPOSAL = 0.06;

/**
 * Manhole covers over the tank of a unit `w` × `d` (m): their centres along the width and their
 * radius. From 1100 mm on the tank has two chambers, each with its own cover.
 */
function covers(w: number, d: number): { xs: number[]; r: number } {
  const half = w / 2 - PIPE_OUT;
  const two = w >= 1.1;
  const r = Math.max(0.05, Math.min(0.3, d / 2 - 0.06, (two ? half / 2 : half) - 0.03));
  return { xs: two ? [-half / 2, half / 2] : [0], r };
}

export const greaseSeparator: KindDef = {
  kind: "greaseSeparator",
  plan(s) {
    const { xs, r } = covers(s.w / 1000, s.d / 1000);
    for (const x of xs) s.circle("detail", x * 1000, 0, r * 1000);
    // Inlet and outlet pipes at the sides.
    const o = PIPE_OUT * 1000;
    s.line("detail", [s.L, -PIPE * 1000], [s.L + o, -PIPE * 1000]);
    s.line("detail", [s.L, PIPE * 1000], [s.L + o, PIPE * 1000]);
    s.line("detail", [s.R, -PIPE * 1000], [s.R - o, -PIPE * 1000]);
    s.line("detail", [s.R, PIPE * 1000], [s.R - o, PIPE * 1000]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const o = PIPE_OUT * 1000;
    const t0 = z0 + LEGS * 1000;
    const t1 = top - COVER * 1000;
    f.box("detail", l + o, r - o, t0, t1);
    for (const x of [l + o + 40, r - o - 80]) f.box("detail", x, x + 40, z0, t0);
    // Inlet higher than the outlet.
    const pr = PIPE * 1000;
    f.box("detail", l, l + o, t1 - 200 - pr, t1 - 200 + pr);
    f.box("detail", r - o, r, t1 - 260 - pr, t1 - 260 + pr);
    const c = (l + r) / 2;
    const { xs, r: cr } = covers(f.w / 1000, f.item.depth / 1000);
    for (const x of xs) f.box("detail", c + (x - cr) * 1000, c + (x + cr) * 1000, t1, top);
    // Sight glass.
    f.box("detail", c - 25, c + 25, t0 + FEET, t1 - 250);
  },
  mesh(p, s) {
    const W = s.w / 2 - PIPE_OUT;
    const D = s.d / 2;
    const zt = D - DISPOSAL;
    const top = s.h - COVER;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (W - 0.06);
        const z = sz * (sz > 0 ? zt - 0.06 : D - 0.06);
        p.box("steelDark", x - 0.025, x + 0.025, 0.012, LEGS, z - 0.025, z + 0.025);
        p.cyl("rubber", x, z, 0, 0.012, 0.03);
      }
    }
    p.box("steel", -W, W, LEGS, top, -D, zt);
    // A welded seam around the tank's top edge.
    p.box("steelDark", -W - 0.004, W + 0.004, top - 0.03, top - 0.02, -D, zt + 0.004);
    const { xs, r: cr } = covers(s.w, s.d);
    for (const x of xs) {
      p.cyl("steelDark", x, 0, top, top + COVER * 0.4, cr);
      p.cyl("steel", x, 0, top + COVER * 0.4, top + COVER * 0.6, cr * 0.85);
      p.rod("handle", "x", x, s.h - 0.01, 0, cr, 0.01);
    }
    // Inlet (left, higher) and outlet (right, lower) with flanges at the tank.
    const yIn = top - 0.2;
    const yOut = top - 0.26;
    p.rod("panelDark", "x", -s.w / 2 + PIPE_OUT / 2, yIn, 0, PIPE_OUT, PIPE);
    p.rod("steelDark", "x", -W - 0.01, yIn, 0, 0.02, PIPE * 1.4);
    p.rod("panelDark", "x", s.w / 2 - PIPE_OUT / 2, yOut, 0, PIPE_OUT, PIPE);
    p.rod("steelDark", "x", W + 0.01, yOut, 0, 0.02, PIPE * 1.4);
    // Sight glass and the disposal connection with its valve lever.
    p.box("glassDark", -0.025, 0.025, LEGS + 0.15, top - 0.25, zt, zt + 0.003);
    const xd = -W + 0.2;
    p.rod("steelDark", "z", xd, LEGS + 0.12, zt + DISPOSAL / 2, DISPOSAL, 0.04);
    p.box("knob", xd - 0.012, xd + 0.012, LEGS + 0.16, LEGS + 0.26, D - 0.02, D);
  },
};
