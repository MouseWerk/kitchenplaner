// Mobile salad bar (Salatbar, fahrbar): a cooled well with two rows of GN 1/2 pans, served from
// both long sides under a glass roof on central posts; panelled body on castors.

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { LEG, SHEET, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, castors, castorsFront, holesOf, planWells, wellPans, wellRow, type Rect } from "./common";

/** Height of the glass roof over the top (mm). */
const ROOF_RISE = 450;
/** GN 1/2 pan across the row (mm) and the web between the two rows. */
const GN_HALF = 265;
const ROW_GAP = 40;
/** Depth of the glass roof (share of the unit's depth). */
const ROOF_SHARE = 0.7;

function wells(width: number, depth: number): Rect[] {
  const span = Math.min(GN_HALF, (depth - ROW_GAP) / 2 - INSET * 2);
  return [...wellRow(width, -ROW_GAP / 2 - span, -ROW_GAP / 2), ...wellRow(width, ROW_GAP / 2, ROW_GAP / 2 + span)];
}

export const saladBar: KindDef = {
  kind: "saladBar",
  rise: ROOF_RISE,
  plan(s) {
    planWells(s, wells(s.w, s.d));
    const rd = (s.d * ROOF_SHARE) / 2;
    s.rect("hidden", s.L + INSET / 2, -rd, s.R - INSET / 2, rd);
  },
  elevation(f) {
    const { l, r, top } = f;
    const I = FRONT_INSET;
    castorsFront(f);
    f.worktop();
    f.box("detail", l + I, r - I, f.z0 + CASTOR.h * 1000 + I, top - FRONT_TOP - I, "item-dark");
    f.line("detail", [(l + r) / 2, top], [(l + r) / 2, top + ROOF_RISE]);
    f.line("detail", [l + I, top + ROOF_RISE - 10], [r - I, top + ROOF_RISE - 10]);
    f.box("detail", l + I, r - I, top + ROOF_RISE - 40, top + ROOF_RISE, "glass");
  },
  mesh(p, s, item) {
    const holes = holesOf(wells(item.width, item.depth));
    castors(p, s.w, s.d);
    // Panelled body on a steel frame, the cooled well in the top.
    const y0 = CASTOR.h;
    const yb = s.h - 0.2 - SHEET;
    p.box("steel", -s.w / 2, s.w / 2, y0, y0 + 0.04, -s.d / 2, s.d / 2);
    p.box("panelDark", -s.w / 2 + SHEET, s.w / 2 - SHEET, y0 + 0.04, yb, -s.d / 2 + SHEET, s.d / 2 - SHEET);
    for (const z of [-s.d / 2, s.d / 2 - SHEET]) p.box("panelDark", -s.w / 2 + SHEET, s.w / 2 - SHEET, yb, s.h - TOP, z, z + SHEET);
    for (const x of [-s.w / 2, s.w / 2 - SHEET]) p.box("panelDark", x, x + SHEET, y0 + 0.04, s.h - TOP, -s.d / 2, s.d / 2);
    p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, holes);
    // The web between the two rows, which the cut-out top leaves open.
    p.box("steel", -s.w / 2, s.w / 2, s.h - TOP, s.h, -ROW_GAP / 2000, ROW_GAP / 2000);
    wellPans(p, holes, s.h, ["panel", "zone", "oil", "panel", "plate"]);
    // Glass roof on two central posts.
    const rise = ROOF_RISE / 1000;
    const rd = (s.d * ROOF_SHARE) / 2;
    for (const x of [-s.w / 2 + LEG, s.w / 2 - LEG]) {
      p.rod("handle", "y", x, s.h + (rise - 0.01) / 2, 0, rise - 0.01, 0.015);
      p.box("handle", x - 0.008, x + 0.008, s.h + rise - 0.035, s.h + rise - 0.01, -rd, rd);
    }
    p.box("handle", -s.w / 2 + LEG, s.w / 2 - LEG, s.h + rise - 0.035, s.h + rise - 0.01, -0.01, 0.01);
    p.box("glass", -s.w / 2 + 0.02, s.w / 2 - 0.02, s.h + rise - 0.01, s.h + rise, -rd, rd);
  },
};
