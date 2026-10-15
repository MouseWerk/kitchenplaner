// Hot cupboard (Wärmeschrank-Unterbau): a heated counter with sliding doors, for keeping plates
// and food warm, the thermostat and pilot lamp at the right of the front.

import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, DOOR_RADIUS, GAP, HANDLE, PLINTH, TOP } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, PANEL_SHEET, pilotLamp, ratingPlate, rocker } from "./common";
import { ventSlots } from "../parts/details";

/** Width of the control panel at the right of the front (mm). */
const CONTROL = 160;
/** Width of one sliding door (mm, two run behind each other per pair). */
const SLIDING_DOOR = 700;

/** Number of sliding doors in front of a cupboard of the given width, at least two. */
function doorsOf(width: number): number {
  return Math.max(2, Math.round((width - CONTROL) / SLIDING_DOOR));
}

export const hotCupboard: KindDef = {
  kind: "hotCupboard",
  plan(s) {
    // Sliding doors: two tracks along the front, the doors overlapping.
    const n = doorsOf(s.w);
    const dw = (s.w - CONTROL) / n;
    for (let i = 0; i < n; i++) {
      const y = s.F - (i % 2 === 0 ? INSET / 2 : INSET);
      s.line("detail", [s.L + i * dw, y], [Math.min(s.L + (i + 1) * dw + INSET, s.R - CONTROL), y]);
    }
    upstandLine(s);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    f.worktop();
    const n = doorsOf(f.w);
    const x1 = r - CONTROL;
    const dw = (x1 - l - I) / n;
    for (let i = 0; i < n; i++) {
      const a = l + I / 2 + i * dw;
      const b = Math.min(a + dw + I / 2, x1 - I / 2);
      f.box("detail", a, b, z0 + FEET, top - FRONT_TOP - I);
      // Recessed grip at the outer edge of each door.
      const gx = i % 2 === 0 ? a + I : b - I;
      f.box("detail", gx - 8, gx + 8, (z0 + top) / 2 - 80, (z0 + top) / 2 + 80);
    }
    f.box("detail", x1, r - I / 2, top - FRONT_TOP - I * 5, top - FRONT_TOP - I / 2, "item-dark");
    f.circle("detail", (x1 + r) / 2, top - FRONT_TOP - I * 2, I * 0.6);
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const zBody = zf - DOOR;
    counterBody(p, s, [], "steel", zBody);
    const ctrl = Math.min(CONTROL / 1000, s.w * 0.2);
    const x1 = s.w / 2 - ctrl;
    const yt = s.h - TOP;
    // Sliding doors on two tracks: every other door runs a door's thickness further out; each has
    // a recessed grip near its outer edge.
    const n = doorsOf(Math.round(s.w * 1000));
    const dw = (x1 + s.w / 2) / n;
    for (let i = 0; i < n; i++) {
      const a = -s.w / 2 + i * dw + GAP;
      const b = Math.min(a + dw + 0.03, x1 - GAP);
      const outer = i % 2 === 1;
      const z0 = outer ? zf - DOOR / 2 : zf - DOOR;
      const z1 = outer ? zf - HANDLE / 4 : zf - DOOR / 2 - 0.001;
      p.roundedBox("steel", a, b, PLINTH + GAP * 2, yt - GAP * 2, z0, z1, DOOR_RADIUS, "top", "z");
      const gx = outer ? b - 0.05 : a + 0.05;
      const gy = (PLINTH + yt) / 2;
      p.plate("slot", gx - 0.014, gx + 0.014, gy - 0.07, gy + 0.07, z1, z1 + 0.0008, 0.012);
    }
    // Door track rails over and under the doors.
    p.roundedBox("steelDark", -s.w / 2, x1, PLINTH, PLINTH + GAP * 2, zBody, zf - 0.002, 0.001);
    p.roundedBox("steelDark", -s.w / 2, x1, yt - GAP * 2, yt, zBody, zf - 0.002, 0.001);
    // Control panel: thermometer display, thermostat knob, pilot lamp and main switch.
    p.roundedBox("steel", x1 + GAP, s.w / 2 - GAP, PLINTH + GAP, yt - GAP, zBody, zf - HANDLE, DOOR_RADIUS, "top", "z");
    const cx = (x1 + s.w / 2) / 2;
    const zp = zf - HANDLE;
    const pw = Math.min(0.06, (s.w / 2 - x1) / 2 - 0.01);
    p.plate("panelDark", cx - pw, cx + pw, yt - 0.26, yt - 0.02, zp, zp + PANEL_SHEET, 0.006, true);
    p.plate("glassDark", cx - pw + 0.012, cx + pw - 0.012, yt - 0.06, yt - 0.035, zp + PANEL_SHEET, zp + PANEL_SHEET + 0.001, 0.003);
    p.knob(cx, yt - 0.12, zp + PANEL_SHEET, zf);
    pilotLamp(p, cx - 0.02, yt - 0.2, zp + PANEL_SHEET);
    rocker(p, cx + 0.02, yt - 0.2, zp + PANEL_SHEET, zf);
    ventSlots(p, cx - pw, cx + pw, PLINTH + 0.04, PLINTH + 0.16, zp, 5);
    ratingPlate(p, cx, PLINTH + 0.21, zp);
  },
};
