// Multifunctional bratt pan (Multifunktionsbräter): a pan for frying, boiling and deep-frying on
// a body with doors, tilting forward, its lid closed; a control tower with a touch display at
// the right stands higher than the pan.

import { FEET, INSET, PANEL } from "../parts/elevation";
import { DOOR, doors, GAP, PLINTH, plinth } from "../parts/mesh";
import { CONTROL_STRIP, INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Width of the control tower at the right (m). */
const TOWER = 0.25;
/** Height of the pan rim above the floor (m, working height). */
const RIM = 0.9;
/** Thickness of the lid (m). */
const LID = 0.05;
/** Depth of the pan (m). */
const PAN = 0.2;

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
    f.box("detail", tx + INSET / 2, r - INSET / 2, top - PANEL * 2.5, top - INSET / 2, "item-dark");
    f.circle("detail", (tx + r) / 2, top - PANEL * 2.5 - INSET * 2, Math.min(PANEL / 4, tower / 6));
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const tower = Math.min(TOWER, s.w / 3);
    const tx = s.w / 2 - tower;
    const rim = Math.min(RIM, s.h - 0.1);
    const panBottom = rim - PAN;
    // The body under the pan with its doors.
    plinth(p, s.w, s.d);
    p.box("steel", -s.w / 2, tx, PLINTH, panBottom - 0.03, -s.d / 2, zf - DOOR);
    doors(p, -s.w / 2, tx, PLINTH, panBottom - 0.03, s.d, Math.max(1, Math.round((tx + s.w / 2) / 0.6)), "vertical");
    // The pan, a little narrower than the body, with its pouring lip at the front.
    const x0 = -s.w / 2 + 0.02;
    const x1 = tx - 0.02;
    p.box("steelDark", x0, x1, panBottom - 0.03, panBottom, -s.d / 2 + 0.02, zf - 0.04);
    p.tub("steel", x0, x1, panBottom, rim, -s.d / 2 + 0.02, zf - 0.04);
    const cx = (x0 + x1) / 2;
    p.box("steel", cx - 0.08, cx + 0.08, rim - 0.06, rim - 0.01, zf - 0.04, zf - 0.005);
    // The lid lies closed on the pan; its handle bar along the front.
    p.box("steel", x0, x1, rim, rim + LID, -s.d / 2 + 0.02, zf - 0.04);
    p.rod("steelDark", "x", cx, rim + LID - 0.006, -s.d / 2 + 0.05, (x1 - x0) * 0.9, 0.014);
    p.rod("handle", "x", cx, rim + LID / 2, zf - 0.015, (x1 - x0) * 0.6, 0.01);
    for (const sx of [-1, 1]) p.box("handle", cx + sx * (x1 - x0) * 0.27 - 0.008, cx + sx * (x1 - x0) * 0.27 + 0.008, rim + LID / 2 - 0.008, rim + LID / 2 + 0.008, zf - 0.04, zf - 0.015);
    // The control tower with the touch display and a dial.
    p.box("steel", tx, s.w / 2, PLINTH, s.h, -s.d / 2, zf - DOOR);
    const zFace = zf - DOOR / 2;
    p.box("panelDark", tx + GAP, s.w / 2 - GAP, s.h - 0.4, s.h - GAP * 2, zf - DOOR, zFace);
    const px = (tx + s.w / 2) / 2;
    const pw = tower - 0.05;
    p.box("glassDark", px - pw / 2, px + pw / 2, s.h - 0.22, s.h - 0.03, zFace, zFace + 0.003);
    p.knob(px, s.h - 0.3, zFace, zf, Math.min(0.03, pw / 4));
    p.box("steel", tx + GAP, s.w / 2 - GAP, PLINTH + GAP, s.h - 0.4 - GAP, zf - DOOR, zf - DOOR / 2);
  },
};
