// Induction range: a black glass ceramic top in a stainless frame with printed zones, over an
// oven (`induction`) or an open base (`inductionOpen`). Two zones front to back per 400 mm.

import { SHEET } from "../parts/mesh";
import { hob } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule, PROUD, zones, type LineBase } from "./common";

/** Thickness of the top with the glass ceramic in it (m). */
const TOP_SHEET = 0.03;
/** Width of the stainless frame around the glass (m). */
const FRAME = 0.03;

function makeInduction(kind: string, base: LineBase): KindDef {
  const oven = base === "oven" ? 1 : 0;
  return {
    kind,
    plan(s) {
      hob(s, columns(s.w), false);
    },
    elevation(f) {
      lineFront(f, columns(f.w) * 2 + oven, base);
    },
    mesh(p, s) {
      const cols = columns(s.w, 0.4);
      const frameTop = s.h - PROUD * 2;
      lineModule(p, s, { base, knobs: cols * 2 + oven, underTop: frameTop - TOP_SHEET });
      p.box("steel", -s.w / 2, s.w / 2, frameTop - TOP_SHEET, frameTop, -s.d / 2, s.d / 2);
      // The glass lies in the frame, a little proud of it.
      const g = { x0: -s.w / 2 + FRAME, x1: s.w / 2 - FRAME, z0: -s.d / 2 + FRAME, z1: s.d / 2 - FRAME * 2 };
      const glassTop = s.h - PROUD;
      p.box("ceramic", g.x0, g.x1, frameTop - SHEET, glassTop, g.z0, g.z1);
      // Printed zone rings: a light disc with the black glass again inside it, each a step higher.
      for (const z of zones(s, cols, 2)) {
        p.cyl("zone", z.x, z.z, glassTop - SHEET, s.h - PROUD / 2, z.r);
        p.cyl("ceramic", z.x, z.z, glassTop - SHEET, s.h, z.r * 0.9);
      }
    },
  };
}

export const induction = makeInduction("induction", "oven");
export const inductionOpen = makeInduction("inductionOpen", "open");
