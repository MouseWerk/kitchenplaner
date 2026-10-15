// Wall-mounted pre-rinse unit (Wandbrause): the pre-rinse shower on its own, fixed to the wall
// over a sink or a dish table that has none. It hangs from the top of the table to the top of
// its riser, so it only collides with other wall-mounted units.

import { SHEET } from "../parts/mesh";
import type { KindDef } from "../types";
import { preRinseFront, preRinsePlan, preRinseShower, showerReachTo } from "./common";

/** The bracket plate behind the riser (m). */
const PLATE = 0.12;
/** Height of the wall plate with the water connections at the bottom (m). */
const CONNECTIONS = 0.06;

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
    f.box("detail", f.l, f.r, f.z0, f.z0 + CONNECTIONS * 1000);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    // The wall plate with the water connections across the unit's width at the bottom, and the
    // small bracket that holds the riser at the top.
    p.box("steel", -s.w / 2, s.w / 2, 0, CONNECTIONS, zb, zb + SHEET);
    for (const sx of [-1, 1]) p.cyl("steelDark", (sx * s.w) / 4, zb + SHEET * 2, 0.015, CONNECTIONS - 0.015, 0.012);
    p.box("steel", -PLATE / 2, PLATE / 2, s.h - 0.24, s.h - 0.14, zb, zb + SHEET);
    // The gooseneck reaches so far that the spray head ends at the front of the footprint.
    preRinseShower(p, 0, zb, 0, s.h, showerReachTo(zb, s.d / 2));
  },
};
