// Multifunctional bratt pan (Multifunktionsbräter): a pan for frying, boiling and deep-frying on
// a body with doors, tilting forward, its lid closed; a control tower with a touch display at
// the right stands higher than the pan.

import { FEET, INSET, PANEL } from "../parts/elevation";
import { BODY_RADIUS, DOOR, DOOR_RADIUS, doors, GAP, PLINTH, plinth } from "../parts/mesh";
import { CONTROL_STRIP, INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { dial, hinges } from "./details";
import { controlPanel, display, housing, ratingPlate } from "../parts/details";

/** Width of the control tower at the right (m). */
const TOWER = 0.25;
/** Height of the pan rim above the floor (m, working height). */
const RIM = 0.9;
/** Thickness of the lid (m). */
const LID = 0.05;
/** Depth of the pan (m). */
const PAN = 0.2;
/** Height of the dark control panel at the top of the tower, and of the dial below its top (m). */
const CONTROL_PANEL = 0.4;
const DIAL = 0.3;

export const multiPan: KindDef = {
  kind: "multiPan",
  plan(s) {
    const tower = Math.min(TOWER * 1000, s.w / 3);
    const axisY = s.F - CONTROL_STRIP;
    s.rect("detail", s.L + PLAN_INSET, s.B + PLAN_INSET, s.R - tower - PLAN_INSET, axisY - PLAN_INSET);
    s.line("hidden", [s.L + PLAN_INSET / 2, axisY], [s.R - tower - PLAN_INSET / 2, axisY]);
    s.line("detail", [s.R - tower, s.B], [s.R - tower, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const tower = Math.min(TOWER * 1000, f.w / 3);
    const rim = Math.min(z0 + RIM * 1000, top - 100);
    const tx = r - tower;
    f.doors(Math.max(1, Math.round((tx - l) / 600)), z0 + FEET, rim - PAN * 1000 - INSET);
    // Pan front with the pouring lip, the lid over it and its handle.
    f.box("detail", l + INSET / 2, tx - INSET / 2, rim - PAN * 1000, rim);
    f.box("detail", l + INSET / 2, tx - INSET / 2, rim, rim + LID * 1000);
    f.line("detail", [l + INSET * 3, rim + LID * 500], [tx - INSET * 3, rim + LID * 500]);
    f.box("detail", tx, r, z0, top);
    // The control panel with the touch display and the dial under it, as in 3D.
    f.box("detail", tx + INSET / 2, r - INSET / 2, top - CONTROL_PANEL * 1000, top - INSET / 2, "item-dark");
    f.box("detail", tx + INSET, r - INSET, top - 220, top - 30);
    f.circle("detail", (tx + r) / 2, top - DIAL * 1000, Math.min(PANEL / 4, tower / 6));
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const tower = Math.min(TOWER, s.w / 3);
    const tx = s.w / 2 - tower;
    const rim = Math.min(RIM, s.h - 0.1);
    const panBottom = rim - PAN;
    // The body under the pan with its doors.
    plinth(p, s.w, s.d);
    p.roundedBox("steel", -s.w / 2, tx, PLINTH, panBottom - 0.03, -s.d / 2, zf - DOOR, BODY_RADIUS, "vertical");
    doors(p, -s.w / 2, tx, PLINTH, panBottom - 0.03, s.d, Math.max(1, Math.round((tx + s.w / 2) / 0.6)), "vertical");
    // The pan, a little narrower than the body, on its heated floor, a satin rim round its top
    // and the pouring lip at the front.
    const x0 = -s.w / 2 + 0.02;
    const x1 = tx - 0.02;
    const z0 = -s.d / 2 + 0.02;
    const z1 = zf - 0.04;
    p.roundedBox("steelDark", x0, x1, panBottom - 0.03, panBottom + 0.002, z0, z1, BODY_RADIUS);
    p.tub("steel", x0, x1, panBottom, rim, z0, z1);
    const cx = (x0 + x1) / 2;
    p.extrude("steel", "x", cx - 0.08, cx + 0.08, [
      [z1 - 0.01, rim - 0.07],
      [z1 + 0.03, rim - 0.01],
      [z1 + 0.03, rim - 0.002],
      [z1 - 0.01, rim - 0.002],
    ]);
    // The lid lies closed on the pan; hinged at the back, its handle bar along the front.
    housing(p, "steel", x0 + 0.004, x1 - 0.004, rim - 0.002, rim + LID, z0 + 0.004, z1 - 0.004, 0.01);
    hinges(p, x0 + 0.06, x1 - 0.06, rim + LID * 0.4, z0 - 0.004, 2, 0.012, 0.09);
    const len = (x1 - x0) * 0.6;
    const hy = rim + LID * 0.55;
    p.tube("handle", [
      { x: cx - len / 2, y: hy, z: z1 - 0.01 },
      { x: cx - len / 2, y: hy, z: zf - 0.01 },
      { x: cx + len / 2, y: hy, z: zf - 0.01 },
      { x: cx + len / 2, y: hy, z: z1 - 0.01 },
    ], 0.009, { bend: 0.02 });
    // The control tower with the touch display, a dial and the rating plate; a door below.
    housing(p, "steel", tx, s.w / 2, PLINTH, s.h, -s.d / 2, zf - DOOR);
    const zFace = zf - DOOR / 2;
    controlPanel(p, tx + GAP, s.w / 2 - GAP, s.h - CONTROL_PANEL, s.h - GAP * 3, zf - DOOR, zFace);
    const px = (tx + s.w / 2) / 2;
    const pw = tower - 0.05;
    display(p, px, s.h - 0.125, pw, 0.19, zFace);
    dial(p, px, s.h - DIAL, zFace, zf, Math.min(0.03, pw / 4));
    p.roundedBox("steel", tx + GAP, s.w / 2 - GAP, PLINTH + GAP, s.h - CONTROL_PANEL - GAP, zf - DOOR, zFace, DOOR_RADIUS, "top", "z");
    p.barHandle("y", PLINTH + 0.15, PLINTH + 0.35, tx + 0.03, zFace, zf);
    ratingPlate(p, px, PLINTH + 0.05, zFace, 0.08, 0.04);
  },
};
