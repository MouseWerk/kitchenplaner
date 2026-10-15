// Platform (Podest): a raised, tiled floor area for equipment or a step, with a stainless nosing
// along the front edge.

import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

// Sizes (m).
/** Leg of the nosing angle and its sheet thickness. */
const NOSING = 0.04;
const NOSING_T = 0.004;
/** Size of the floor tiles on top. */
const TILE = 0.3;
/** Width of a joint between tiles. */
const JOINT = 0.004;

/** Joint positions from -size/2 to size/2 between whole tiles (m). */
function joints(size: number): number[] {
  const out: number[] = [];
  for (let x = -size / 2 + TILE; x < size / 2 - 0.01; x += TILE) out.push(x);
  return out;
}

export const platform: KindDef = {
  kind: "platform",
  // Equipment stands on it: flat, so nothing on it counts as an overlap. Its height is not added
  // to what stands on it; give those items the platform height as elevation where it matters.
  placement: "flat",
  raised: true,
  plan(s) {
    s.line("detail", [s.L, s.F - INSET], [s.R, s.F - INSET]);
  },
  elevation(f) {
    f.box("detail", f.l, f.r, f.top - NOSING * 1000, f.top);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    p.box("concrete", -W, W, 0, s.h - 0.001, -D, D - NOSING_T);
    p.box("steel", -W, W, s.h - NOSING_T, s.h, D - NOSING, D);
    p.box("steel", -W, W, s.h - NOSING, s.h, D - NOSING_T, D);
    for (const x of joints(s.w)) p.box("steelDark", x - JOINT / 2, x + JOINT / 2, s.h - 0.002, s.h, -D, D - NOSING);
    for (const z of joints(s.d)) if (z < D - NOSING - JOINT) p.box("steelDark", -W, W, s.h - 0.002, s.h, z - JOINT / 2, z + JOINT / 2);
  },
};
