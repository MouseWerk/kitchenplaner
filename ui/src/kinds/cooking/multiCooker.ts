// Multifunction cooking unit (Multifunktionsgargerät): two heated pans side by side for boiling,
// frying, deep-frying and pressure cooking, each with its lid closed and tilting forward; the
// control column with the touch display and the dial between them stands higher than the pans,
// a cabinet with doors below.

import { FEET, INSET } from "../parts/elevation";
import { BODY_RADIUS, DOOR, doors, PLINTH, plinth } from "../parts/mesh";
import { CONTROL_STRIP, INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { dial, hinges } from "./details";
import { controlPanel, display, housing, ratingPlate } from "../parts/details";

/** Width of the control column in the middle (m). */
const COLUMN = 0.24;
/** Height of the pans' rim above the floor, their depth and the lid (m). */
const RIM = 0.9;
const PAN = 0.2;
const LID = 0.06;

export const multiCooker: KindDef = {
  kind: "multiCooker",
  plan(s) {
    const c = Math.min(COLUMN * 1000, s.w / 4) / 2;
    const y1 = s.F - CONTROL_STRIP;
    for (const [a, b] of [
      [s.L + PLAN_INSET, -c - PLAN_INSET / 2],
      [c + PLAN_INSET / 2, s.R - PLAN_INSET],
    ]) {
      s.rect("detail", a, s.B + PLAN_INSET, b, y1);
      s.line("hidden", [a, y1 + PLAN_INSET / 2], [b, y1 + PLAN_INSET / 2]);
    }
    s.line("detail", [-c, s.B], [-c, s.F]);
    s.line("detail", [c, s.B], [c, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const c = Math.min(COLUMN * 1000, f.w / 4) / 2;
    const mid = (l + r) / 2;
    const rim = Math.min(z0 + RIM * 1000, top - 100);
    for (const [a, b] of [
      [l, mid - c],
      [mid + c, r],
    ]) {
      const d1 = rim - PAN * 1000 - INSET;
      f.box("detail", a + INSET, b - INSET, z0 + FEET, d1);
      f.line("detail", [b - INSET * 2, d1 - INSET * 2], [b - INSET * 2, d1 - INSET * 6]);
      f.box("detail", a + INSET / 2, b - INSET / 2, rim - PAN * 1000, rim);
      f.box("detail", a + INSET / 2, b - INSET / 2, rim, rim + LID * 1000);
    }
    f.box("detail", mid - c, mid + c, z0, top);
    f.box("detail", mid - c + INSET / 2, mid + c - INSET / 2, top - 420, top - INSET / 2, "item-dark");
    f.circle("detail", mid, top - 330, 25);
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const c = Math.min(COLUMN, s.w / 4) / 2;
    const rim = Math.min(RIM, s.h - 0.1);
    const panBottom = rim - PAN;
    // The cabinet under the pans, with a door under each.
    plinth(p, s.w, s.d);
    p.roundedBox("steel", -s.w / 2, s.w / 2, PLINTH, panBottom - 0.03, -s.d / 2, zf - DOOR, BODY_RADIUS, "vertical");
    doors(p, -s.w / 2, -c, PLINTH, panBottom - 0.03, s.d, 1, "vertical");
    doors(p, c, s.w / 2, PLINTH, panBottom - 0.03, s.d, 1, "vertical");
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -s.w / 2 + 0.02 : c + 0.02;
      const x1 = sx < 0 ? -c - 0.02 : s.w / 2 - 0.02;
      const z0 = -s.d / 2 + 0.02;
      const z1 = zf - 0.05;
      const cx = (x0 + x1) / 2;
      // The pan on its heated floor, the pouring lip at the front.
      p.roundedBox("steelDark", x0, x1, panBottom - 0.03, panBottom + 0.002, z0, z1, BODY_RADIUS);
      p.tub("steel", x0, x1, panBottom, rim, z0, z1);
      p.extrude("steel", "x", cx - 0.06, cx + 0.06, [
        [z1 - 0.01, rim - 0.06],
        [z1 + 0.03, rim - 0.01],
        [z1 + 0.03, rim - 0.002],
        [z1 - 0.01, rim - 0.002],
      ]);
      // The lid: a pressed cover hinged at the back with a handle bar at the front.
      housing(p, "steel", x0 + 0.004, x1 - 0.004, rim - 0.002, rim + LID, z0 + 0.004, z1 - 0.004, 0.012);
      hinges(p, x0 + 0.05, x1 - 0.05, rim + LID * 0.4, z0 - 0.004, 2, 0.012, 0.07);
      const len = (x1 - x0) * 0.6;
      const hy = rim + LID * 0.5;
      p.tube("handle", [
        { x: cx - len / 2, y: hy, z: z1 - 0.01 },
        { x: cx - len / 2, y: hy, z: zf - 0.012 },
        { x: cx + len / 2, y: hy, z: zf - 0.012 },
        { x: cx + len / 2, y: hy, z: z1 - 0.01 },
      ], 0.01, { bend: 0.02 });
    }
    // The control column between the pans: display, dial and the rating plate.
    housing(p, "steel", -c, c, PLINTH, s.h, -s.d / 2, zf - DOOR);
    const zFace = zf - DOOR / 2;
    controlPanel(p, -c + 0.012, c - 0.012, s.h - 0.42, s.h - 0.012, zf - DOOR, zFace);
    display(p, 0, s.h - 0.14, 2 * c - 0.05, 0.22, zFace);
    dial(p, 0, s.h - 0.33, zFace, zf, Math.min(0.035, c / 3));
    ratingPlate(p, 0, PLINTH + 0.05, zf - DOOR, 0.08, 0.04);
  },
};
