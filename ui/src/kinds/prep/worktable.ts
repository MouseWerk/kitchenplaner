// Free-standing work table (island): a stainless top rolled at the front and the back, on four
// legs with adjustable feet and an undershelf. Also the fallback drawing of catalog ids this
// build does not know (a file from a newer version), so it stays within its box (no upstand).

import { TOP } from "../parts/mesh";
import type { KindDef } from "../types";
import { tableFrame, tableFront, tableTop } from "./common";

export const worktable: KindDef = {
  kind: "worktable",
  plan() {
    // Outline only: an island table has no upstand.
  },
  elevation(f) {
    tableFront(f, { upstand: false, shelf: true });
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - TOP, { shelf: true });
    tableTop(p, s, { rolledBack: true });
  },
};
