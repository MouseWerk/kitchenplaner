// Saladette (prep counter): a refrigerated base with doors, a cutting board on the worktop and a
// cooled rail of GN 1/3 pans along the back under a hinged lid that slopes down to the front, with
// the grip along its front edge.

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { TOP, TOP_RADIUS, worktop } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { m } from "./common";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Height of the pan rail with its closed lid above the worktop (mm). */
const RAIL_MM = 230;
/** Height of the rail's front wall above the worktop, where the lid's front edge rests (mm). */
const RAIL_FRONT_MM = 110;
/** Depth of the pan rail (mm, a GN 1/3 pan is 325 mm deep, plus the frame). */
const RAIL_D_MM = 360;
/** Thickness of the lid sheet and of the cutting board, and how far the lid overhangs (m). */
const LID = 0.012;
const BOARD = 0.015;
const OVERHANG = 0.025;
/** Radius and length of a hinge barrel along the lid's back edge (m). */
const HINGE = 0.009;
const HINGE_L = 0.06;
/** Depth of the lid's folded front edge (the grip) and its sheet (m). */
const LIP = 0.025;
const LIP_T = 0.006;
/** Width of a GN 1/3 pan across the rail (mm, 176 mm plus the bar between pans). */
const PAN_MM = 185;

const railDepth = (depth: number) => Math.min(RAIL_D_MM, depth * 0.55);

export const saladette: KindDef = {
  kind: "saladette",
  plan(s) {
    counterPlan(s, "doors");
    const rd = railDepth(s.d);
    // The lid's front edge, a little in front of the rail.
    s.line("detail", [s.L, s.B + rd + OVERHANG * 1000], [s.R, s.B + rd + OVERHANG * 1000]);
    // The pans under the closed lid, dashed.
    const n = Math.max(1, Math.floor((s.w - 2 * INSET) / PAN_MM));
    const pw = (s.w - 2 * INSET) / n;
    for (let i = 0; i < n; i++) {
      const x = s.L + INSET + i * pw;
      s.rect("hidden", x + INSET / 5, s.B + INSET, x + pw - INSET / 5, s.B + rd - INSET / 2);
    }
    // The cutting board in front of the rail.
    s.rect("detail", s.L + INSET / 2, s.B + rd + INSET, s.R - INSET / 2, s.F - INSET);
  },
  elevation(f) {
    const { l, r, top } = f;
    const work = top - RAIL_MM;
    const front = work + RAIL_FRONT_MM;
    f.box("detail", l, r, work - FRONT_TOP, work);
    // The rail's front wall under the lid, and the lid seen sloping back from its front edge.
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, work, front - LID * 1000);
    f.box("detail", l, r, front - LID * 1000, top);
    f.line("detail", [l + FRONT_INSET, front - LID * 2000], [r - FRONT_INSET, front - LID * 2000]);
    counterFrontElevation(f, "doors", work - FRONT_TOP);
  },
  mesh(p, s) {
    const work = s.h - m(RAIL_MM);
    counterBase(p, s, "doors", work - TOP);
    worktop(p, "steel", -s.w / 2, s.w / 2, work - TOP, work, -s.d / 2, s.d / 2);
    const zb = -s.d / 2;
    const rf = zb + m(railDepth(s.d * 1000));
    // The lid's underside runs from its front edge on the rail's front wall up to the back.
    const yF = work + m(RAIL_FRONT_MM);
    const yB = s.h - LID * 1.5;
    const zF = rf + OVERHANG;
    const zB = zb + LID;
    const under = (z: number) => yF + ((yB - yF) * (zF - z)) / (zF - zB);
    // The housing under the lid: the rail's front wall and its sloping top, set in at the ends
    // and starting a hair inside the worktop's rounded edge.
    const ends = 0.015;
    const y0 = work - TOP_RADIUS;
    p.extrude("steel", "x", -s.w / 2 + ends, s.w / 2 - ends, [
      [zb + 0.002, y0],
      [rf, y0],
      [rf, under(rf) - 0.002],
      [zb + 0.002, under(zb + 0.002) - 0.002],
    ]);
    // The lid: a sheet sloping from the hinge at the back down to the front, its front edge
    // folded down into a grip.
    p.extrude("steel", "x", -s.w / 2 + 0.004, s.w / 2 - 0.004, [
      [zB, yB],
      [zF - LIP_T, yF],
      [zF - LIP_T, yF - LIP],
      [zF - LIP_T / 3, yF - LIP],
      [zF, yF - LIP + LIP_T],
      [zF, yF + LID],
      [zB, yB + LID],
    ]);
    // Hinge barrels along the back edge, and the grip recess under the lid's front edge.
    for (const x of [-s.w / 2 + 0.08, s.w / 2 - 0.08 - HINGE_L]) {
      p.lathe(
        "satin",
        x,
        s.h - HINGE,
        zb + HINGE,
        [
          [0, 0],
          [HINGE * 0.8, 0],
          [HINGE, HINGE * 0.3],
          [HINGE, HINGE_L - HINGE * 0.3],
          [HINGE * 0.8, HINGE_L],
          [0, HINGE_L],
        ],
        { axis: "x" },
      );
    }
    p.box("slot", -s.w / 2 + 0.06, s.w / 2 - 0.06, yF - LIP + 0.004, yF - 0.002, zF - LIP_T - 0.001, zF - LIP_T);
    // Polyethylene cutting board on the worktop in front of the rail.
    p.roundedBox("panel", -s.w / 2 + 0.025, s.w / 2 - 0.025, work - 0.001, work + BOARD, zF + 0.02, s.d / 2 - 0.04, TOP_RADIUS);
  },
};
