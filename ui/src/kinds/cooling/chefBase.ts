// Refrigerated drawers under a cooking line (Kühlunterbau, chef base): a low refrigerated base
// with two drawers per section and a heavy top with a raised rim that carries a griddle, a range
// or a charcoal grill, at the height that brings their tops to working height. The heavy-duty
// one stands on castors, has a thicker insulated top and a heat shield along its front edge.

import { TOP as FRONT_TOP } from "../parts/elevation";
import { TOP_RADIUS, worktop, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Height and width of the rim round the top (m). */
const RIM_H = 0.012;
const RIM_W = 0.025;
/** Inset of the rim's inner edge in the plan (mm). */
const RIM_MM = RIM_W * 1000;
/** Thickness of the top that carries the appliances: normal and heavy duty (m). */
const SLAB = 0.05;
const SLAB_HEAVY = 0.07;
/** Height of the heat shield hanging in front of the top drawers of the heavy-duty base (m). */
const SHIELD = 0.06;

/**
 * The top: a slab and the rim all round, turned as one profile round the top's outline so it
 * reads as one pressed part with round corners.
 */
function rimmedTop(p: Parts, s: Size, slab: number): void {
  worktop(p, "steel", -s.w / 2, s.w / 2, s.h - slab, s.h - RIM_H + TOP_RADIUS, -s.d / 2, s.d / 2);
  const r = TOP_RADIUS;
  p.lathe(
    "steel",
    0,
    s.h - RIM_H,
    0,
    [
      [0, 0],
      [RIM_W, 0],
      [RIM_W, RIM_H - r],
      [RIM_W - r * 0.3, RIM_H - r * 0.3],
      [RIM_W - r, RIM_H],
      [r, RIM_H],
      [r * 0.3, RIM_H - r * 0.3],
      [0, RIM_H - r],
      [0, 0],
    ],
    { rect: [s.w / 2 - RIM_W, s.d / 2 - RIM_W] },
  );
}

function chefBaseKind(kind: string, heavy: boolean): KindDef {
  const slab = heavy ? SLAB_HEAVY : SLAB;
  return {
    kind,
    plan(s) {
      counterPlan(s, "drawers");
      s.rect("detail", s.L + RIM_MM, s.B + RIM_MM, s.R - RIM_MM, s.F - RIM_MM);
      if (heavy) s.line("detail", [s.L + INSET, s.F - RIM_MM / 2], [s.R - INSET, s.F - RIM_MM / 2]);
    },
    elevation(f) {
      const top = heavy ? slab * 1000 : FRONT_TOP;
      f.box("detail", f.l, f.r, f.top - top, f.top);
      if (heavy) f.line("detail", [f.l, f.top - top - SHIELD * 1000], [f.r, f.top - top - SHIELD * 1000]);
      counterFrontElevation(f, "drawers", f.top - top - (heavy ? SHIELD * 1000 : 0), false, heavy);
    },
    mesh(p, s) {
      const y0 = s.h - slab;
      counterBase(p, s, "drawers", heavy ? y0 - SHIELD : y0, false, y0, heavy);
      rimmedTop(p, s, slab);
      if (heavy) {
        // The heat shield: a folded sheet under the top's front edge keeps the radiant heat of
        // the appliance above off the drawer fronts.
        const z1 = s.d / 2;
        p.extrude("steel", "x", -s.w / 2 + 0.002, s.w / 2 - 0.002, [
          [z1 - 0.06, y0 - 0.004],
          [z1 - 0.003, y0 - 0.004],
          [z1, y0 - 0.007],
          [z1, y0 - SHIELD + 0.004],
          [z1 - 0.003, y0 - SHIELD],
          [z1 - 0.012, y0 - SHIELD],
          [z1 - 0.012, y0 - 0.016],
          [z1 - 0.06, y0 - 0.016],
        ]);
      }
    },
  };
}

export const chefBase = chefBaseKind("chefBase", false);
export const chefBaseHeavy = chefBaseKind("chefBaseHeavy", true);
