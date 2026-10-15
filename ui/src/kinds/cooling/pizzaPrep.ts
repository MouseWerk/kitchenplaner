// Pizza prep counter (Pizzakühltisch): a refrigerated base with doors under a granite top, and a
// cooled topping rail of GN 1/3 pans along the back behind a glass sneeze guard.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { INSET } from "../parts/plan";
import type { MaterialId } from "../parts/mesh";
import type { KindDef } from "../types";
import { m } from "./common";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Height of the topping rail with its sneeze guard above the worktop (mm). */
const ABOVE_MM = 500;
/** Height of the pan rail above the worktop (mm), and its depth (GN 1/3 pans are 325 mm deep). */
const RAIL_MM = 160;
const RAIL_D_MM = 360;
/** Thickness of the granite top (mm). */
const GRANITE_MM = 30;
/** Width of a GN 1/3 pan across the rail with the bar between pans (mm). */
const PAN_MM = 185;
/** How far the toppings sit below the rail's top, and the frame bars between the pans (m). */
const FILL_DROP = 0.03;
const BAR = 0.01;
/** Toppings in the pans, in turn (cheese, mushrooms, olives, onions, ham, black olives). */
const TOPPINGS: readonly MaterialId[] = ["foodRed", "foodCream", "foodGreen", "foodBrown", "foodCream", "knob"];

const railDepth = (depth: number) => Math.min(RAIL_D_MM, depth * 0.5);
const panCount = (width: number) => Math.max(1, Math.floor((width - 2 * INSET) / PAN_MM));

export const pizzaPrep: KindDef = {
  kind: "pizzaPrep",
  plan(s) {
    counterPlan(s, "doors");
    const rd = railDepth(s.d);
    s.line("detail", [s.L, s.B + rd], [s.R, s.B + rd]);
    const n = panCount(s.w);
    const pw = (s.w - 2 * INSET) / n;
    for (let i = 0; i < n; i++) {
      const x = s.L + INSET + i * pw;
      s.rect("detail", x + INSET / 5, s.B + INSET, x + pw - INSET / 5, s.B + rd - INSET / 2);
    }
  },
  elevation(f) {
    const { l, r, top } = f;
    const work = top - ABOVE_MM;
    f.box("detail", l, r, work - GRANITE_MM, work, "item-dark");
    f.box("detail", l, r, work, work + RAIL_MM);
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, work + RAIL_MM, top, "glass");
    counterFrontElevation(f, "doors", work - GRANITE_MM);
  },
  mesh(p, s) {
    const work = s.h - m(ABOVE_MM);
    const granite = m(GRANITE_MM);
    counterBase(p, s, "doors", work - granite);
    p.box("top", -s.w / 2, s.w / 2, work - granite, work, -s.d / 2, s.d / 2);
    // The rail: a cooled block with the pans let into its top, toppings showing in them.
    const z0 = -s.d / 2;
    const z1 = z0 + m(railDepth(s.d * 1000));
    const y1 = work + m(RAIL_MM);
    p.box("steel", -s.w / 2, s.w / 2, work, y1 - FILL_DROP, z0, z1);
    p.box("steel", -s.w / 2, s.w / 2, y1 - FILL_DROP, y1, z0, z0 + 0.03);
    p.box("steel", -s.w / 2, s.w / 2, y1 - FILL_DROP, y1, z1 - 0.02, z1);
    const n = panCount(s.w * 1000);
    const x0 = -s.w / 2 + m(INSET);
    const pw = (s.w - 2 * m(INSET)) / n;
    p.box("steel", -s.w / 2, x0, y1 - FILL_DROP, y1, z0 + 0.03, z1 - 0.02);
    p.box("steel", s.w / 2 - m(INSET), s.w / 2, y1 - FILL_DROP, y1, z0 + 0.03, z1 - 0.02);
    for (let i = 0; i < n; i++) {
      const a = x0 + i * pw;
      if (i > 0) p.box("steel", a - BAR / 2, a + BAR / 2, y1 - BAR, y1, z0 + 0.03, z1 - 0.02);
      p.box(TOPPINGS[i % TOPPINGS.length], a + BAR / 2, a + pw - BAR / 2, y1 - FILL_DROP, y1 - FILL_DROP + 0.012, z0 + 0.03, z1 - 0.02);
    }
    // Sneeze guard: a front pane and a top shelf of glass between two posts.
    const post = 0.012;
    for (const x of [-s.w / 2 + post, s.w / 2 - post]) p.rod("steel", "y", x, (y1 + s.h) / 2, z1 - post, s.h - y1, post);
    p.box("glass", -s.w / 2 + post * 2, s.w / 2 - post * 2, y1 + 0.03, s.h - 0.01, z1 - post - 0.003, z1 - post + 0.003);
    p.box("glass", -s.w / 2, s.w / 2, s.h - 0.01, s.h, z0 + 0.05, z1);
  },
};
