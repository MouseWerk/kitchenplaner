// Wall cabinet with sliding doors: a closed stainless body hung on the wall, two doors running
// in two tracks one behind the other, each with a recessed grip at its outer edge.

import { INSET } from "../parts/elevation";
import { BODY_RADIUS, DOOR_RADIUS, GAP, SHEET, TOP_RADIUS } from "../parts/mesh";
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
    const W = s.w / 2;
    // Body: a closed box behind the tracks, the side cheeks reaching forward past the doors.
    p.roundedBox("steel", -W + SHEET, W - SHEET, 0.001, s.h - 0.001, -s.d / 2, zb, BODY_RADIUS);
    for (const sx of [-1, 1]) p.roundedBox("steel", sx > 0 ? W - SHEET : -W, sx > 0 ? W : -W + SHEET, 0, s.h, -s.d / 2, s.d / 2, BODY_RADIUS, "vertical");
    // Top and bottom: a cover over the whole and the track profiles between the cheeks.
    p.roundedBox("steel", -W + SHEET, W - SHEET, s.h - SHEET, s.h, -s.d / 2, s.d / 2, TOP_RADIUS);
    p.roundedBox("steel", -W + SHEET, W - SHEET, 0, SHEET, -s.d / 2, s.d / 2, TOP_RADIUS);
    p.box("steelDark", -W + SHEET, W - SHEET, SHEET, TRACK, zb, s.d / 2 - 0.002);
    p.box("steelDark", -W + SHEET, W - SHEET, s.h - TRACK, s.h - SHEET, zb, s.d / 2 - 0.002);
    // Left door in the back track, right door in the front track; they overlap in the middle
    // and the front one stands a step proud, so the joint shows.
    const y0 = TRACK + GAP;
    const y1 = s.h - TRACK - GAP;
    const back = s.d / 2 - TRACKS + 0.003;
    const front = s.d / 2 - LEAF - 0.003;
    p.roundedBox("steel", -W + SHEET + GAP, OVERLAP / 2, y0, y1, back, back + LEAF, DOOR_RADIUS, "top", "z");
    p.roundedBox("steel", -OVERLAP / 2, W - SHEET - GAP, y0, y1, front, front + LEAF, DOOR_RADIUS, "top", "z");
    // Recessed grips with round ends at the outer edges, a bright pull inside each.
    const gy = (y0 + y1) / 2;
    const gl = -W + SHEET + 0.05;
    const gr = W - SHEET - 0.05;
    for (const [x, z] of [
      [gl, back + LEAF],
      [gr, front + LEAF],
    ]) {
      p.plate("slot", x - GRIP_W / 2, x + GRIP_W / 2, gy - GRIP_H / 2, gy + GRIP_H / 2, z - 0.001, z + 0.0005, GRIP_W / 2);
      p.plate("satin", x - GRIP_W * 0.3, x + GRIP_W * 0.3, gy - GRIP_H * 0.4, gy + GRIP_H * 0.4, z, z + 0.001, GRIP_W * 0.3);
    }
  },
};
