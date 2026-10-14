// Columns (Stützen): concrete columns of the building, drawn like a wall, square or round. In a
// kitchen their lower part is protected against trolleys: stainless corner guards on a square
// column, a stainless sleeve on a round one.

import type { Vec2 } from "../../model/types";
import type { Front } from "../parts/elevation";
import type { KindDef } from "../types";

// Sizes (m).
/** Height of the corner guards and sleeves. */
const GUARD = 1.2;
/** Sheet thickness of a guard. */
const GUARD_T = 0.003;
/** Leg of a corner guard angle. */
const GUARD_LEG = 0.05;
/** Corners of the polygon that draws a round column's outline in the plan. */
const ROUND_SEGMENTS = 48;

/** Elevation: the guards at both edges of a square column. */
function guardsFront(f: Front) {
  const z1 = f.z0 + Math.min(GUARD * 1000, f.item.height);
  const leg = Math.min(GUARD_LEG * 1000, f.w / 3);
  f.box("detail", f.l, f.l + leg, f.z0, z1);
  f.box("detail", f.r - leg, f.r, f.z0, z1);
}

export const column: KindDef = {
  kind: "column",
  structural: true,
  plan() {},
  elevation: guardsFront,
  elevationSide: guardsFront,
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    p.box("concrete", -W + GUARD_T, W - GUARD_T, 0, s.h, -D + GUARD_T, D - GUARD_T);
    const top = Math.min(GUARD, s.h);
    const leg = Math.min(GUARD_LEG, s.w / 3, s.d / 3);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // An angle around the corner: one leg on each face.
        const x0 = sx > 0 ? W - leg : -W;
        const z0 = sz > 0 ? D - GUARD_T : -D;
        p.box("steel", x0, x0 + leg, 0, top, z0, z0 + GUARD_T);
        const x1 = sx > 0 ? W - GUARD_T : -W;
        const z1 = sz > 0 ? D - leg : -D;
        p.box("steel", x1, x1 + GUARD_T, 0, top, z1, z1 + leg);
      }
    }
  },
};

/** Elevation: the sleeve at the foot and two lines that show the round shaft. */
function roundFront(f: Front) {
  const z1 = f.z0 + Math.min(GUARD * 1000, f.item.height);
  f.box("detail", f.l, f.r, f.z0, z1);
  for (const x of [f.l + f.w * 0.15, f.r - f.w * 0.15]) f.line("detail", [x, z1], [x, f.top]);
}

export const columnRound: KindDef = {
  kind: "columnRound",
  structural: true,
  // Drawn and filled as a circle (an ellipse when resized unevenly), like the 3D model. The plan
  // check keeps the square footprint: a little safer around the column, and simpler.
  planOutline(w, d) {
    const out: Vec2[] = [];
    for (let i = 0; i < ROUND_SEGMENTS; i++) {
      const a = (i / ROUND_SEGMENTS) * 2 * Math.PI;
      out.push({ x: (w / 2) * Math.cos(a), y: (d / 2) * Math.sin(a) });
    }
    return out;
  },
  plan() {},
  elevation: roundFront,
  elevationSide: roundFront,
  mesh(p, s) {
    // The unit cylinder stretched to the footprint, so a resized column becomes an oval.
    const core = p.cyl("concrete", 0, 0, 0, s.h, s.w / 2 - GUARD_T);
    core.scale.z = s.d - 2 * GUARD_T;
    const sleeve = p.cyl("steel", 0, 0, 0, Math.min(GUARD, s.h), s.w / 2);
    sleeve.scale.z = s.d;
  },
};
