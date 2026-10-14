// Wall-mounted pre-rinse unit (Wandbrause): the pre-rinse shower on its own, fixed to the wall
// over a sink or a dish table that has none. It hangs from the top of the table to the top of
// its riser, so it only collides with other wall-mounted units.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { SHEET } from "../parts/mesh";
import type { KindDef } from "../types";
import { preRinseFront, preRinsePlan, preRinseShower, showerReachTo } from "./common";

/** The wall plate behind the riser (m). */
const PLATE = 0.12;

export const preRinseUnit: KindDef = {
  kind: "preRinseUnit",
  placement: "overhead",
  plan(s) {
    preRinsePlan(s, 0);
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    preRinseFront(f, c + 60, f.z0, f.item.height);
    f.box("detail", c - PLATE * 500, c + PLATE * 500, f.top - 260, f.top - 200);
    f.box("detail", c - FRONT_INSET, c + FRONT_INSET, f.z0, f.z0 + FRONT_INSET);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    // Wall plates for the water connections below and the bracket above.
    p.box("steel", -PLATE / 2, PLATE / 2, 0, 0.06, zb, zb + SHEET);
    p.box("steel", -PLATE / 2, PLATE / 2, s.h - 0.24, s.h - 0.14, zb, zb + SHEET);
    // The gooseneck reaches so far that the spray head ends at the front of the footprint.
    preRinseShower(p, 0, zb, 0, s.h, showerReachTo(zb, s.d / 2));
    // The open ends of the footprint: a thin wall rail so the unit fills its width.
    p.box("steelDark", -s.w / 2, s.w / 2, s.h - 0.2, s.h - 0.19, zb, zb + SHEET);
  },
};
