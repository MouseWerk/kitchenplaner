// Heat lamp bridge (Wärmebrücke): a flat housing with infrared heating elements and a light strip in
// its underside, hung over a pass on two rods from the ceiling or a gantry.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Height of the housing at the bottom of the unit (m); the hanging rods take the rest. */
const HOUSING = 0.09;
/** Heating elements along the housing (two, either side of the light strip). */
const ELEMENTS = 2;
/** Width of a heating element strip (m). */
const ELEMENT = 0.045;

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
    p.box("steel", -s.w / 2, s.w / 2, SHEET, hh, -s.d / 2, s.d / 2 - 0.003);
    // The open underside: a polished reflector, the dark heating elements on it and a light
    // strip between them, framed by the housing's rim.
    p.box("steel", -s.w / 2, s.w / 2, 0, SHEET, -s.d / 2, -s.d / 2 + SHEET * 2);
    p.box("steel", -s.w / 2, s.w / 2, 0, SHEET, s.d / 2 - SHEET * 2, s.d / 2);
    p.box("handle", -s.w / 2 + SHEET, s.w / 2 - SHEET, SHEET, SHEET * 1.5, -s.d / 2 + SHEET * 2, s.d / 2 - SHEET * 2);
    for (let i = 0; i < ELEMENTS; i++) {
      const z = (i === 0 ? -1 : 1) * (s.d / 4);
      p.box("ceramic", -s.w / 2 + 0.04, s.w / 2 - 0.04, SHEET * 0.4, SHEET * 1.5, z - ELEMENT / 2, z + ELEMENT / 2);
    }
    p.box("panel", -s.w / 2 + 0.05, s.w / 2 - 0.05, SHEET * 0.8, SHEET * 1.5, -0.015, 0.015);
    // Switch on the front edge.
    p.box("panelDark", s.w / 2 - 0.1, s.w / 2 - 0.04, hh * 0.3, hh * 0.8, s.d / 2 - 0.002, s.d / 2);
    // Hanging rods with their ceiling plates.
    if (s.h > hh + 0.02) {
      for (const x of [-s.w / 2 + 0.1, s.w / 2 - 0.1]) {
        p.rod("handle", "y", x, (hh + s.h) / 2, 0, s.h - hh, 0.006);
        p.cyl("steelDark", x, 0, s.h - 0.008, s.h, Math.min(0.03, s.d / 2));
      }
    }
  },
};
