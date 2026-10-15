// Hot food counter (Speisenausgabe, Bain-Marie): heated Gastronorm wells in the top, a sneeze
// guard on the guest side (the back), the control panel and a cupboard on the staff side (the
// front).

import { doorCount, FEET, INSET as FRONT_INSET, PANEL, TOP as FRONT_TOP } from "../parts/elevation";
import { CONTROLS, DOOR, DOOR_WIDTH, GAP, PLINTH, TOP } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { controlPanel, counterBody, GN_LONG, holesOf, leafDoors, planWells, ratingPlate, sneezeGuard, sneezeGuardFront, wellCount, wellPans, wellRow } from "./common";

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
    const zBody = s.d / 2 - DOOR;
    counterBody(p, s, holes, "steel", zBody);
    wellPans(p, holes, s.h, ["foodBrown", "foodCream", "foodRed", "foodGreen"], true, true);
    // A thermostat knob and pilot lamp per well on the control panel under the top.
    const yc = s.h - TOP - CONTROLS;
    controlPanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, yc + GAP, s.h - TOP - GAP, zBody, s.d / 2, { knobs: holes.length, pilots: true, rocker: true });
    leafDoors(p, -s.w / 2, s.w / 2, PLINTH, yc, zBody, s.d / 2 - DOOR / 2, s.d / 2, Math.max(1, Math.round(s.w / DOOR_WIDTH)));
    ratingPlate(p, -s.w / 2 + 0.08, PLINTH + 0.06, s.d / 2 - DOOR / 2);
    sneezeGuard(p, s.w, s.h, GUARD_RISE / 1000, { zPost: -s.d / 2 + 0.03, z0: -s.d / 2 + GAP, z1: -s.d / 2 + GUARD_SHELF, light: "heat" });
  },
};
