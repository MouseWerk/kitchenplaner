// Refrigerated drawers under a cooking line (Kühlunterbau, chef base): a low refrigerated base
// with two drawers per section and a heavy top with a raised rim that carries a griddle, a range
// or a charcoal grill, at the height that brings their tops to working height.

import { TOP as FRONT_TOP } from "../parts/elevation";
import type { KindDef } from "../types";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Thickness of the top that carries the appliances, and height and width of its rim (m). */
const SLAB = 0.05;
const RIM_H = 0.012;
const RIM_W = 0.025;
/** Inset of the rim's inner edge in the plan (mm). */
const RIM_MM = RIM_W * 1000;

export const chefBase: KindDef = {
  kind: "chefBase",
  plan(s) {
    counterPlan(s, "drawers");
    s.rect("detail", s.L + RIM_MM, s.B + RIM_MM, s.R - RIM_MM, s.F - RIM_MM);
  },
  elevation(f) {
    f.worktop();
    counterFrontElevation(f, "drawers", f.top - FRONT_TOP);
  },
  mesh(p, s) {
    const y0 = s.h - SLAB;
    counterBase(p, s, "drawers", y0);
    p.box("steel", -s.w / 2, s.w / 2, y0, s.h - RIM_H, -s.d / 2, s.d / 2);
    // The rim keeps spills and the appliances' feet on the top: all round, as a marine edge.
    p.box("steel", -s.w / 2, s.w / 2, s.h - RIM_H, s.h, s.d / 2 - RIM_W, s.d / 2);
    p.box("steel", -s.w / 2, s.w / 2, s.h - RIM_H, s.h, -s.d / 2, -s.d / 2 + RIM_W);
    p.box("steel", -s.w / 2, -s.w / 2 + RIM_W, s.h - RIM_H, s.h, -s.d / 2 + RIM_W, s.d / 2 - RIM_W);
    p.box("steel", s.w / 2 - RIM_W, s.w / 2, s.h - RIM_H, s.h, -s.d / 2 + RIM_W, s.d / 2 - RIM_W);
  },
};
