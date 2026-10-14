// Refrigerated GN well (Kühlwanne): a cooled well for GN 1/1 containers let into the worktop of a
// refrigerated base, for cold buffets, salad bars and the cold side of a pass. GN 1/1 containers
// lie across the well (800 mm = 2, 1200 mm = 3, 1600 mm = 4).

import { TOP as FRONT_TOP } from "../parts/elevation";
import { TOP, type MaterialId } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { m } from "./common";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Width of a GN 1/1 container lying across (325 mm) with its share of the frame (mm). */
const GN_MM = 340;
/** GN 1/1 length front to back (mm), and the depth of the well (mm, 150 mm containers). */
const GN_LENGTH_MM = 530;
const WELL_DEPTH_MM = 200;
/** Margin of the well from the ends of the worktop (mm). */
const MARGIN_MM = 60;
/**
 * How far the food stands below the top, and the bars between the containers (m). The base's
 * body fills the well up to the worktop's underside, so the food shows above that.
 */
const FILL_DROP = 0.025;
const BAR = 0.012;
/** Food in the containers, in turn. */
const FOOD: readonly MaterialId[] = ["oil", "panel", "zone"];

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
    counterBase(p, s, "doors", top);
    const o = well(s.w * 1000, s.d * 1000);
    const x0 = m(o.x0);
    const x1 = m(o.x1);
    const z0 = m(o.y0);
    const z1 = m(o.y1);
    p.topWithHoles("steel", s.w, s.d, top, s.h, [{ x0, x1, z0, z1 }]);
    // Only the top of the well shows above the base's body.
    p.tub("steel", x0, x1, top - 0.01, s.h, z0, z1);
    // The containers: food in each, bars between them carrying the rims.
    const cw = (x1 - x0) / o.n;
    for (let i = 0; i < o.n; i++) {
      const a = x0 + i * cw;
      if (i > 0) p.box("steel", a - BAR / 2, a + BAR / 2, s.h - BAR, s.h - 0.002, z0, z1);
      p.box(FOOD[i % FOOD.length], a + BAR, a + cw - BAR, top - 0.01, s.h - FILL_DROP, z0 + 0.02, z1 - 0.02);
    }
  },
};
