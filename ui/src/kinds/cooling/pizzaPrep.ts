// Pizza prep counter (Pizzakühltisch): a refrigerated base with doors under a granite top, and a
// cooled topping rail of GN 1/3 pans along the back behind a glass sneeze guard.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { INSET } from "../parts/plan";
import { BODY_RADIUS, GN_RADIUS, roundedRectOutline, TOP_RADIUS, worktop, type MaterialId, type Point2 } from "../parts/mesh";
import type { KindDef } from "../types";
import { gnPan, m } from "./common";
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
/** How far the toppings sit below the rail's top, the deck between the pans, and the pans' depth (m). */
const FILL_DROP = 0.03;
const BAR = 0.012;
const DECK = 0.012;
const PAN_DEPTH = 0.15;
/** Width of a sneeze guard post in the elevation (mm). */
const POST_MM = 20;
/** Height of the sneeze guard's front pane above the rail (m). */
const GUARD = 0.14;
/** Depth of the glass top shelf over the front of the rail (m): the pans behind it stay open to reach. */
const SHELF_D = 0.16;
/** Toppings in the pans, in turn (tomato, cheese, peppers, mushrooms, onions, salami). */
const TOPPINGS: readonly MaterialId[] = ["foodRed", "foodCream", "foodGreen", "foodBrown", "foodCream", "foodBrown"];

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
    // The posts, the low front pane and the glass top shelf of the sneeze guard.
    const g = work + RAIL_MM;
    f.box("detail", l, l + POST_MM, g, top);
    f.box("detail", r - POST_MM, r, g, top);
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, g + 20, g + GUARD * 1000, "glass");
    f.box("detail", l + POST_MM, r - POST_MM, top - 2 * POST_MM - 8, top - 2 * POST_MM, "glass");
    counterFrontElevation(f, "doors", work - GRANITE_MM);
  },
  mesh(p, s) {
    const work = s.h - m(ABOVE_MM);
    const granite = m(GRANITE_MM);
    counterBase(p, s, "doors", work - granite);
    worktop(p, "granite", -s.w / 2, s.w / 2, work - granite, work, -s.d / 2, s.d / 2);
    // The rail: a cooled housing standing on the granite with a deck on top, the GN 1/3 pans let
    // into the deck with the toppings in them.
    const z0 = -s.d / 2;
    const z1 = z0 + m(railDepth(s.d * 1000));
    const y1 = work + m(RAIL_MM);
    const n = panCount(s.w * 1000);
    const x0 = -s.w / 2 + m(INSET);
    const pw = (s.w - 2 * m(INSET)) / n;
    const pz0 = z0 + 0.025;
    const pz1 = z1 - 0.02;
    // The housing is solid up to the pans' floors; above, its walls stand round the pans.
    const yp = y1 - PAN_DEPTH - 0.002;
    p.roundedBox("steel", -s.w / 2, s.w / 2, work - TOP_RADIUS, yp, z0, z1, BODY_RADIUS, "vertical");
    for (const [a, b] of [[z0, pz0], [pz1, z1]]) p.roundedBox("steel", -s.w / 2, s.w / 2, yp - 0.001, y1 - DECK, a, b, BODY_RADIUS, "vertical");
    for (const [a, b] of [[-s.w / 2, x0], [s.w / 2 - m(INSET), s.w / 2]]) p.box("steel", a + 0.001, b - 0.001, yp - 0.001, y1 - DECK, pz0, pz1);
    const holes: Point2[][] = [];
    for (let i = 0; i < n; i++) {
      const a = x0 + i * pw + BAR / 2;
      const b = x0 + (i + 1) * pw - BAR / 2;
      holes.push(roundedRectOutline(a, b, pz0, pz1, GN_RADIUS));
      gnPan(p, a + 0.0005, b - 0.0005, y1 - PAN_DEPTH, y1 + 0.001, pz0 + 0.0005, pz1 - 0.0005, TOPPINGS[i % TOPPINGS.length], FILL_DROP);
    }
    p.extrude(
      "steel",
      "y",
      y1 - DECK,
      y1,
      [
        [-s.w / 2 + 0.002, z0 + 0.002],
        [s.w / 2 - 0.002, z0 + 0.002],
        [s.w / 2 - 0.002, z1 - 0.002],
        [-s.w / 2 + 0.002, z1 - 0.002],
      ],
      holes,
    );
    // Sneeze guard: two bent posts carrying a low front pane and a narrow glass top shelf.
    const post = 0.012;
    const zp = z1 - post;
    for (const x of [-s.w / 2 + post, s.w / 2 - post]) {
      p.tube(
        "satin",
        [
          { x, y: y1, z: zp },
          { x, y: s.h - post * 0.8, z: zp },
          { x, y: s.h - post * 0.8, z: zp - SHELF_D },
        ],
        post * 0.8,
        { bend: 0.04 },
      );
    }
    // The front pane only reaches up to the hands; above it the toppings are reached under the
    // top shelf.
    p.plate("glass", -s.w / 2 + post * 2.5, s.w / 2 - post * 2.5, y1 + 0.02, y1 + GUARD, zp - 0.004, zp + 0.004, 0.006);
    p.plate("glass", -s.w / 2 + post * 2, s.w / 2 - post * 2, s.h - post * 2 - 0.008, s.h - post * 2, zp - SHELF_D, zp - post, 0.006);
  },
};
