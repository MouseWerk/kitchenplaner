// Induction range: a black glass ceramic top in a stainless frame with printed zones, over an
// oven (`induction`) or an open base (`inductionOpen`). Two zones front to back per 400 mm.

import { SHEET, worktop } from "../parts/mesh";
import { CONTROL_STRIP, hob, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule, PROUD, zones, type LineBase } from "./common";

/** Thickness of the top with the glass ceramic in it (m). */
const TOP_SHEET = 0.03;
/** Width of the stainless frame around the glass (m). */
const FRAME = 0.03;
/** Edge radius of the glass ceramic, and how far the printed marks stand on it (m). */
const GLASS_EDGE = 0.003;
const PRINT = 0.001;
/** Distance of the front edge of the glass from the front (m), at the control strip line of the plan. */
const GLASS_FRONT = (CONTROL_STRIP - INSET) / 1000;

function makeInduction(kind: string, base: LineBase): KindDef {
  const oven = base === "oven" ? 1 : 0;
  return {
    kind,
    plan(s) {
      // Round zones as in 3D (the printed rings on the glass), inside the outline of the glass.
      hob(s, columns(s.w), true);
      const f = FRAME * 1000;
      s.rect("detail", s.L + f, s.B + f, s.R - f, s.F - GLASS_FRONT * 1000);
    },
    elevation(f) {
      lineFront(f, columns(f.w) * 2 + oven, base);
    },
    mesh(p, s) {
      const cols = columns(s.w, 0.4);
      const frameTop = s.h - PROUD * 2;
      lineModule(p, s, { base, knobs: cols * 2 + oven, underTop: frameTop - TOP_SHEET });
      worktop(p, "steel", -s.w / 2, s.w / 2, frameTop - TOP_SHEET, frameTop, -s.d / 2, s.d / 2);
      // The glass lies in the frame, a little proud of it, its edges ground round.
      const g = { x0: -s.w / 2 + FRAME, x1: s.w / 2 - FRAME, z0: -s.d / 2 + FRAME, z1: s.d / 2 - GLASS_FRONT };
      const glassTop = s.h - PRINT;
      p.roundedBox("ceramic", g.x0, g.x1, frameTop - SHEET, glassTop, g.z0, g.z1, GLASS_EDGE);
      // Printed on the glass: a ring and a small cross per zone, and a touch slider in front of
      // each column of zones.
      for (const z of zones(s, cols, 2)) {
        p.lathe("zone", z.x, glassTop, z.z, [
          [z.r * 0.9, 0],
          [z.r, 0],
          [z.r, PRINT],
          [z.r * 0.9, PRINT],
          [z.r * 0.9, 0],
        ]);
        p.box("zone", z.x - z.r * 0.12, z.x + z.r * 0.12, glassTop, s.h, z.z - 0.001, z.z + 0.001);
        p.box("zone", z.x - 0.001, z.x + 0.001, glassTop, s.h, z.z - z.r * 0.12, z.z + z.r * 0.12);
      }
      const cw = (g.x1 - g.x0) / cols;
      for (let c = 0; c < cols; c++) {
        const cx = g.x0 + cw * (c + 0.5);
        p.roundedBox("zone", cx - cw * 0.3, cx + cw * 0.3, glassTop, s.h, g.z1 - 0.035, g.z1 - 0.025, 0.004, "vertical");
      }
    },
  };
}

export const induction = makeInduction("induction", "oven");
export const inductionOpen = makeInduction("inductionOpen", "open");
