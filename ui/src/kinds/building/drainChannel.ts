// Drainage channel (Entwässerungsrinne): a stainless box channel flush with the floor, a grate
// of bars along the channel held by cross ties, the outlet at the right end.

import type { KindDef } from "../types";

// Sizes (m).
/** Width of the channel's rim. */
const RIM = 0.02;
/** Bars along the channel: width and largest pitch. */
const BAR = 0.008;
const BAR_PITCH = 0.025;
/** Largest distance between two cross ties of the grate. */
const TIE_PITCH = 0.25;
/** Radius of the outlet below the grate. */
const OUTLET = 0.05;

export const drainChannel: KindDef = {
  kind: "drainChannel",
  placement: "flat",
  plan(s) {
    const r = RIM * 1000;
    s.rect("detail", s.L + r, s.B + r, s.R - r, s.F - r);
    s.line("detail", [s.L + r, 0], [s.R - r, 0]);
    const o = Math.min(OUTLET * 1000, s.d / 2 - r);
    s.circle("detail", s.R - r - o - 20, 0, o);
  },
  elevation() {},
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    p.box("steel", -W, W, 0, s.h, -D, -D + RIM);
    p.box("steel", -W, W, 0, s.h, D - RIM, D);
    p.box("steel", -W, -W + RIM, 0, s.h, -D + RIM, D - RIM);
    p.box("steel", W - RIM, W, 0, s.h, -D + RIM, D - RIM);
    p.box("plate", -W + RIM, W - RIM, 0, s.h * 0.3, -D + RIM, D - RIM);
    // The outlet shows as a darker round at the right end.
    const o = Math.min(OUTLET, D - RIM);
    p.cyl("rubber", W - RIM - o - 0.02, 0, s.h * 0.3, s.h * 0.35, o);
    const inner = s.d - 2 * RIM;
    const n = Math.max(2, Math.floor(inner / BAR_PITCH));
    const pitch = inner / n;
    for (let i = 0; i < n; i++) {
      const z = -D + RIM + pitch * (i + 0.5);
      p.box("steel", -W + RIM, W - RIM, s.h * 0.7, s.h, z - BAR / 2, z + BAR / 2);
    }
    const len = s.w - 2 * RIM;
    const ties = Math.max(1, Math.ceil(len / TIE_PITCH) - 1);
    for (let i = 1; i <= ties; i++) {
      const x = -W + RIM + (len * i) / (ties + 1);
      p.box("steelDark", x - BAR / 2, x + BAR / 2, s.h * 0.5, s.h * 0.7, -D + RIM, D - RIM);
    }
  },
};
