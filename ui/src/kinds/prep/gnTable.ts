// Work table with GN cut-outs (Arbeitstisch mit GN-Ausschnitten): a wall table whose top holds a
// row of GN 1/1 containers hanging by their rims, filled with the mise en place; legs on feet,
// no undershelf under the containers' bottoms.

import { GN_RADIUS, TOP, type Hole, type MaterialId } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableLegsFront, tableTop, UPSTAND_RISE } from "./common";

/** A GN 1/1 container lying across the table: 325 mm along the width, 530 mm deep; 150 mm deep. */
const GN_W = 325;
const GN_D = 530;
const GN_DEPTH = 0.15;
/** Width of the steel between two containers and at the ends (mm). */
const WEB = 35;
const END = 100;
/** Rim of a GN container resting on the top (m). */
const GN_RIM = 0.008;
/** The containers' contents, one after the other. */
const FOODS: readonly MaterialId[] = ["foodGreen", "foodRed", "foodCream", "foodBrown"];

/** Number of containers in a table of width `w` (mm). */
function count(w: number): number {
  return Math.max(1, Math.min(5, Math.floor((w - 2 * END + WEB) / (GN_W + WEB))));
}

/** Centres of the containers along the width (mm or m with `k` = 0.001). */
function centres(w: number, k = 1): number[] {
  const n = count(w / k);
  const pitch = (GN_W + WEB) * k;
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
}

/** Depth position of the containers' centre (mm): the middle of the top in front of the upstand. */
const CENTRE_Y = 10;

export const gnTable: KindDef = {
  kind: "gnTable",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
    const gd = Math.min(GN_D, s.d - 120);
    const cy = CENTRE_Y;
    for (const cx of centres(s.w)) {
      s.rect("detail", cx - GN_W / 2, cy - gd / 2, cx + GN_W / 2, cy + gd / 2);
      s.rect("detail", cx - GN_W / 2 + 15, cy - gd / 2 + 15, cx + GN_W / 2 - 15, cy + gd / 2 - 15);
    }
  },
  elevation(f) {
    f.worktop();
    f.box("detail", f.l, f.r, f.top, f.top + UPSTAND_RISE);
    const mid = (f.l + f.r) / 2;
    // The containers hang under the top, behind the front: hidden.
    for (const cx of centres(f.w)) f.box("hidden", mid + cx - GN_W / 2, mid + cx + GN_W / 2, f.top - GN_DEPTH * 1000, f.top - TOP * 1000);
    tableLegsFront(f, { shelf: false });
  },
  mesh(p, s) {
    const gd = Math.min(GN_D, s.d * 1000 - 120) / 1000;
    const cz = CENTRE_Y / 1000;
    const pans = centres(s.w, 0.001).map((cx) => ({ x0: cx - GN_W / 2000, x1: cx + GN_W / 2000, z0: cz - gd / 2, z1: cz + gd / 2 }));
    const holes: Hole[] = pans.map((b) => ({ x0: b.x0 + GN_RIM, x1: b.x1 - GN_RIM, z0: b.z0 + GN_RIM, z1: b.z1 - GN_RIM, r: GN_RADIUS - GN_RIM }));
    // No front rail: the containers hang down where it would run; the apron stiffens the front.
    tableFrame(p, s, s.h - TOP, { shelf: false, frontRail: false });
    tableTop(p, s, { back: true }, holes);
    pans.forEach((b, i) => {
      // The container rests on the top by its rim, the food a little below the rim.
      const y1 = s.h + 0.0015;
      p.pan("steel", b.x0, b.x1, s.h - GN_DEPTH, y1, b.z0, b.z1, { wall: 0.002, r: GN_RADIUS, rim: GN_RIM });
      const inset = GN_RIM + 0.0025;
      p.roundedBox(FOODS[i % FOODS.length], b.x0 + inset, b.x1 - inset, s.h - GN_DEPTH + 0.01, s.h - 0.03, b.z0 + inset, b.z1 - inset, 0.004, "vertical");
    });
  },
};
