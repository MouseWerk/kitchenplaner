// Wall cabinet with sliding doors: a closed stainless body hung on the wall, two doors running
// in two tracks one behind the other, each with a recessed grip at its outer edge.

import { INSET } from "../parts/elevation";
import { GAP, SHEET } from "../parts/mesh";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Depth of the two door tracks at the front. */
const TRACKS = 0.03;
/** Thickness of a sliding door. */
const LEAF = 0.012;
/** How far the doors overlap in the middle. */
const OVERLAP = 0.04;
/** Height of the top and bottom track profiles. */
const TRACK = 0.02;
/** Recessed grip: width and height. */
const GRIP_W = 0.025;
const GRIP_H = 0.12;

export const wallCabinet: KindDef = {
  kind: "wallCabinet",
  placement: "overhead",
  plan(s) {
    cross(s, "overhead");
    // The two door tracks along the front.
    s.line("overhead", [s.L, s.F - TRACKS * 1000], [s.R, s.F - TRACKS * 1000]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const m = (l + r) / 2;
    const ov = (OVERLAP * 1000) / 2;
    const a = z0 + INSET / 2;
    const b = top - INSET / 2;
    f.box("detail", l + INSET / 2, m + ov, a, b);
    f.box("detail", m - ov, r - INSET / 2, a, b);
    // Grips at the outer edges.
    const gz = (a + b) / 2;
    for (const x of [l + INSET * 1.5, r - INSET * 1.5]) f.box("detail", x - 12, x + 12, gz - 60, gz + 60);
  },
  mesh(p, s) {
    const zb = s.d / 2 - TRACKS;
    // Body: back, sides, top and bottom, open towards the doors.
    p.box("steel", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, -s.d / 2 + SHEET);
    p.box("steel", -s.w / 2, -s.w / 2 + SHEET, 0, s.h, -s.d / 2, s.d / 2);
    p.box("steel", s.w / 2 - SHEET, s.w / 2, 0, s.h, -s.d / 2, s.d / 2);
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, s.h - SHEET, s.h, -s.d / 2, zb);
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, 0, SHEET, -s.d / 2, zb);
    // Middle shelf inside, seen through the door gap.
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, s.h / 2 - SHEET / 2, s.h / 2 + SHEET / 2, -s.d / 2 + SHEET, zb);
    // Top and bottom track profiles.
    p.box("steelDark", -s.w / 2 + SHEET, s.w / 2 - SHEET, 0, TRACK, zb, s.d / 2);
    p.box("steelDark", -s.w / 2 + SHEET, s.w / 2 - SHEET, s.h - TRACK, s.h, zb, s.d / 2);
    // Left door in the back track, right door in the front track; they overlap in the middle.
    const y0 = TRACK + GAP;
    const y1 = s.h - TRACK - GAP;
    const back = s.d / 2 - TRACKS + 0.003;
    const front = s.d / 2 - LEAF - 0.002;
    p.box("steel", -s.w / 2 + SHEET + GAP, OVERLAP / 2, y0, y1, back, back + LEAF);
    p.box("steel", -OVERLAP / 2, s.w / 2 - SHEET - GAP, y0, y1, front, front + LEAF);
    const gy = (y0 + y1) / 2;
    const gl = -s.w / 2 + SHEET + 0.05;
    const gr = s.w / 2 - SHEET - 0.05;
    p.box("knob", gl - GRIP_W / 2, gl + GRIP_W / 2, gy - GRIP_H / 2, gy + GRIP_H / 2, back + LEAF, back + LEAF + 0.002);
    p.box("knob", gr - GRIP_W / 2, gr + GRIP_W / 2, gy - GRIP_H / 2, gy + GRIP_H / 2, front + LEAF, front + LEAF + 0.002);
  },
};
