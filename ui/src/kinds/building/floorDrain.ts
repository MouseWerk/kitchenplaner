// Floor drain (Bodenablauf): a square gully flush with the floor, a stainless frame and a slotted
// grate over the dark trap. Placed in front of tilting pans, kettles and in wash areas.

import type { KindDef } from "../types";

// Sizes (m).
/** Width of the frame around the grate. */
const FRAME = 0.025;
/** Width and pitch of the grate bars. */
const BAR = 0.006;
const BAR_PITCH = 0.016;

export const floorDrain: KindDef = {
  kind: "floorDrain",
  placement: "flat",
  plan(s) {
    const f = FRAME * 1000;
    s.rect("detail", s.L + f, s.B + f, s.R - f, s.F - f);
    // A few of the grate's slots and the outlet below it.
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const y = s.B + f + ((s.d - 2 * f) * i) / (n + 1);
      s.line("detail", [s.L + f * 2, y], [s.R - f * 2, y]);
    }
    s.circle("detail", 0, 0, Math.min(s.w, s.d) / 2 - f * 2);
  },
  elevation() {},
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    p.box("steel", -W, W, 0, s.h, -D, -D + FRAME);
    p.box("steel", -W, W, 0, s.h, D - FRAME, D);
    p.box("steel", -W, -W + FRAME, 0, s.h, -D + FRAME, D - FRAME);
    p.box("steel", W - FRAME, W, 0, s.h, -D + FRAME, D - FRAME);
    p.box("plate", -W + FRAME, W - FRAME, 0, s.h * 0.3, -D + FRAME, D - FRAME);
    const inner = s.d - 2 * FRAME;
    const n = Math.max(2, Math.floor(inner / BAR_PITCH));
    const pitch = inner / n;
    for (let i = 0; i < n; i++) {
      const z = -D + FRAME + pitch * (i + 0.5);
      p.box("steel", -W + FRAME, W - FRAME, s.h * 0.6, s.h, z - BAR / 2, z + BAR / 2);
    }
  },
};
