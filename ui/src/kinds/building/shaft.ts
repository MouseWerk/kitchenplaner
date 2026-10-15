// Installation shaft (Schacht): a boxed-in riser for pipes, ducts or cables, drawn like a wall
// with the usual cross, and an access panel at the front.

import { BODY_RADIUS } from "../parts/mesh";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";

// Sizes (m).
/** Lower edge and size of the access panel. */
const PANEL_Y = 1.2;
const PANEL = 0.4;
/** Thickness of the access panel's frame standing out of the cladding. */
const FRAME = 0.006;

/** The access panel's height range within a shaft of height h (m). */
function panel(h: number): [number, number] {
  const y0 = Math.min(PANEL_Y, h * 0.4);
  return [y0, Math.min(y0 + PANEL, h * 0.9)];
}

export const shaft: KindDef = {
  kind: "shaft",
  structural: true,
  plan(s) {
    cross(s, "detail");
  },
  elevation(f) {
    const [y0, y1] = panel(f.item.height / 1000);
    const c = (f.l + f.r) / 2;
    const half = Math.min(PANEL * 500, f.w / 2 - 20);
    f.box("detail", c - half, c + half, f.z0 + y0 * 1000, f.z0 + y1 * 1000);
  },
  mesh(p, s) {
    // Plastered cladding with lightly rounded edges.
    p.roundedBox("panel", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, s.d / 2 - FRAME, BODY_RADIUS * 3, "vertical");
    const [y0, y1] = panel(s.h);
    const half = Math.min(PANEL / 2, s.w / 2 - 0.02);
    const zf = s.d / 2 - FRAME;
    // The access panel: a narrow frame flush in the cladding and the door in it with its lock.
    p.lathe("satin", 0, (y0 + y1) / 2, zf - 0.001, [[0, 0], [0.012, 0], [0.012, FRAME * 0.5], [0, FRAME * 0.5], [0, 0]], { axis: "z", rect: [half - 0.012, (y1 - y0) / 2 - 0.012] });
    p.roundedBox("steel", -half + 0.014, half - 0.014, y0 + 0.014, y1 - 0.014, zf - 0.001, s.d / 2 - FRAME * 0.25, 0.002, "top", "z");
    // A square-key lock: a turned rosette with the key square.
    const yl = (y0 + y1) / 2;
    const xl = half - 0.045;
    p.lathe("satin", xl, yl, s.d / 2 - FRAME * 0.25 - 0.0005, [[0, 0], [0.011, 0], [0.011, FRAME * 0.1], [0.008, FRAME * 0.25], [0, FRAME * 0.25]], { axis: "z" });
    p.box("slot", xl - 0.003, xl + 0.003, yl - 0.003, yl + 0.003, s.d / 2 - 0.0008, s.d / 2 - 0.0002);
  },
};
