// Wall work table: a stainless top with the back upstand and a rolled front edge, on four legs
// with adjustable feet and an undershelf. The worktop is at the item's height, the upstand rises
// above it.

import { TOP } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableFront, tableTop, UPSTAND_RISE } from "./common";

export const wallTable: KindDef = {
  kind: "wallTable",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
  },
  elevation(f) {
    tableFront(f, { upstand: true, shelf: true });
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - TOP, { shelf: true });
    tableTop(p, s, { back: true });
  },
};
