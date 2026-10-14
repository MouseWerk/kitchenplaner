// Wall work table without an undershelf: room underneath for mobile racks, bins or a machine.

import { TOP } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableFront, tableTop, UPSTAND_RISE } from "./common";

export const wallTableOpen: KindDef = {
  kind: "wallTableOpen",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
  },
  elevation(f) {
    tableFront(f, { upstand: true, shelf: false });
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - TOP, { shelf: false });
    tableTop(p, s, { back: true });
  },
};
