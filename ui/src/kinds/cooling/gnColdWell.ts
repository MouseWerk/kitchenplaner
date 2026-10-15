// Refrigerated GN well (Kühlwanne): a cooled well for GN 1/1 containers let into the worktop of a
// refrigerated base, for cold buffets, salad bars and the cold side of a pass. GN 1/1 containers
// lie across the well (800 mm = 2, 1200 mm = 3, 1600 mm = 4).

import { TOP as FRONT_TOP } from "../parts/elevation";
import { SHEET, TOP, type MaterialId } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CABINET_RADIUS, display, displayFront, FRONT, gnPan, m } from "./common";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Width of a GN 1/1 container lying across (325 mm) with its share of the frame (mm). */
const GN_MM = 340;
/** GN 1/1 length front to back (mm), and the depth of the well (mm, 150 mm containers). */
const GN_LENGTH_MM = 530;
const WELL_DEPTH_MM = 200;
/** Margin of the well from the ends of the worktop (mm). */
const MARGIN_MM = 60;
/** Depth of a GN 1/1 container (m, 150 mm), and how far the food stands below the top. */
const PAN_DEPTH = 0.15;
const FILL_DROP = 0.045;
/** Bars between the containers that carry their rims (m). */
const BAR = 0.012;
/** Food in the containers, in turn (potato salad, yoghurt dressing, olives). */
const FOOD: readonly MaterialId[] = ["foodGreen", "foodCream", "foodRed"];

const gnCount = (width: number) => Math.max(1, Math.floor((width - 2 * MARGIN_MM) / GN_MM));

/** The well opening in the item frame (mm): centred across the width, behind the front edge. */
function well(width: number, depth: number) {
  const n = gnCount(width);
  const w = Math.min(n * GN_MM, width - 2 * MARGIN_MM);
  const d = Math.min(GN_LENGTH_MM + 20, depth - 2 * MARGIN_MM);
  const front = depth / 2 - MARGIN_MM - INSET;
  return { n, x0: -w / 2, x1: w / 2, y0: front - d, y1: front };
}

export const gnColdWell: KindDef = {
  kind: "gnColdWell",
  plan(s) {
    counterPlan(s, "doors");
    const o = well(s.w, s.d);
    s.rect("detail", o.x0, o.y0, o.x1, o.y1);
    const cw = (o.x1 - o.x0) / o.n;
    for (let i = 1; i < o.n; i++) s.line("detail", [o.x0 + i * cw, o.y0], [o.x0 + i * cw, o.y1]);
  },
  elevation(f) {
    f.worktop();
    const o = well(f.w, f.item.depth);
    const c = (f.l + f.r) / 2;
    f.box("hidden", c + o.x0, c + o.x1, f.top - WELL_DEPTH_MM, f.top - FRONT_TOP);
    counterFrontElevation(f, "doors", f.top - FRONT_TOP);
  },
  mesh(p, s) {
    const top = s.h - TOP;
    const o = well(s.w * 1000, s.d * 1000);
    const x0 = m(o.x0);
    const x1 = m(o.x1);
    const z0 = m(o.y0);
    const z1 = m(o.y1);
    const floor = s.h - m(WELL_DEPTH_MM);
    // The base's body stops under the well; the insulation around the well fills up to the top.
    counterBase(p, s, "doors", top, false, floor);
    const zBody = s.d / 2 - FRONT;
    p.box("steel", -s.w / 2, x0, floor, top, -s.d / 2, zBody);
    p.box("steel", x1, s.w / 2, floor, top, -s.d / 2, zBody);
    p.box("steel", x0, x1, floor, top, -s.d / 2, z0);
    p.box("steel", x0, x1, floor, top, z1, zBody);
    p.topWithHoles("steel", s.w, s.d, top, s.h, [{ x0, x1, z0, z1 }]);
    p.tub("steelDark", x0, x1, floor, s.h, z0, z1);
    // The containers hang in the well by their rims, on bars between them; food in each.
    const cw = (x1 - x0) / o.n;
    for (let i = 0; i < o.n; i++) {
      const a = x0 + i * cw;
      if (i > 0) p.roundedBox("steel", a - BAR / 2, a + BAR / 2, s.h - BAR, s.h - 0.001, z0 + 0.001, z1 - 0.001, 0.002);
      const ca = a + (i > 0 ? BAR / 2 : SHEET) + 0.001;
      const cb = a + cw - (i < o.n - 1 ? BAR / 2 : SHEET) - 0.001;
      gnPan(p, ca, cb, s.h - PAN_DEPTH, s.h, z0 + SHEET + 0.001, z1 - SHEET - 0.001, FOOD[i % FOOD.length], FILL_DROP);
    }
  },
};

/** Width of the drop-in well's flange that rests on the counter, and its thickness (mm). */
const FLANGE_MM = 40;
const FLANGE_T_MM = 10;

/**
 * Drop-in cold well (Einbau-Kühlwanne): the cooled well with its insulated box, built into the
 * top of a counter or a buffet. It hangs in the counter's cut-out by its flange, which stands 10
 * mm over the counter top; the controls sit in the box's front under the flange.
 */
export const gnColdWellDropIn: KindDef = {
  kind: "gnColdWellDropIn",
  placement: "tableTop",
  plan(s) {
    const o = dropInWell(s.w, s.d);
    s.rect("detail", o.x0, o.y0, o.x1, o.y1);
    const cw = (o.x1 - o.x0) / o.n;
    for (let i = 1; i < o.n; i++) s.line("detail", [o.x0 + i * cw, o.y0], [o.x0 + i * cw, o.y1]);
  },
  elevation(f) {
    f.line("detail", [f.l, f.top - FLANGE_T_MM], [f.r, f.top - FLANGE_T_MM]);
    f.line("detail", [f.l + FLANGE_MM, f.top - FLANGE_T_MM], [f.l + FLANGE_MM, f.z0]);
    f.line("detail", [f.r - FLANGE_MM, f.top - FLANGE_T_MM], [f.r - FLANGE_MM, f.z0]);
    displayFront(f, f.r - FLANGE_MM - 110, f.top - FLANGE_T_MM - 50);
  },
  mesh(p, s) {
    const o = dropInWell(s.w * 1000, s.d * 1000);
    const x0 = m(o.x0);
    const x1 = m(o.x1);
    const z0 = m(o.y0);
    const z1 = m(o.y1);
    const fl = m(FLANGE_MM);
    const top = s.h - m(FLANGE_T_MM);
    const floor = s.h - m(WELL_DEPTH_MM);
    // The insulated box under the flange, the drain under the well's floor.
    const bx0 = -s.w / 2 + fl;
    const bx1 = s.w / 2 - fl;
    const bz0 = -s.d / 2 + fl;
    const bz1 = s.d / 2 - fl;
    p.roundedBox("steel", bx0, bx1, 0.03, floor, bz0, bz1, CABINET_RADIUS, "vertical");
    // Round the well the box rises to the flange: its walls, open over the well.
    for (const [x0w, x1w] of [[bx0, x0], [x1, bx1]]) p.roundedBox("steel", x0w, x1w, floor - 0.001, top + 0.001, bz0, bz1, CABINET_RADIUS, "vertical");
    p.box("steel", x0, x1, floor - 0.001, top + 0.001, bz0, z0);
    p.box("steel", x0, x1, floor - 0.001, top + 0.001, z1, bz1);
    p.tube("satin", [
      { x: 0, y: 0.03, z: 0 },
      { x: 0, y: 0, z: 0 },
    ], 0.012);
    display(p, s.w / 2 - fl - 0.14, top - 0.05, s.d / 2 - fl);
    p.topWithHoles("steel", s.w, s.d, top, s.h, [{ x0, x1, z0, z1 }]);
    p.tub("steelDark", x0, x1, floor, s.h, z0, z1);
    const cw = (x1 - x0) / o.n;
    for (let i = 0; i < o.n; i++) {
      const a = x0 + i * cw;
      if (i > 0) p.roundedBox("steel", a - BAR / 2, a + BAR / 2, s.h - BAR, s.h - 0.001, z0 + 0.001, z1 - 0.001, 0.002);
      const ca = a + (i > 0 ? BAR / 2 : SHEET) + 0.001;
      const cb = a + cw - (i < o.n - 1 ? BAR / 2 : SHEET) - 0.001;
      gnPan(p, ca, cb, s.h - PAN_DEPTH, s.h, z0 + SHEET + 0.001, z1 - SHEET - 0.001, FOOD[(i + 1) % FOOD.length], FILL_DROP);
    }
  },
};

/** The drop-in well's opening (mm, item frame): as many GN 1/1 across as fit inside the flange. */
function dropInWell(width: number, depth: number) {
  const n = Math.max(1, Math.floor((width - 2 * FLANGE_MM - 20) / GN_MM));
  const w = Math.min(n * GN_MM, width - 2 * FLANGE_MM - 20);
  const d = Math.min(GN_LENGTH_MM + 20, depth - 2 * FLANGE_MM - 20);
  return { n, x0: -w / 2, x1: w / 2, y0: -d / 2, y1: d / 2 };
}
