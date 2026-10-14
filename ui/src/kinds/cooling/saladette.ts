// Saladette (prep counter): a refrigerated base with doors, a cutting board on the worktop and a
// cooled rail of GN 1/3 pans along the back under a hinged lid.

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { m } from "./common";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Height of the pan rail with its closed lid above the worktop (mm). */
const RAIL_MM = 230;
/** Depth of the pan rail (mm, a GN 1/3 pan is 325 mm deep, plus the frame). */
const RAIL_D_MM = 360;
/** Thickness of the lid (mm) and of the cutting board (m). */
const LID_MM = 50;
const BOARD = 0.015;
/** Width of a GN 1/3 pan across the rail (mm, 176 mm plus the bar between pans). */
const PAN_MM = 185;

const railDepth = (depth: number) => Math.min(RAIL_D_MM, depth * 0.55);

export const saladette: KindDef = {
  kind: "saladette",
  plan(s) {
    counterPlan(s, "doors");
    const rd = railDepth(s.d);
    s.line("detail", [s.L, s.B + rd], [s.R, s.B + rd]);
    // The pans under the closed lid, dashed.
    const n = Math.max(1, Math.floor((s.w - 2 * INSET) / PAN_MM));
    const pw = (s.w - 2 * INSET) / n;
    for (let i = 0; i < n; i++) {
      const x = s.L + INSET + i * pw;
      s.rect("hidden", x + INSET / 5, s.B + INSET, x + pw - INSET / 5, s.B + rd - INSET / 2);
    }
    // The cutting board in front of the rail.
    s.rect("detail", s.L + INSET / 2, s.B + rd + INSET / 2, s.R - INSET / 2, s.F - INSET);
  },
  elevation(f) {
    const { l, r, top } = f;
    const work = top - RAIL_MM;
    f.box("detail", l, r, work - FRONT_TOP, work);
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, work, top - LID_MM);
    f.box("detail", l, r, top - LID_MM, top);
    counterFrontElevation(f, "doors", work - FRONT_TOP);
  },
  mesh(p, s) {
    const work = s.h - m(RAIL_MM);
    counterBase(p, s, "doors", work - TOP);
    p.box("steel", -s.w / 2, s.w / 2, work - TOP, work, -s.d / 2, s.d / 2);
    const rf = -s.d / 2 + m(railDepth(s.d * 1000));
    const lid = m(LID_MM);
    // The rail stands a little in from the ends; the lid overhangs it to the front.
    p.box("steel", -s.w / 2 + 0.02, s.w / 2 - 0.02, work, s.h - lid, -s.d / 2, rf);
    p.box("steel", -s.w / 2 + 0.01, s.w / 2 - 0.01, s.h - lid, s.h, -s.d / 2, rf + 0.02);
    // Grip bar under the lid's front edge.
    p.rod("handle", "x", 0, s.h - lid - 0.008, rf + 0.012, Math.min(0.3, s.w * 0.4), 0.008);
    // Polyethylene cutting board on the worktop in front of the rail.
    p.box("panel", -s.w / 2 + 0.025, s.w / 2 - 0.025, work, work + BOARD, rf + 0.04, s.d / 2 - 0.04);
  },
};
