// Soup station (Suppenstation): round soup kettles in heated wells with hinged lids and a ladle,
// a thermostat knob per kettle on the front and a cupboard below.

import { doorCount, FEET, INSET as FRONT_INSET, PANEL, TOP as FRONT_TOP } from "../parts/elevation";
import { CONTROLS, DOOR, DOOR_WIDTH, GAP, PLINTH, SHEET, TOP, type Hole, type Parts } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip } from "../parts/plan";
import type { KindDef } from "../types";
import { controlPanel, counterBody, leafDoors, WELL_DEPTH } from "./common";

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
    // Round wells, each holding a kettle.
    const holes: Hole[] = xs.map((x) => ({ x0: x - r - 0.01, x1: x + r + 0.01, z0: zc - r - 0.01, z1: zc + r + 0.01, r: r + 0.01 }));
    const zBody = s.d / 2 - DOOR;
    counterBody(p, s, holes, "steel", zBody);
    for (const [i, x] of xs.entries()) {
      const hl = holes[i];
      p.tub("steelDark", hl.x0, hl.x1, s.h - WELL_DEPTH, s.h - 0.001, hl.z0, hl.z1, SHEET / 2, r + 0.01);
      kettle(p, x, s.h - WELL_DEPTH + 0.02, zc, r, s.h + RIM / 1000);
    }
    const yc = s.h - TOP - CONTROLS;
    controlPanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, yc + GAP, s.h - TOP - GAP, zBody, s.d / 2, { knobs: xs.length, pilots: true });
    leafDoors(p, -s.w / 2, s.w / 2, PLINTH, yc, zBody, s.d / 2 - DOOR / 2, s.d / 2, Math.max(1, Math.round(s.w / DOOR_WIDTH)));
  },
};

/**
 * A soup kettle insert standing in its well at (x, y0, z) up to its rolled rim at `yRim`: the
 * pot, the domed lid with a turned knob and a notch for the ladle, its handle resting in the
 * notch.
 */
export function kettle(p: Parts, x: number, y0: number, z: number, r: number, yRim: number): void {
  const h = yRim - y0;
  p.lathe("steel", x, y0, z, [
    [0, 0],
    [r * 0.9, 0],
    [r * 0.97, 0.01],
    [r, 0.03],
    [r, h - 0.008],
    [r + 0.006, h - 0.004],
    [r + 0.004, h],
    [r - 0.002, h],
    [r - 0.002, h - 0.01],
    [0, h - 0.01],
  ]);
  const lid = LID / 1000;
  p.lathe("steel", x, yRim - 0.002, z, [
    [0, 0],
    [r * 0.99, 0],
    [r * 0.99, 0.004],
    [r * 0.9, lid * 0.6],
    [r * 0.5, lid],
    [0, lid],
  ]);
  const knob = LID_KNOB / 1000;
  p.lathe("knob", x, yRim - 0.002 + lid - 0.001, z, [
    [0, 0],
    [0.012, 0],
    [0.008, knob * 0.4],
    [0.016, knob * 0.75],
    [0.016, knob * 0.9],
    [0.012, knob],
    [0, knob],
  ]);
  // The ladle's handle out of the lid's notch towards the front right.
  p.box("slot", x + r * 0.55, x + r * 0.95, yRim + 0.002, yRim + 0.003, z + r * 0.45, z + r * 0.55);
  p.tube(
    "handle",
    [
      { x: x + r * 0.75, y: yRim + 0.004, z: z + r * 0.5 },
      { x: x + r * 0.9, y: yRim + 0.012, z: z + r * 0.5 },
      { x: x + r * 1.02, y: yRim + 0.04, z: z + r * 0.5 },
    ],
    0.005,
    { bend: 0.02 },
  );
}
