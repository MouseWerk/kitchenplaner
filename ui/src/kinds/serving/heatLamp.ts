// Heat lamp bridge (Wärmebrücke): a flat housing with infrared heating elements and a light strip in
// its underside, hung over a pass on two rods from the ceiling or a gantry.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { pilotLamp, rocker } from "./common";

/** Height of the housing at the bottom of the unit (m); the hanging rods take the rest. */
const HOUSING = 0.09;
/** Heating elements along the housing (two, either side of the light strip). */
const ELEMENTS = 2;
/** Height and width of the rim round the open underside (m). */
const RIM = 0.024;
const RIM_W = 0.018;
/** Depth of the switch standing on the housing's front (m). */
const CONTROL_DEPTH = 0.008;
/** Radius of a quartz heating element (m). */
const ELEMENT_R = 0.009;

export const heatLamp: KindDef = {
  kind: "heatLamp",
  placement: "overhead",
  plan(s) {
    // The heating elements along the bridge, the hangers as small circles.
    for (const y of [-s.d / 4, s.d / 4]) s.line("overhead", [s.L + INSET, y], [s.R - INSET, y]);
    for (const x of [s.L + INSET * 2, s.R - INSET * 2]) s.circle("overhead", x, 0, INSET / 3);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const h = HOUSING * 1000;
    f.line("detail", [l, z0 + h], [r, z0 + h]);
    f.line("detail", [l + I, z0 + I / 2], [r - I, z0 + I / 2]);
    // The hanging rods over the housing.
    for (const x of [l + I * 2, r - I * 2]) f.box("detail", x - 6, x + 6, z0 + h, top);
  },
  elevationSide(f) {
    f.line("detail", [f.l, f.z0 + HOUSING * 1000], [f.r, f.z0 + HOUSING * 1000]);
  },
  mesh(p, s) {
    const hh = Math.min(HOUSING, s.h);
    const { w, d } = s;
    // The housing: a pressed hood, rounded along its length, its rim round the open underside;
    // inside it a satin reflector, the quartz heating elements in their end holders and a light
    // strip between them.
    // The housing stands back from the front by the switch's depth.
    const zf = d / 2 - CONTROL_DEPTH;
    const zc = (zf - d / 2) / 2;
    const hd = (zf + d / 2) / 2;
    p.roundedBox("steel", -w / 2, w / 2, RIM, hh, -d / 2, zf, 0.012, "all", "x");
    p.lathe(
      "steel",
      0,
      0,
      zc,
      [
        [0, 0],
        [RIM_W, 0],
        [RIM_W, RIM + 0.004],
        [0, RIM + 0.004],
        [0, 0],
      ],
      { rect: [w / 2 - RIM_W - 0.001, hd - RIM_W - 0.001] },
    );
    p.box("satin", -w / 2 + RIM_W, w / 2 - RIM_W, RIM - 0.003, RIM + 0.001, zc - hd + RIM_W, zc + hd - RIM_W);
    for (let i = 0; i < ELEMENTS; i++) {
      const z = zc + (i === 0 ? -1 : 1) * (hd / 2);
      p.rod("ceramic", "x", 0, RIM - 0.006 - ELEMENT_R, z, w - 0.1, ELEMENT_R);
      for (const x of [-w / 2 + 0.045, w / 2 - 0.045]) p.roundedBox("knob", x - 0.012, x + 0.012, 0.001, RIM - 0.002, z - ELEMENT_R * 1.6, z + ELEMENT_R * 1.6, 0.003);
    }
    p.box("panel", -w / 2 + 0.06, w / 2 - 0.06, RIM - 0.005, RIM - 0.003, zc - 0.012, zc + 0.012);
    // The switch with its pilot lamp on the front.
    const sx = w / 2 - 0.07;
    p.plate("panelDark", sx - 0.035, sx + 0.035, hh * 0.25, hh * 0.8, zf - 0.001, zf + 0.002, 0.004, true);
    rocker(p, sx - 0.012, hh * 0.52, zf + 0.002, d / 2);
    pilotLamp(p, sx + 0.02, hh * 0.52, zf + 0.002, "oil", 0.004);
    // Hanging rods with their ceiling rosettes.
    if (s.h > hh + 0.02) {
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
        p.rod("handle", "y", x, (hh + s.h) / 2, zc, s.h - hh, 0.006);
        p.lathe("satin", x, hh - 0.002, zc, [
          [0, 0],
          [0.016, 0],
          [0.012, 0.012],
          [0, 0.012],
        ]);
        const rr = Math.min(0.035, hd);
        p.lathe("steelDark", x, s.h - 0.02, zc, [
          [0, 0],
          [0.01, 0],
          [rr * 0.85, 0.012],
          [rr, 0.016],
          [rr, 0.02],
          [0, 0.02],
        ]);
      }
    }
  },
};
