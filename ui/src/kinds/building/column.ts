// Columns (Stützen): concrete columns of the building, drawn like a wall, square or round. In a
// kitchen their lower part is protected against trolleys: stainless corner guards on a square
// column, a stainless sleeve on a round one.

import type { Vec2 } from "../../model/types";
import type { Front } from "../parts/elevation";
import type { Parts } from "../parts/mesh";
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
/** Radius of the concrete's chamfered edges and of a guard's bend (m). */
const ARRIS = 0.01;
const BEND = 0.004;

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
    p.roundedBox("concrete", -W + GUARD_T, W - GUARD_T, 0, s.h, -D + GUARD_T, D - GUARD_T, ARRIS, "vertical");
    cornerGuards(p, W, D, Math.min(GUARD, s.h), Math.min(GUARD_LEG, s.w / 3, s.d / 3));
  },
};

/**
 * Stainless angles round the four corners of a box of half sizes W × D, from the floor to `top`:
 * each one sheet bent round the corner, its legs `leg` long (m).
 */
export function cornerGuards(p: Parts, W: number, D: number, top: number, leg: number): void {
  const t = GUARD_T;
  const r = BEND;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // The angle in the plan (x, z) for the front right corner, mirrored to the others: outer
      // face round the corner with the bend, back along the inner face.
      const arc = (rad: number) => Array.from({ length: 4 }, (_, k) => {
        const a = (k / 3) * (Math.PI / 2);
        return [W - r + rad * Math.cos(a), D - r + rad * Math.sin(a)] as const;
      });
      const outer = arc(r);
      const inner = arc(r - t).reverse();
      const pts = [[W, D - leg] as const, ...outer, [W - leg, D] as const, [W - leg, D - t] as const, ...inner, [W - t, D - leg] as const].map(([x, z]) => [x * sx, z * sz] as const);
      p.extrude("steel", "y", 0, top, sx * sz > 0 ? pts : [...pts].reverse());
    }
  }
}

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
    const top = Math.min(GUARD, s.h);
    if (Math.abs(s.w - s.d) < 0.001) {
      // A round column: the sleeve turned, its top edge rolled over.
      const r = s.w / 2;
      p.lathe("steel", 0, 0, 0, [[0, 0], [r, 0], [r, top - 0.006], [r - 0.002, top - 0.001], [r - GUARD_T * 2, top], [0, top]]);
    } else {
      const sleeve = p.cyl("steel", 0, 0, 0, top, s.w / 2);
      sleeve.scale.z = s.d;
    }
  },
};

/** Joints of a column's cladding: their height pitch, and the skirting's height (m). */
const PANEL_H = 1.0;
const SKIRT = 0.1;

/** Elevation: the cladding's joints and the skirting. */
function cladFront(f: Front) {
  f.line("detail", [f.l, f.z0 + SKIRT * 1000], [f.r, f.z0 + SKIRT * 1000]);
  for (let y = PANEL_H; y < f.item.height / 1000 - 0.1; y += PANEL_H) f.line("detail", [f.l, f.z0 + y * 1000], [f.r, f.z0 + y * 1000]);
}

/**
 * A column clad in stainless sheet up to the ceiling (Stützenverkleidung): panels with rounded
 * corners and joints every metre, a skirting at the foot.
 */
export const columnClad: KindDef = {
  kind: "columnClad",
  structural: true,
  plan(s) {
    const t = 3;
    s.rect("detail", s.L + t, s.B + t, s.R - t, s.F - t);
  },
  elevation: cladFront,
  elevationSide: cladFront,
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    const r = 0.012;
    // The cladding in storeys of panels, a dark joint between them.
    const n = Math.max(1, Math.round((s.h - SKIRT) / PANEL_H));
    const ph = (s.h - SKIRT) / n;
    for (let i = 0; i < n; i++) {
      const y0 = SKIRT + i * ph;
      p.roundedBox("steel", -W + 0.001, W - 0.001, y0 + 0.0015, y0 + ph - 0.0015, -D + 0.001, D - 0.001, r, "vertical");
    }
    p.roundedBox("concrete", -W + 0.004, W - 0.004, 0, s.h, -D + 0.004, D - 0.004, r, "vertical");
    p.roundedBox("steelDark", -W, W, 0, SKIRT, -D, D, r, "vertical");
  },
};
