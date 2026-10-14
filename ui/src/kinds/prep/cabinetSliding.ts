// Work cabinet with sliding doors: no door swing in front, for narrow aisles.

import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, slidingDoors, slidingFront, slidingPlan, tableTop, UPSTAND_RISE } from "./common";

export const cabinetSliding: KindDef = {
  kind: "cabinetSliding",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
    slidingPlan(s);
  },
  elevation(f) {
    const { z0, z1 } = cabinetFront(f, true);
    slidingFront(f, f.l, f.r, z0, z1);
  },
  mesh(p, s) {
    const { y0, y1, zf } = cabinetBody(p, s);
    slidingDoors(p, -s.w / 2, s.w / 2, y0, y1, zf);
    tableTop(p, s, { back: true });
  },
};
