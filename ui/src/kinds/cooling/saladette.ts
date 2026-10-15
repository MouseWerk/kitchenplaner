// Saladette (prep counter): a refrigerated base with doors, a cutting board on the worktop and a
// cooled rail of GN 1/3 pans along the back under a hinged lid that slopes down to the front, with
// the grip along its front edge.

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { TOP } from "../parts/mesh";
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
/** Radius of the hinge bar along the lid's back edge (m). */
const HINGE = 0.009;
/** Steps of the housing under the sloping lid (its sides, set back under the lid). */
const STEPS = 6;
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
    p.box("steel", -s.w / 2, s.w / 2, work - TOP, work, -s.d / 2, s.d / 2);
    const zb = -s.d / 2;
    const rf = zb + m(railDepth(s.d * 1000));
    // The lid's underside runs from its front edge on the rail's front wall up to the back.
    const yF = work + m(RAIL_FRONT_MM);
    const yB = s.h - LID * 1.5;
    const zF = rf + OVERHANG;
    const zB = zb + LID;
    // The housing under the lid: the front wall and steps rising to the back, set in at the ends.
    const ends = 0.015;
    const run = rf - zb;
    for (let i = 0; i < STEPS; i++) {
      const z1 = rf - (run * i) / STEPS;
      const z0 = rf - (run * (i + 1)) / STEPS;
      const y = yF + ((yB - yF) * (zF - z1)) / (zF - zB) - LID / 2;
      p.box("steel", -s.w / 2 + ends, s.w / 2 - ends, work, Math.max(work + 0.01, y), z0, z1);
    }
    // The lid: one sheet sloping from the back down to its front edge.
    const dz = zF - zB;
    const dy = yB - yF;
    const len = Math.hypot(dz, dy);
    const lid = p.box("steel", -s.w / 2 + 0.005, s.w / 2 - 0.005, -LID / 2, LID / 2, -len / 2, len / 2);
    lid.rotation.x = Math.atan2(dy, dz);
    lid.position.set(0, (yF + yB) / 2 + LID / 2, (zF + zB) / 2);
    // Hinge along the back (the top of the unit) and the grip bar along the lid's front edge.
    p.rod("steelDark", "x", 0, s.h - HINGE, zb + HINGE, s.w - 0.06, HINGE);
    p.rod("handle", "x", 0, yF - 0.004, zF - 0.008, s.w * 0.8, 0.008);
    // Polyethylene cutting board on the worktop in front of the rail.
    p.box("panel", -s.w / 2 + 0.025, s.w / 2 - 0.025, work, work + BOARD, zF + 0.02, s.d / 2 - 0.04);
  },
};
