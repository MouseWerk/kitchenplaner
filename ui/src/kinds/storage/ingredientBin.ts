// Mobile ingredient bin (Zutatenwagen) for flour, sugar or rice: a food-safe plastic tub on
// swivel castors with a fixed rear lid and a clear lid hinged towards the front.

import { INSET } from "../parts/elevation";
import { castor } from "../parts/mesh";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Castor wheel radius and the top of its mounting plate. */
const WHEEL = 0.035;
const CASTOR_TOP = 0.09;
/** Thickness of the lids and the share of the depth the fixed rear lid covers. */
const LID = 0.025;
const REAR_LID = 0.3;
/** Depth of the front grip standing out of the tub. */
const GRIP = 0.025;

export const ingredientBin: KindDef = {
  kind: "ingredientBin",
  plan(s) {
    const y = s.B + s.d * REAR_LID;
    s.line("detail", [s.L, y], [s.R, y]);
    s.line("detail", [s.L + INSET, s.F - GRIP * 500], [s.R - INSET, s.F - GRIP * 500]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.box("detail", l, r, top - LID * 1000, top);
    const c = (l + r) / 2;
    const gz = top - 140;
    f.box("detail", c - 100, c + 100, gz - 20, gz + 20);
    const wr = WHEEL * 1000;
    for (const x of [l + wr + 10, r - wr - 10]) f.circle("detail", x, z0 + wr, wr);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const front = s.d / 2 - GRIP;
    for (const sx of [-1, 1]) for (const z of [B + WHEEL + 0.01, front - WHEEL - 0.01]) castor(p, sx * (W - WHEEL - 0.01), z, WHEEL, CASTOR_TOP);
    // The tub, a little narrower at the bottom as moulded bins are.
    p.box("panel", -W + 0.01, W - 0.01, CASTOR_TOP, CASTOR_TOP + 0.05, B + 0.01, front - 0.01);
    p.box("panel", -W, W, CASTOR_TOP + 0.05, s.h - LID, B, front);
    // Lids: the fixed rear part, the hinge and the clear lid.
    const joint = B + s.d * REAR_LID;
    p.box("panel", -W, W, s.h - LID, s.h, B, joint);
    p.rod("handle", "x", 0, s.h - LID / 2, joint, s.w - 0.04, LID / 2);
    p.box("glass", -W, W, s.h - LID * 0.8, s.h - LID * 0.1, joint + LID / 2, front + GRIP * 0.4);
    // Moulded grip on the front and a label holder below it.
    const gy = s.h - 0.14;
    p.box("panel", -0.1, 0.1, gy - 0.02, gy + 0.02, front, s.d / 2);
    p.box("panelDark", -0.08, 0.08, gy - 0.12, gy - 0.06, front, front + 0.003);
  },
};
