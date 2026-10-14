// Tall store cabinet (Vorratsschrank): a stainless cabinet on adjustable feet with hinged doors
// and ventilation slots at the top and bottom of each door.

import { doorCount, FEET, INSET } from "../parts/elevation";
import { DOOR, DOOR_WIDTH, doors, plinth, PLINTH, SHEET } from "../parts/mesh";
import { INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Ventilation slots per door at the top and at the bottom: count, height and pitch (m). */
const SLOTS = 4;
const SLOT_H = 0.008;
const SLOT_PITCH = 0.02;

export const tallCabinet: KindDef = {
  kind: "tallCabinet",
  plan(s) {
    // Closed doors and their swings, hinges at the outer edges.
    const n = doorCount(s.w);
    const leaf = s.w / n;
    s.line("detail", [s.L, s.F - PLAN_INSET / 2], [s.R, s.F - PLAN_INSET / 2]);
    if (n === 1) s.quarter("hidden", s.L, s.F, leaf, 0);
    else {
      s.quarter("hidden", s.L, s.F, leaf, 0);
      s.quarter("hidden", s.R, s.F, leaf, 90);
    }
  },
  elevation(f) {
    const n = doorCount(f.w);
    f.doors(n, f.z0 + FEET, f.top - INSET / 2);
    const dw = (f.w - INSET * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const a = f.l + INSET + i * (dw + INSET) + dw * 0.25;
      const b = a + dw * 0.5;
      for (const z of [f.top - INSET * 2.5, f.z0 + FEET + INSET * 1.5]) f.line("detail", [a, z], [b, z]);
    }
  },
  mesh(p, s) {
    plinth(p, s.w, s.d);
    p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, s.d / 2 - DOOR);
    const n = Math.max(1, Math.round(s.w / DOOR_WIDTH));
    doors(p, -s.w / 2, s.w / 2, PLINTH, s.h, s.d, n, "vertical");
    const zFace = s.d / 2 - DOOR / 2;
    const dw = s.w / n;
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + i * dw + dw * 0.25;
      const x1 = x0 + dw * 0.5;
      for (let k = 0; k < SLOTS; k++) {
        for (const y of [s.h - 0.06 - k * SLOT_PITCH, PLINTH + 0.05 + k * SLOT_PITCH]) {
          p.box("panelDark", x0, x1, y - SLOT_H / 2, y + SLOT_H / 2, zFace, zFace + SHEET / 5);
        }
      }
    }
  },
};
