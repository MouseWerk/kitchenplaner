// Mobile salad bar (Salatbar, fahrbar): a cooled well with two rows of GN 1/2 pans, served from
// both long sides under a glass roof on a post at either end; panelled body on castors.

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { BODY_RADIUS, LEG, SHEET, TOP, wirePositions } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bumper, CASTOR, castors, castorsFront, holesOf, planWells, seam, wellPans, wellRow, type Rect } from "./common";
import { ventSlots } from "../parts/details";

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
    // The glass roof on a post at either end.
    for (const x of [l + LEG * 1000, r - LEG * 1000]) f.box("detail", x - 15, x + 15, top, top + ROOF_RISE - 35);
    f.line("detail", [l + I, top + ROOF_RISE - 10], [r - I, top + ROOF_RISE - 10]);
    f.box("detail", l + I, r - I, top + ROOF_RISE - 40, top + ROOF_RISE, "glass");
  },
  elevationSide(f) {
    // Seen from the end: the post in the middle of the depth and the roof across it.
    const { l, r, top } = f;
    const c = (l + r) / 2;
    const rd = (f.w * ROOF_SHARE) / 2;
    castorsFront(f);
    f.worktop();
    f.box("detail", c - 15, c + 15, top, top + ROOF_RISE - 35);
    f.box("detail", c - rd, c + rd, top + ROOF_RISE - 10, top + ROOF_RISE, "glass");
  },
  mesh(p, s, item) {
    const holes = holesOf(wells(item.width, item.depth));
    castors(p, s.w, s.d);
    // Panelled body on a steel frame with a bumper, the cooled well in the top; the machine's
    // louvre at the right of the front.
    const y0 = CASTOR.h;
    const yb = s.h - 0.2 - SHEET;
    bumper(p, -s.w / 2, s.w / 2, y0, y0 + 0.04, -s.d / 2, s.d / 2);
    p.roundedBox("panelDark", -s.w / 2 + SHEET, s.w / 2 - SHEET, y0 + 0.04, yb, -s.d / 2 + SHEET, s.d / 2 - SHEET, BODY_RADIUS * 4, "vertical");
    for (const z of [-s.d / 2 + SHEET, s.d / 2 - SHEET * 2]) p.box("panelDark", -s.w / 2 + SHEET * 2, s.w / 2 - SHEET * 2, yb - 0.001, s.h - TOP, z, z + SHEET);
    for (const x of [-s.w / 2 + SHEET, s.w / 2 - SHEET * 2]) p.box("panelDark", x, x + SHEET, yb - 0.001, s.h - TOP, -s.d / 2 + SHEET, s.d / 2 - SHEET);
    // Panel joints on both long sides.
    for (const [z, dir] of [
      [s.d / 2 - SHEET, 1],
      [-s.d / 2 + SHEET, -1],
    ] as const) {
      for (const x of wirePositions(-s.w / 2, s.w / 2, 0.5)) seam(p, "y", y0 + 0.05, s.h - TOP - 0.01, x, z, dir);
    }
    ventSlots(p, s.w / 2 - 0.3, s.w / 2 - 0.08, y0 + 0.08, y0 + 0.24, s.d / 2 - SHEET, 4);
    p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, holes);
    // The web between the two rows, which the cut-out top leaves open.
    p.roundedBox("steel", -s.w / 2 + 0.003, s.w / 2 - 0.003, s.h - TOP, s.h - 0.0005, -ROW_GAP / 2000, ROW_GAP / 2000, 0.002);
    wellPans(p, holes, s.h, ["foodGreen", "foodRed", "foodCream", "foodGreen", "foodBrown"], false);
    // Glass roof on a turned post at either end, in the middle of the depth, the light strip
    // under its ridge.
    const rise = ROOF_RISE / 1000;
    const rd = (s.d * ROOF_SHARE) / 2;
    const yr = s.h + rise - 0.01;
    for (const x of [-s.w / 2 + LEG, s.w / 2 - LEG]) {
      p.lathe("handle", x, s.h, 0, [
        [0, 0],
        [0.03, 0],
        [0.03, 0.004],
        [0.018, 0.014],
        [0.015, 0.02],
        [0.015, yr - 0.03 - s.h],
        [0, yr - 0.03 - s.h],
      ]);
      p.roundedBox("handle", x - 0.008, x + 0.008, yr - 0.03, yr, -rd + 0.02, rd - 0.02, 0.004, "all", "z");
    }
    p.roundedBox("satin", -s.w / 2 + LEG, s.w / 2 - LEG, yr - 0.035, yr, -0.025, 0.025, 0.01, "all", "x");
    p.roundedBox("panel", -s.w / 2 + LEG + 0.05, s.w / 2 - LEG - 0.05, yr - 0.037, yr - 0.034, -0.012, 0.012, 0.005, "vertical");
    p.roundedBox("glass", -s.w / 2 + 0.02, s.w / 2 - 0.02, yr, yr + 0.01, -rd, rd, 0.003, "vertical");
  },
};
