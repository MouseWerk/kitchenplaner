// Grease separator (Fettabscheider): a free-standing stainless tank on feet with a sludge trap and
// a separator chamber under manhole covers, the inlet on the left, the outlet lower on the right,
// a sight glass and the disposal connection at the front.

import { FEET } from "../parts/elevation";
import { foot } from "../parts/mesh";
import type { KindDef } from "../types";
import { flangedPipe, manholeCover, valveLever } from "./pipes";

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
      for (const sz of [-1, 1]) foot(p, sx * (W - 0.06), sz > 0 ? zt - 0.06 : -D + 0.06, LEGS + 0.01, 0.03);
    }
    // The tank: a welded stainless box with rounded upright corners and a folded top edge.
    p.roundedBox("steel", -W, W, LEGS, top - 0.03, -D, zt, 0.008, "vertical");
    p.roundedBox("steel", -W - 0.004, W + 0.004, top - 0.03, top, -D, zt + 0.004, 0.003);
    const { xs, r: cr } = covers(s.w, s.d);
    for (const x of xs) manholeCover(p, x, top, 0, cr, COVER);
    // Inlet (left, higher) and outlet (right, lower), each a pipe with a flange at the tank.
    flangedPipe(p, -s.w / 2, -W, top - 0.2, 0, PIPE);
    flangedPipe(p, s.w / 2, W, top - 0.26, 0, PIPE);
    // Sight glass in a turned frame, and the disposal connection with its valve lever.
    p.plate("satin", -0.035, 0.035, LEGS + 0.14, top - 0.24, zt - 0.001, zt + 0.004, 0.012);
    p.plate("glassDark", -0.025, 0.025, LEGS + 0.15, top - 0.25, zt + 0.004, zt + 0.006, 0.008);
    const xd = -W + 0.2;
    p.lathe("satin", xd, LEGS + 0.12, zt - 0.001, [
      [0, 0],
      [0.045, 0],
      [0.045, 0.012],
      [0.032, 0.014],
      [0.032, DISPOSAL - 0.012],
      [0.04, DISPOSAL - 0.01],
      [0.04, DISPOSAL - 0.001],
      [0, DISPOSAL - 0.001],
    ], { axis: "z" });
    valveLever(p, xd, LEGS + 0.12, D - 0.02, D, 0.12);
  },
};
