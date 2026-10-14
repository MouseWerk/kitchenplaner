// Ventilation duct (Lüftungskanal): a rectangular galvanised duct under the ceiling, joined by
// flanges about every metre.

import { cross } from "../parts/plan";
import type { KindDef } from "../types";

// Sizes (m).
/** How far a flange stands out of the duct, and its length along the duct. */
const FLANGE = 0.015;
const FLANGE_L = 0.02;
/** Usual length of one duct section. */
const SECTION = 1.0;

/** Positions of the flanges along the width (m), the ends included. */
function flanges(w: number): number[] {
  const n = Math.max(1, Math.round(w / SECTION));
  return Array.from({ length: n + 1 }, (_, i) => -w / 2 + FLANGE_L / 2 + ((w - FLANGE_L) * i) / n);
}

export const duct: KindDef = {
  kind: "duct",
  placement: "overhead",
  plan(s) {
    cross(s, "overhead");
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    for (const x of flanges(f.w / 1000)) {
      const xc = c + x * 1000;
      f.line("detail", [xc, f.z0], [xc, f.top]);
    }
  },
  mesh(p, s) {
    p.box("steelDark", -s.w / 2, s.w / 2, FLANGE, s.h - FLANGE, -s.d / 2 + FLANGE, s.d / 2 - FLANGE);
    for (const x of flanges(s.w)) p.box("steel", x - FLANGE_L / 2, x + FLANGE_L / 2, 0, s.h, -s.d / 2, s.d / 2);
  },
};
