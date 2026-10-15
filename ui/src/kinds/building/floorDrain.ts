// Floor drain (Bodenablauf): a square gully flush with the floor, a stainless frame and a slotted
// grate over the dark trap. Placed in front of tilting pans, kettles and in wash areas. The plan
// draws the same grate bars as 3D and the round body of the gully below it hidden.

import type { KindDef } from "../types";
import { flushFrame } from "./common";

// Sizes (m).
/** Width of the frame around the grate. */
const FRAME = 0.025;
/** Width and largest pitch of the grate bars. */
const BAR = 0.01;
const BAR_PITCH = 0.03;

/** Centres of the grate bars across the depth (m, from the back -d/2 to the front). */
function bars(d: number): number[] {
  const inner = d - 2 * FRAME;
  const n = Math.max(2, Math.floor(inner / BAR_PITCH));
  const pitch = inner / n;
  return Array.from({ length: n }, (_, i) => -d / 2 + FRAME + pitch * (i + 0.5));
}

export const floorDrain: KindDef = {
  kind: "floorDrain",
  placement: "flat",
  plan(s) {
    const f = FRAME * 1000;
    s.rect("detail", s.L + f, s.B + f, s.R - f, s.F - f);
    // The grate bars, and the gully's round body below the grate.
    for (const z of bars(s.d / 1000)) s.line("detail", [s.L + f, z * 1000], [s.R - f, z * 1000]);
    s.circle("hidden", 0, 0, Math.min(s.w, s.d) / 2 - f * 2);
  },
  elevation() {},
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    flushFrame(p, W, D, FRAME, s.h);
    // The gully's dark body below the grate, and the bars with rounded tops over it.
    p.box("slot", -W + FRAME, W - FRAME, 0, s.h * 0.3, -D + FRAME, D - FRAME);
    for (const z of bars(s.d)) p.roundedBox("steel", -W + FRAME, W - FRAME, s.h * 0.4, s.h - 0.0005, z - BAR / 2, z + BAR / 2, 0.0015, "top");
  },
};
