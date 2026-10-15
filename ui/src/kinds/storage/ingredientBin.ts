// Mobile ingredient bin (Zutatenwagen) for flour, sugar or rice: a food-safe plastic tub on
// swivel castors with a fixed rear lid and a clear lid hinged towards the front.

import { INSET } from "../parts/elevation";
import { castor } from "../parts/mesh";
import type { KindDef } from "../types";
import { invertedTray } from "./helpers";

// Construction sizes (m).
/** Castor wheel radius and the top of its mounting plate. */
const WHEEL = 0.035;
const CASTOR_TOP = 0.09;
/** Thickness of the lids and the share of the depth the fixed rear lid covers. */
const LID = 0.025;
const REAR_LID = 0.3;
/** Depth of the front grip standing out of the tub. */
const GRIP = 0.025;
/** Wall of the moulded tub and the radius of its corners seen from above. */
const TUB_WALL = 0.006;
const TUB_RADIUS = 0.05;

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
    // The moulded tub with its large round corners, open at the top under the lids.
    p.pan("panel", -W, W, CASTOR_TOP, s.h - LID, B, front, { wall: TUB_WALL, r: TUB_RADIUS });
    // Flour in the tub, seen through the clear lid.
    p.roundedBox("foodCream", -W + TUB_WALL * 2, W - TUB_WALL * 2, CASTOR_TOP + 0.02, s.h - LID - 0.08, B + TUB_WALL * 2, front - TUB_WALL * 2, 0.03, "vertical");
    // Lids: the fixed rear part, the hinge and the clear lid over the front.
    const joint = B + s.d * REAR_LID;
    invertedTray(p, "panel", -W, W, s.h - LID, s.h, B, joint, 0.004, TUB_RADIUS);
    p.rod("satin", "x", 0, s.h - LID / 2, joint + 0.004, s.w - 0.08, 0.006);
    invertedTray(p, "glass", -W, W, s.h - LID, s.h - 0.003, joint + 0.012, front + GRIP * 0.4, 0.003, TUB_RADIUS);
    // Moulded grip on the front: a bent bar on two bosses, and a label holder below it.
    const gy = s.h - 0.14;
    p.tube("panel", [
      { x: -0.1, y: gy, z: front - 0.002 },
      { x: -0.1, y: gy, z: s.d / 2 - 0.012 },
      { x: 0.1, y: gy, z: s.d / 2 - 0.012 },
      { x: 0.1, y: gy, z: front - 0.002 },
    ], 0.012, { bend: 0.012 });
    p.plate("panelDark", -0.08, 0.08, gy - 0.12, gy - 0.06, front - 0.001, front + 0.002, 0.006);
  },
};
