// Exhaust shaft (Abluftschacht): a walled shaft of the building from the floor to the ceiling,
// which the exhaust ducts of the hoods lead into; drawn like a wall, crossed out as a shaft, with
// a grille high on its front.

import { INSET } from "../parts/elevation";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";

/** Grille on the front: lower edge under the top, height and share of the width (m). */
const GRILLE_FROM_TOP = 0.6;
const GRILLE_H = 0.3;
const GRILLE_SHARE = 0.6;
const SLATS = 4;

export const ventShaft: KindDef = {
  kind: "ventShaft",
  structural: true,
  plan(s) {
    cross(s, "detail");
  },
  elevation(f) {
    const { l, r, top } = f;
    const cx = (l + r) / 2;
    const gw = (f.w * GRILLE_SHARE) / 2;
    const z0 = Math.max(f.z0 + INSET, top - GRILLE_FROM_TOP * 1000);
    const z1 = Math.min(top - INSET, z0 + GRILLE_H * 1000);
    if (z1 <= z0) return;
    f.box("detail", cx - gw, cx + gw, z0, z1);
    for (let i = 1; i <= SLATS; i++) {
      const z = z0 + ((z1 - z0) * i) / (SLATS + 1);
      f.line("detail", [cx - gw, z], [cx + gw, z]);
    }
  },
  mesh(p, s) {
    const { w, d, h } = s;
    p.box("concrete", -w / 2, w / 2, 0, h, -d / 2, d / 2 - 0.006);
    const gw = (w * GRILLE_SHARE) / 2;
    const y0 = Math.max(0.05, h - GRILLE_FROM_TOP);
    const y1 = Math.min(h - 0.05, y0 + GRILLE_H);
    if (y1 <= y0) return;
    p.box("steelDark", -gw, gw, y0, y1, d / 2 - 0.006, d / 2 - 0.003);
    for (let i = 1; i <= SLATS; i++) {
      const y = y0 + ((y1 - y0) * i) / (SLATS + 1);
      p.box("steel", -gw + 0.01, gw - 0.01, y - 0.01, y + 0.01, d / 2 - 0.003, d / 2);
    }
  },
};
