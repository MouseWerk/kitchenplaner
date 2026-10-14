// Condensing hood (Kondensationshaube): a small hood set on top of a combi oven, reaching over
// its door; the fan and condenser box sits on the back part, the filter in the underside and
// the controls on the front skirt.

import { INSET } from "../parts/elevation";
import { GAP, SHEET } from "../parts/mesh";
import { INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Height of the canopy part (share of the unit's height); the fan box takes the rest. */
const CANOPY_SHARE = 0.55;
/** Depth of the fan box (share of the depth) and its louvre slats. */
const BOX_SHARE = 0.7;
const LOUVRES = 3;

export const condensingHood: KindDef = {
  kind: "condensingHood",
  placement: "overhead",
  plan(s) {
    // The fan box over the back part, the filter in the canopy.
    const yb = s.B + s.d * BOX_SHARE;
    s.rect("overhead", s.L + PLAN_INSET, s.B + PLAN_INSET / 2, s.R - PLAN_INSET, yb);
    s.rect("overhead", s.L + PLAN_INSET * 2, s.B + PLAN_INSET * 2, s.R - PLAN_INSET * 2, s.F - PLAN_INSET * 3);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const zc = z0 + f.item.height * CANOPY_SHARE;
    f.line("detail", [l, zc], [r, zc]);
    for (let i = 1; i <= LOUVRES; i++) {
      const z = zc + ((top - zc) * i) / (LOUVRES + 1);
      f.line("detail", [l + INSET * 2, z], [r - INSET * 2, z]);
    }
    // Control panel at the right of the skirt.
    f.box("detail", r - INSET * 5, r - INSET, z0 + INSET / 2, zc - INSET / 2, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const hc = h * CANOPY_SHARE;
    // Canopy: top and skirts, open below.
    p.box("steel", -w / 2, w / 2, hc - SHEET, hc, -d / 2, d / 2);
    p.box("steel", -w / 2, w / 2, 0, hc, d / 2 - SHEET, d / 2);
    p.box("steel", -w / 2, w / 2, 0, hc, -d / 2, -d / 2 + SHEET);
    p.box("steel", -w / 2, -w / 2 + SHEET, 0, hc, -d / 2, d / 2);
    p.box("steel", w / 2 - SHEET, w / 2, 0, hc, -d / 2, d / 2);
    // Filter in the underside and the condensate gutter along the front.
    p.box("steelDark", -w / 2 + 0.08, w / 2 - 0.08, hc - 0.04, hc - SHEET, -d / 2 + 0.08, d / 2 - 0.12);
    for (const t of [0.25, 0.5, 0.75]) {
      const x = -w / 2 + 0.08 + (w - 0.16) * t;
      p.box("steel", x - 0.005, x + 0.005, hc - 0.046, hc - 0.04, -d / 2 + 0.09, d / 2 - 0.13);
    }
    p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, 0, 0.03, d / 2 - SHEET - 0.04, d / 2 - SHEET);
    // Fan and condenser box with louvres on its front.
    const zb = -d / 2 + d * BOX_SHARE;
    p.box("steel", -w / 2 + 0.03, w / 2 - 0.03, hc, h, -d / 2 + 0.02, zb);
    for (let i = 1; i <= LOUVRES; i++) {
      const y = hc + ((h - hc) * i) / (LOUVRES + 1);
      p.box("steelDark", -w / 2 + 0.08, w / 2 - 0.08, y - 0.008, y + 0.008, zb, zb + 0.004);
    }
    // Controls on the front skirt: display and two keys.
    const cx = w / 2 - 0.14;
    p.box("panelDark", cx - 0.1, cx + 0.1, 0.04, hc - 0.04, d / 2 - SHEET - GAP, d / 2 - SHEET + 0.006);
    p.box("glassDark", cx - 0.08, cx + 0.01, hc / 2 - 0.02, hc / 2 + 0.02, d / 2 - SHEET + 0.006, d / 2 - SHEET + 0.008);
    for (const dx of [0.04, 0.075]) p.box("handle", cx + dx - 0.012, cx + dx + 0.012, hc / 2 - 0.012, hc / 2 + 0.012, d / 2 - SHEET + 0.006, d / 2);
  },
};
