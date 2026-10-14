// Water connection (Wasseranschluss): a stainless box on the wall with angle valves for cold and
// hot water and the drain socket, where a sink, dishwasher or combi steamer is connected.

import type { KindDef } from "../types";

// Sizes (m).
/** Depth of the box from the wall. */
const BOX = 0.04;
/** Radius of a valve body and of the drain socket (DN 50). */
const VALVE = 0.012;
const DRAIN = 0.025;

/** Positions along the width: cold valve, hot valve and drain (parts of the width from the centre). */
const COLD = -0.3;
const HOT = -0.1;
const OUTLET = 0.25;

export const waterConnection: KindDef = {
  kind: "waterConnection",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.B + BOX * 1000], [s.R, s.B + BOX * 1000]);
    const r = Math.min(DRAIN * 1000, s.d / 2);
    s.circle("overhead", s.w * OUTLET, 0, r);
    for (const k of [COLD, HOT]) s.circle("overhead", s.w * k, 0, Math.min(VALVE * 1000, s.d / 2));
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const zc = (f.z0 + f.top) / 2;
    f.box("detail", f.l + 15, f.r - 15, f.z0 + 15, f.top - 15);
    for (const k of [COLD, HOT]) {
      f.circle("detail", c + f.w * k, zc + 20, VALVE * 1000);
      f.line("detail", [c + f.w * k, zc + 20], [c + f.w * k, zc + 70]);
    }
    f.circle("detail", c + f.w * OUTLET, zc - 20, DRAIN * 1000);
  },
  mesh(p, s) {
    const B = -s.d / 2;
    const zf = B + Math.min(BOX, s.d / 2);
    p.box("steel", -s.w / 2, s.w / 2, 0, s.h, B, zf);
    const yc = s.h / 2;
    for (const k of [COLD, HOT]) {
      const x = s.w * k;
      // Angle valve: the body out of the box, the outlet down and a lever handle on the front.
      p.rod("handle", "z", x, yc + 0.02, (zf + s.d / 2 - 0.02) / 2, s.d / 2 - 0.02 - zf, VALVE);
      p.cyl("handle", x, s.d / 2 - 0.03, yc - 0.03, yc + 0.02, VALVE * 0.7);
      p.box("knob", x - 0.006, x + 0.006, yc + 0.02, yc + 0.075, s.d / 2 - 0.012, s.d / 2);
    }
    // Drain socket with its rubber seal.
    const x = s.w * OUTLET;
    p.rod("panelDark", "z", x, yc - 0.02, (zf + s.d / 2) / 2, s.d / 2 - zf, DRAIN);
    p.rod("rubber", "z", x, yc - 0.02, s.d / 2 - 0.002, 0.004, DRAIN * 0.75);
  },
};
