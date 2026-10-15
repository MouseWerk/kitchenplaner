// Mobile work table with GN drawers (fahrbarer Arbeitstisch mit GN-Schubladen): a closed body on
// four swivel castors with columns of three drawers for GN 1/1 containers, rubber bumpers at the
// corners and a push bar at the right end, under a top rolled at the front and the back.

import { TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, drawerFronts, drawersFront, frontsPlan, tableCastor, tableTop } from "./common";

/** Drawers per column, and the width from which there are two columns (mm). */
const DRAWERS = 3;
const TWO_COLUMNS_FROM = 1000;
/** Radius of the castor marks in the plan (mm), as `mobileTable`. */
const CASTOR_MARK = 25;
/** Bumper radius and height (m). */
const BUMPER = 0.022;
/** How far the body's right end stays in from the outline for the push bar, and its radius (m). */
const END = 0.05;
const BAR_R = 0.012;

function columns(w: number): number {
  return w >= TWO_COLUMNS_FROM ? 2 : 1;
}

export const mobileGnTable: KindDef = {
  kind: "mobileGnTable",
  plan(s) {
    frontsPlan(s, s.L, s.R - END * 1000, columns(s.w));
    s.line("detail", [s.R - BAR_R * 1000, s.B + 80], [s.R - BAR_R * 1000, s.F - 80]);
    for (const x of [s.L + INSET + CASTOR_MARK, s.R - INSET - CASTOR_MARK]) {
      for (const y of [s.B + INSET + CASTOR_MARK, s.F - INSET - CASTOR_MARK]) s.circle("hidden", x, y, CASTOR_MARK);
    }
  },
  elevation(f) {
    f.worktop();
    const z0 = f.z0 + CASTOR * 1000 + 10;
    const z1 = f.top - TOP * 1000;
    const n = columns(f.w);
    const cw = (f.w - END * 1000) / n;
    for (let i = 0; i < n; i++) drawersFront(f, f.l + i * cw, f.l + (i + 1) * cw, z0, z1, DRAWERS);
    for (const c of [f.l + 60, f.r - 60]) f.circle("detail", c, f.z0 + 45, 45);
    f.circle("detail", f.r - BAR_R * 1000, z1 - 60, BAR_R * 1000);
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    const y0 = CASTOR + 0.01;
    const y1 = h - TOP;
    const zf = d / 2 - 0.005;
    // The body on its castor plate frame.
    p.roundedBox("steelDark", -w / 2 + 0.03, w / 2 - 0.03, CASTOR - 0.001, y0, -d / 2 + 0.03, d / 2 - 0.03, 0.004);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tableCastor(p, sx * (w / 2 - 0.07), sz * (d / 2 - 0.08));
    // The body, its right end set back for the push bar.
    const xr = w / 2 - END;
    p.roundedBox("steel", -w / 2 + 0.01, xr, y0, y1, -d / 2 + 0.01, zf - 0.02, 0.003, "vertical");
    const n = columns(item.width);
    const cw = (xr + w / 2 - 0.01) / n;
    for (let i = 0; i < n; i++) drawerFronts(p, -w / 2 + 0.01 + i * cw, -w / 2 + 0.01 + (i + 1) * cw, y0, y1, zf, DRAWERS);
    // The push bar along the right end, on two stand-offs from the body.
    const bx = w / 2 - BAR_R;
    const by = y1 - 0.06;
    const bz = d / 2 - 0.08;
    for (const sz of [-1, 1]) p.rod("satin", "x", (xr + bx) / 2, by, sz * bz, bx - xr, 0.008);
    p.rod("handle", "z", bx, by, 0, 2 * bz + 0.03, BAR_R);
    // Rubber bumpers at the corners under the top.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        p.lathe("rubber", sx * (w / 2 - BUMPER), y1 - 0.045, sz * (d / 2 - BUMPER), [
          [0, 0],
          [BUMPER * 0.9, 0],
          [BUMPER, 0.008],
          [BUMPER, 0.027],
          [BUMPER * 0.9, 0.035],
          [0, 0.035],
        ]);
      }
    }
    tableTop(p, s, { rolledBack: true, solid: true });
  },
};
