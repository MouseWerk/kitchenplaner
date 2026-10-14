// Outlet table of a dish line (Ablauftisch): a table with a raised rim and rack rails on which the
// clean racks leave the dishwasher, which stands to the left of it (the left end is open). The
// top falls towards the machine, so the drip water runs back into it through the outlet at the
// open end; a stop at the far end keeps the racks on the table.

import { SHEET } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { dishTableFront, dishTableTop, flowArrow, rackRails, rackRailsPlan, RIM, tableFrame } from "./common";

/** Distance of the rack stop from the closed end (mm). */
const STOP = 40;

export const dishOutletTable: KindDef = {
  kind: "dishOutletTable",
  plan(s) {
    rackRailsPlan(s, s.L, s.R - STOP);
    const half = Math.min(250, s.d / 2 - INSET);
    s.line("detail", [s.R - STOP, -half], [s.R - STOP, half]);
    flowArrow(s, s.L + INSET, s.R - STOP - INSET * 2, 0, "right");
    s.circle("detail", s.L + INSET * 1.5, 0, INSET / 2);
    upstandLine(s);
  },
  elevation(f) {
    dishTableFront(f);
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - RIM - SHEET * 2);
    const y = dishTableTop(p, s, [], ["left"]);
    const stop = STOP / 1000;
    rackRails(p, -s.w / 2, s.w / 2 - stop - 0.01, y);
    // The rack stop: a bar across the rails near the closed end, on two posts.
    p.rod("handle", "z", s.w / 2 - stop, y + 0.03, 0, 0.5, 0.008);
    for (const z of [-0.24, 0.24]) p.box("handle", s.w / 2 - stop - 0.006, s.w / 2 - stop + 0.006, y, y + 0.03, z - 0.006, z + 0.006);
    // Outlet near the open end, where the drip water collects.
    p.cyl("steelDark", -s.w / 2 + 0.075, 0, y, y + 0.002, 0.025);
  },
};
