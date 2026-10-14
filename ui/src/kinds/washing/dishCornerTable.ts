// Corner table of a dish line (Ecktisch): where the line turns, the racks come in from the left
// and leave towards the front, so those two edges are open; rails in both directions carry them.

import { SHEET } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { dishTableFront, dishTableTop, rackRails, rackRailsPlan, RIM, tableFrame } from "./common";

/** Distance of the rack rails from the middle of the table (mm, under a 500 mm rack). */
const RAIL = 200;

export const dishCornerTable: KindDef = {
  kind: "dishCornerTable",
  plan(s) {
    rackRailsPlan(s, s.L, Math.min(s.R, RAIL + 60));
    const half = Math.min(RAIL, s.w / 2 - 20);
    for (const x of [-half, half]) s.line("detail", [x, Math.max(s.B, -RAIL - 60)], [x, s.F]);
    upstandLine(s);
    s.line("detail", [s.R - 15, s.B], [s.R - 15, s.F]);
  },
  elevation(f) {
    dishTableFront(f);
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - RIM - SHEET * 2);
    const y = dishTableTop(p, s, [], ["left", "front"]);
    // Rails along the line from the left, and lower ones turning towards the front.
    const rail = RAIL / 1000;
    rackRails(p, -s.w / 2, Math.min(s.w / 2, rail + 0.06), y);
    const z0 = Math.max(-s.d / 2, -rail - 0.06);
    for (const x of [-rail, rail]) p.rod("handle", "z", x, y + 0.008, (z0 + s.d / 2) / 2, s.d / 2 - z0, 0.008);
  },
};
