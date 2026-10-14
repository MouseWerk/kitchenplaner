// Installation shaft (Schacht): a boxed-in riser for pipes, ducts or cables, drawn like a wall
// with the usual cross, and an access panel at the front.

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
    p.box("panel", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, s.d / 2 - FRAME);
    const [y0, y1] = panel(s.h);
    const half = Math.min(PANEL / 2, s.w / 2 - 0.02);
    p.box("steel", -half, half, y0, y1, s.d / 2 - FRAME, s.d / 2 - FRAME / 2);
    // The panel's lock.
    const yl = (y0 + y1) / 2;
    p.box("knob", half - 0.05, half - 0.03, yl - 0.01, yl + 0.01, s.d / 2 - FRAME / 2, s.d / 2);
  },
};
