// Heated cabinet (Wärmeschrank) as a table base: a work cabinet with sliding doors, heated by a
// fan heater, with the thermostat and a thermometer in a strip under the top.

import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, slidingDoors, slidingFront, slidingPlan, tableTop, UPSTAND_RISE } from "./common";

/** Height of the control strip under the top (mm). */
const CONTROLS = 100;

export const heatedCabinet: KindDef = {
  kind: "heatedCabinet",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
    slidingPlan(s);
  },
  elevation(f) {
    const { z0, z1 } = cabinetFront(f, true);
    const zc = z1 - CONTROLS;
    f.box("detail", f.l, f.r, zc, z1, "item-dark");
    f.circle("detail", f.r - 120, (zc + z1) / 2, CONTROLS * 0.25);
    f.box("detail", f.r - 260, f.r - 180, zc + CONTROLS * 0.3, z1 - CONTROLS * 0.3);
    slidingFront(f, f.l, f.r, z0, zc);
  },
  mesh(p, s) {
    const { y0, y1, zf } = cabinetBody(p, s);
    const c = CONTROLS / 1000;
    const yc = y1 - c;
    p.box("panelDark", -s.w / 2, s.w / 2, yc, y1, zf - 0.02, zf - 0.008);
    // Thermostat dial, thermometer display and the pilot light at the right.
    p.knob(s.w / 2 - 0.12, (yc + y1) / 2, zf - 0.008, zf, 0.02);
    p.box("glassDark", s.w / 2 - 0.26, s.w / 2 - 0.18, yc + c * 0.3, y1 - c * 0.3, zf - 0.008, zf - 0.005);
    p.cyl("handle", s.w / 2 - 0.31, zf - 0.006, (yc + y1) / 2 - 0.006, (yc + y1) / 2 + 0.006, 0.006);
    slidingDoors(p, -s.w / 2, s.w / 2, y0, yc, zf);
    tableTop(p, s, { back: true });
  },
};
