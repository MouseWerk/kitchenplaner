// Hot food counter (Speisenausgabe, Bain-Marie): heated Gastronorm wells in the top, a sneeze
// guard on the guest side (the back), the controls and a cupboard on the staff side (the front).

import { doorCount, FEET, INSET as FRONT_INSET, PANEL, TOP as FRONT_TOP } from "../parts/elevation";
import { CONTROLS, controlKnobs, DOOR, DOOR_WIDTH, doors, GAP, HANDLE, PLINTH, TOP } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, GN_LONG, holesOf, planWells, sneezeGuard, sneezeGuardFront, wellCount, wellPans, wellRow } from "./common";

/** Height of the sneeze guard over the top (mm). */
export const GUARD_RISE = 450;
/** Space between the back edge and the wells, where the guard stands (mm). */
const GUARD_SPACE = 100;
/** Depth of the guard's glass shelf (m). */
const GUARD_SHELF = 0.3;

/** The wells of a food counter: one row of crosswise GN 1/1 behind the control strip. */
function wells(width: number, depth: number) {
  const y0 = -depth / 2 + GUARD_SPACE;
  return wellRow(width, y0, Math.min(y0 + GN_LONG, depth / 2 - CONTROL_STRIP + INSET));
}

export const foodCounter: KindDef = {
  kind: "foodCounter",
  rise: GUARD_RISE,
  plan(s) {
    planWells(s, wells(s.w, s.d));
    s.line("hidden", [s.L + INSET, s.B + INSET / 2], [s.R - INSET, s.B + INSET / 2]);
    controlStrip(s);
  },
  elevation(f) {
    f.worktop();
    f.panel(f.top - FRONT_TOP - PANEL, f.top - FRONT_TOP, wellCount(f.w));
    f.doors(doorCount(f.w), f.z0 + FEET, f.top - FRONT_TOP - PANEL - FRONT_INSET);
    sneezeGuardFront(f, GUARD_RISE);
  },
  mesh(p, s, item) {
    const holes = holesOf(wells(item.width, item.depth));
    counterBody(p, s, holes);
    wellPans(p, holes, s.h, ["foodBrown", "foodCream", "foodRed", "foodGreen"]);
    // One thermostat knob per well on the control strip under the top.
    const yc = s.h - TOP - CONTROLS;
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, yc, s.h - TOP - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
    controlKnobs(p, s.w, (yc + s.h - TOP) / 2, s.d / 2 - HANDLE, s.d / 2, holes.length);
    doors(p, -s.w / 2, s.w / 2, PLINTH, yc, s.d, Math.max(1, Math.round(s.w / DOOR_WIDTH)), "vertical");
    sneezeGuard(p, s.w, s.h, GUARD_RISE / 1000, -s.d / 2 + 0.03, -s.d / 2 + GAP, -s.d / 2 + GUARD_SHELF);
  },
};
