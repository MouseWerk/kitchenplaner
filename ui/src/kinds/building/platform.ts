// Platform (Podest): a raised, tiled floor area for equipment or a step, with a stainless nosing
// along the front edge.

import { BODY_RADIUS, type Point2 } from "../parts/mesh";
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
    p.roundedBox("concrete", -W, W, 0, s.h - 0.001, -D, D - NOSING_T, BODY_RADIUS, "vertical");
    // The nosing: one angle with a rounded bend over the front edge, seen in the (z, y) plane.
    const r = 0.004;
    const outline: Point2[] = [
      [D - NOSING, s.h],
      [D - r, s.h],
      [D - r + r * Math.SQRT1_2, s.h - r + r * Math.SQRT1_2],
      [D, s.h - r],
      [D, s.h - NOSING],
      [D - NOSING_T, s.h - NOSING],
      [D - NOSING_T, s.h - NOSING_T],
      [D - NOSING, s.h - NOSING_T],
    ];
    p.extrude("steel", "x", -W, W, outline);
    // Tile joints drawn into the top, standing a millimetre proud of the concrete.
    for (const x of joints(s.w)) p.box("steelDark", x - JOINT / 2, x + JOINT / 2, s.h - 0.002, s.h, -D, D - NOSING);
    for (const z of joints(s.d)) if (z < D - NOSING - JOINT) p.box("steelDark", -W, W, s.h - 0.002, s.h, z - JOINT / 2, z + JOINT / 2);
  },
};
