// Soup station (Suppenstation): round soup kettles in heated wells with hinged lids and a ladle,
// a thermostat knob per kettle on the front and a cupboard below.

import { doorCount, FEET, INSET as FRONT_INSET, PANEL, TOP as FRONT_TOP } from "../parts/elevation";
import { CONTROLS, controlKnobs, DOOR, DOOR_WIDTH, doors, GAP, HANDLE, PLINTH, TOP, type Hole } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, WELL_DEPTH } from "./common";

/** Width taken by one kettle along the counter (mm), the kettle's radius (mm). */
const KETTLE_PITCH = 400;
const KETTLE_R = 150;
/** How far the kettle's rim, lid and knob stand over the top (mm). */
const RIM = 60;
const LID = 15;
const LID_KNOB = 35;

/** Centres of the kettles along the width (mm). */
export function kettleXs(width: number): number[] {
  const n = Math.max(1, Math.floor(width / KETTLE_PITCH));
  const pitch = width / n;
  return Array.from({ length: n }, (_, i) => -width / 2 + pitch * (i + 0.5));
}

/** Centre of the kettles across the depth (mm): the middle of the area behind the controls. */
const KETTLE_Y = -CONTROL_STRIP / 2;

export const soupStation: KindDef = {
  kind: "soupStation",
  rise: RIM + LID + LID_KNOB,
  plan(s) {
    const r = Math.min(KETTLE_R, s.w / kettleXs(s.w).length / 2 - 20, (s.d - CONTROL_STRIP) / 2 - 20);
    for (const x of kettleXs(s.w)) {
      s.circle("detail", x, KETTLE_Y, r);
      s.circle("detail", x, KETTLE_Y, r * 0.2);
    }
    controlStrip(s);
  },
  elevation(f) {
    const { l, r, top } = f;
    const xs = kettleXs(f.item.width);
    f.worktop();
    f.panel(top - FRONT_TOP - PANEL, top - FRONT_TOP, xs.length);
    f.doors(doorCount(f.w), f.z0 + FEET, top - FRONT_TOP - PANEL - FRONT_INSET);
    const scale = f.w / f.item.width;
    const kr = Math.min(KETTLE_R, f.item.width / xs.length / 2 - 20) * scale;
    for (const x0 of xs) {
      const x = (l + r) / 2 + x0 * scale;
      f.box("detail", x - kr, x + kr, top, top + RIM);
      f.box("detail", x - kr * 0.95, x + kr * 0.95, top + RIM, top + RIM + LID);
      f.box("detail", x - 15, x + 15, top + RIM + LID, top + RIM + LID + LID_KNOB);
    }
  },
  mesh(p, s, item) {
    const xs = kettleXs(item.width).map((x) => x / 1000);
    const zc = KETTLE_Y / 1000;
    const r = Math.min(KETTLE_R / 1000, s.w / xs.length / 2 - 0.02, (s.d - CONTROL_STRIP / 1000) / 2 - 0.02);
    const holes: Hole[] = xs.map((x) => ({ x0: x - r - 0.01, x1: x + r + 0.01, z0: zc - r - 0.01, z1: zc + r + 0.01 }));
    counterBody(p, s, holes);
    const rim = RIM / 1000;
    for (const [i, x] of xs.entries()) {
      const hl = holes[i];
      p.tub("steel", hl.x0, hl.x1, s.h - WELL_DEPTH, s.h, hl.z0, hl.z1);
      // The kettle, its rolled rim and the lid with a knob.
      p.cyl("steel", x, zc, s.h - WELL_DEPTH + 0.02, s.h + rim, r);
      p.cyl("handle", x, zc, s.h + rim - 0.008, s.h + rim, r + 0.006);
      p.cyl("steel", x, zc, s.h + rim, s.h + rim + LID / 1000, r * 0.96);
      p.cyl("knob", x, zc, s.h + rim + LID / 1000, s.h + rim + (LID + LID_KNOB) / 1000, 0.015);
      // Ladle handle resting in the notch of the lid.
      p.rod("handle", "x", x + r * 0.6, s.h + rim + LID / 1000 + 0.006, zc + r * 0.7, r * 0.8, 0.006);
    }
    const yc = s.h - TOP - CONTROLS;
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, yc, s.h - TOP - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
    controlKnobs(p, s.w, (yc + s.h - TOP) / 2, s.d / 2 - HANDLE, s.d / 2, xs.length);
    doors(p, -s.w / 2, s.w / 2, PLINTH, yc, s.d, Math.max(1, Math.round(s.w / DOOR_WIDTH)), "vertical");
  },
};
