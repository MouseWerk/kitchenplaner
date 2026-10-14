// Wall work table with a drawer under the top (one at the right end, one at each end from
// 1400 mm), an undershelf and the back upstand.

import { TOP } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { TABLE_DRAWER_W, tableDrawerCount, tableDrawers, tableDrawerSpans, tableDrawersFront, tableFrame, tableFront, tableTop, UPSTAND_RISE } from "./common";

/** Drawers keep clear of the legs by this much from the table's ends (mm, as in 3D). */
const DRAWER_SET = 70;

export const tableDrawer: KindDef = {
  kind: "tableDrawer",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
    // The drawers lie under the top: hidden.
    for (const [a, b] of tableDrawerSpans(s.w, TABLE_DRAWER_W, DRAWER_SET, tableDrawerCount(s.w))) s.rect("hidden", a, s.B + INSET * 2, b, s.F - INSET / 2);
  },
  elevation(f) {
    tableFront(f, { upstand: true, shelf: true });
    tableDrawersFront(f);
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - TOP, { shelf: true });
    tableDrawers(p, s, s.h - TOP);
    tableTop(p, s, { back: true });
  },
};
