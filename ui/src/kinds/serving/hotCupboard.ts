// Hot cupboard (Wärmeschrank-Unterbau): a heated counter with sliding doors, for keeping plates
// and food warm, the thermostat and pilot lamp at the right of the front.

import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, GAP, HANDLE, PLINTH, SHEET, TOP } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody } from "./common";

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
    counterBody(p, s);
    const ctrl = Math.min(CONTROL / 1000, s.w * 0.2);
    const x1 = s.w / 2 - ctrl;
    const yt = s.h - TOP;
    const zf = s.d / 2;
    // Sliding doors on two tracks: every other door runs a door's thickness further out.
    const n = doorsOf(Math.round(s.w * 1000));
    const dw = (x1 + s.w / 2) / n;
    for (let i = 0; i < n; i++) {
      const a = -s.w / 2 + i * dw + GAP;
      const b = Math.min(a + dw + 0.03, x1 - GAP);
      const outer = i % 2 === 1;
      const z0 = outer ? zf - DOOR / 2 : zf - DOOR;
      const z1 = outer ? zf - HANDLE / 4 : zf - DOOR / 2;
      p.box("steel", a, b, PLINTH + GAP, yt - GAP, z0, z1);
      // Recessed grip: a dark slot near the door's outer edge.
      const gx = outer ? b - 0.05 : a + 0.05;
      p.box("steelDark", gx - 0.012, gx + 0.012, (PLINTH + yt) / 2 - 0.08, (PLINTH + yt) / 2 + 0.08, z1, z1 + 0.001);
    }
    // Door track rails over and under the doors.
    p.box("steelDark", -s.w / 2, x1, PLINTH, PLINTH + GAP, zf - DOOR, zf);
    p.box("steelDark", -s.w / 2, x1, yt - GAP, yt, zf - DOOR, zf);
    // Control panel: thermostat knob and pilot lamp.
    p.box("panelDark", x1 + GAP, s.w / 2 - GAP, PLINTH + GAP, yt - GAP, zf - DOOR, zf - HANDLE);
    const cx = (x1 + s.w / 2) / 2;
    p.knob(cx, yt - 0.12, zf - HANDLE, zf);
    p.rod("oil", "z", cx, yt - 0.045, zf - HANDLE + SHEET / 2, SHEET, 0.008);
  },
};
