// Condensing hood (Kondensationshaube): a small hood set on top of a combi oven, reaching over
// its door; the fan and condenser box sits on the back part with its exhaust louvre, the filter
// with its baffles in the underside of the canopy, the condensate gutter along the front and the
// controls on the front skirt.

import { INSET } from "../parts/elevation";
import { SHEET, type Point2 } from "../parts/mesh";
import { INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { controlBox, levelSlots, PRESSED, slotRows } from "./common";

/** Height of the canopy part (share of the unit's height); the fan box takes the rest. */
const CANOPY_SHARE = 0.55;
/** Depth of the fan box (share of the depth) and its louvre slots. */
const BOX_SHARE = 0.7;
const LOUVRES = 3;
/** Radius of the canopy's rolled lower edge (m). */
const ROLL = 0.006;
/** Margin of the filter from the canopy's sides (m) and its baffles. */
const FILTER_MARGIN = 0.07;
const BAFFLES = 5;

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
    const t = SHEET;
    // The canopy: four skirts with a rolled lower edge, turned round the outline with round
    // corners, and its top sheet.
    const skirt: Point2[] = [
      [0, 0],
      [t + ROLL, 0],
      [t + ROLL, ROLL * 1.5],
      [t, ROLL * 2.5],
      [t, hc],
      [0, hc],
      [0, 0],
    ];
    p.lathe("steel", 0, 0, 0, skirt, { rect: [w / 2 - t - ROLL, d / 2 - t - ROLL] });
    p.roundedBox("steel", -w / 2 + 0.002, w / 2 - 0.002, hc - t, hc, -d / 2 + 0.002, d / 2 - 0.002, PRESSED / 2, "top");
    // The filter in the underside: a dark frame with baffles, and the condensate gutter along the
    // front with its drain stub at the right.
    const fx0 = -w / 2 + FILTER_MARGIN;
    const fx1 = w / 2 - FILTER_MARGIN;
    const fz0 = -d / 2 + FILTER_MARGIN;
    const fz1 = d / 2 - FILTER_MARGIN - 0.05;
    p.roundedBox("steelDark", fx0, fx1, hc - 0.05, hc - t, fz0, fz1, 0.004);
    levelSlots(p, fx0 + 0.02, fx1 - 0.02, fz0 + 0.02, fz1 - 0.02, hc - 0.05, BAFFLES * 2, 0.012);
    for (let i = 1; i <= BAFFLES; i++) {
      const x = fx0 + ((fx1 - fx0) * i) / (BAFFLES + 1);
      p.roundedBox("satin", x - 0.012, x + 0.012, hc - 0.058, hc - 0.05, fz0 + 0.015, fz1 - 0.015, 0.004, "all", "z");
    }
    p.pan("steelDark", -w / 2 + t + ROLL + 0.002, w / 2 - t - ROLL - 0.002, 0.01, 0.045, d / 2 - t - ROLL - 0.05, d / 2 - t - ROLL - 0.002, { wall: 0.002, r: 0.01 });
    p.lathe("satin", w / 2 - t - ROLL - 0.04, 0.0, d / 2 - t - ROLL - 0.026, [
      [0, 0],
      [0.008, 0],
      [0.008, 0.012],
      [0.012, 0.014],
      [0.012, 0.02],
      [0, 0.02],
    ]);
    // Fan and condenser box: pressed, with the exhaust louvre on its front and the fan's grille
    // on its top.
    const zb = -d / 2 + d * BOX_SHARE;
    const bx = w / 2 - 0.03;
    p.roundedBox("steel", -bx, bx, hc - 0.002, h, -d / 2 + 0.02, zb, PRESSED, "top");
    slotRows(p, -bx + 0.06, bx - 0.06, hc + (h - hc) * 0.2, h - (h - hc) * 0.2, zb, LOUVRES);
    const gr = Math.min(0.12, (zb + d / 2) / 2 - 0.05, bx - 0.05);
    const gz = (zb - d / 2 + 0.02) / 2;
    p.lathe("steelDark", 0, h - 0.001, gz, [
      [0, 0],
      [gr, 0],
      [gr, 0.001],
      [0, 0.001],
    ]);
    for (let k = 1; k <= 3; k++) {
      p.lathe(
        "slot",
        0,
        h - 0.001,
        gz,
        [
          [gr * (k / 4) - 0.004, 0],
          [gr * (k / 4) + 0.004, 0],
          [gr * (k / 4) + 0.004, 0.001],
          [gr * (k / 4) - 0.004, 0.001],
          [gr * (k / 4) - 0.004, 0],
        ],
      );
    }
    // Controls on the front skirt: display, keys and pilot lamp in a dark panel.
    const cx = w / 2 - 0.14;
    controlBox(p, cx - 0.1, cx + 0.1, 0.035, hc - 0.035, d / 2 - t - ROLL - 0.0005, d / 2);
  },
};
