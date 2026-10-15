// Floor box (Bodentank): a stainless box set flush into the floor with a hinged lid, for sockets
// in the middle of a room; the cable leaves through a brush slot at the lid's edge.

import type { KindDef } from "../types";
import { flushFrame } from "./common";

// Sizes (m).
/** Width of the frame round the lid. */
const FRAME = 0.015;
/** The cable outlet: its length along the lid's front edge and its width. */
const OUTLET = 0.08;
const OUTLET_W = 0.012;

export const floorBox: KindDef = {
  kind: "floorBox",
  placement: "flat",
  plan(s) {
    const f = FRAME * 1000;
    s.rect("detail", s.L + f, s.B + f, s.R - f, s.F - f);
    s.rect("detail", -OUTLET * 500, s.F - f - OUTLET_W * 1000 - 5, OUTLET * 500, s.F - f - 5);
    // The hinge along the back.
    s.line("detail", [s.L + f + 20, s.B + f + 15], [s.R - f - 20, s.B + f + 15]);
  },
  elevation() {},
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    flushFrame(p, W, D, FRAME, s.h);
    p.box("slot", -W + FRAME, W - FRAME, 0, s.h * 0.3, -D + FRAME, D - FRAME);
    // The lid with a raised border, a hair inside the frame.
    const c = 0.0015;
    p.roundedBox("satin", -W + FRAME + c, W - FRAME - c, s.h * 0.35, s.h - 0.0005, -D + FRAME + c, D - FRAME - c, 0.002, "top");
    // The brush slot for the cable at the front, the hinge pins at the back, a lifting slot.
    p.roundedBox("rubber", -OUTLET / 2, OUTLET / 2, s.h - 0.0015, s.h - 0.0002, D - FRAME - 0.005 - OUTLET_W, D - FRAME - 0.005, OUTLET_W / 2, "vertical");
    for (const sx of [-1, 1]) p.roundedBox("steelDark", sx * (W - FRAME - 0.03) - 0.012, sx * (W - FRAME - 0.03) + 0.012, s.h - 0.0012, s.h - 0.0002, -D + FRAME + 0.008, -D + FRAME + 0.02, 0.003, "vertical");
    p.roundedBox("slot", -0.02, 0.02, s.h - 0.0015, s.h - 0.0003, -D + FRAME + 0.035, -D + FRAME + 0.047, 0.006, "vertical");
  },
};
