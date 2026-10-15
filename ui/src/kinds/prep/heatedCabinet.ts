// Heated cabinet (Wärmeschrank) as a table base: a work cabinet with sliding doors, heated by a
// fan heater, with the thermostat and a thermometer in a strip under the top.

import { BODY_RADIUS, DOOR, GAP } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, slidingDoors, slidingFront, slidingPlan, tableTop, UPSTAND_RISE } from "./common";
import { displayWindow, pilotLamp } from "./machine";
import { ventSlots } from "../parts/details";

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
    const face = zf - 0.008;
    const ym = (yc + y1) / 2;
    p.roundedBox("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, yc + GAP, y1 - GAP, zf - DOOR, face, BODY_RADIUS, "top", "z");
    // Thermostat dial, thermometer display and the pilot light at the right; the fan heater's
    // intake slots at the left.
    p.knob(s.w / 2 - 0.12, ym, face, zf, 0.02);
    displayWindow(p, s.w / 2 - 0.27, s.w / 2 - 0.17, yc + c * 0.3, y1 - c * 0.3, face);
    pilotLamp(p, s.w / 2 - 0.31, ym, face);
    ventSlots(p, -s.w / 2 + 0.06, -s.w / 2 + 0.06 + Math.min(0.3, s.w * 0.25), yc + c * 0.3, y1 - c * 0.3, face, 3, "x");
    slidingDoors(p, -s.w / 2, s.w / 2, y0, yc, zf);
    tableTop(p, s, { back: true, solid: true });
  },
};
