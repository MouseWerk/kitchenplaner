// Drawer unit (Schubladenblock): a work cabinet with three stacked drawers, e.g. for GN pans or
// tools, on adjustable feet.

import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, drawerFronts, drawersFront, frontsPlan, tableTop, UPSTAND_RISE } from "./common";

/** Drawers of the unit, the same in the elevation and in 3D. */
const DRAWERS = 3;

export const drawers: KindDef = {
  kind: "drawers",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
    frontsPlan(s, s.L, s.R, 1);
  },
  elevation(f) {
    const { z0, z1 } = cabinetFront(f, true);
    drawersFront(f, f.l, f.r, z0, z1, DRAWERS);
  },
  mesh(p, s) {
    const { y0, y1, zf } = cabinetBody(p, s);
    drawerFronts(p, -s.w / 2, s.w / 2, y0, y1, zf, DRAWERS);
    tableTop(p, s, { back: true });
  },
};
