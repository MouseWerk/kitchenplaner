// Mobile work table: a top rolled at both long edges and an undershelf on four swivel castors.

import { TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableFront, tableTop } from "./common";

/** Radius of the castor marks at the corners of the plan symbol (mm). */
const CASTOR_MARK = 25;

export const mobileTable: KindDef = {
  kind: "mobileTable",
  plan(s) {
    // Castors under the corners mark the table as mobile.
    for (const x of [s.L + INSET + CASTOR_MARK, s.R - INSET - CASTOR_MARK]) {
      for (const y of [s.B + INSET + CASTOR_MARK, s.F - INSET - CASTOR_MARK]) s.circle("hidden", x, y, CASTOR_MARK);
    }
  },
  elevation(f) {
    tableFront(f, { upstand: false, shelf: true, castors: true });
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - TOP, { shelf: true, castors: true });
    tableTop(p, s, { rolledBack: true });
  },
};
