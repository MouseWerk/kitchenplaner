// Ventilation duct (Lüftungskanal): a rectangular galvanised duct under the ceiling, joined by
// flanges about every metre.

import { BODY_RADIUS } from "../parts/mesh";
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
    const hy = s.h / 2 - FLANGE;
    const hz = s.d / 2 - FLANGE;
    p.roundedBox("steelDark", -s.w / 2 + 0.001, s.w / 2 - 0.001, FLANGE, s.h - FLANGE, -hz, hz, BODY_RADIUS, "all", "x");
    // The flanges: a band of angle round the duct at every joint, turned round its section.
    for (const x of flanges(s.w)) {
      p.lathe("satin", x - FLANGE_L / 2, s.h / 2, 0, [
        [0, 0],
        [FLANGE, 0],
        [FLANGE, FLANGE_L],
        [0, FLANGE_L],
        [0, 0],
      ], { axis: "x", rect: [hy, hz] });
    }
  },
};
