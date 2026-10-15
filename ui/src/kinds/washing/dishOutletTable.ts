// Outlet table of a dish line (Ablauftisch): a table with a raised rim and rack rails on which the
// clean racks leave the dishwasher, which stands to the left of it (the left end is open; in the
// mirrored table to the right). The
// top falls towards the machine, so the drip water runs back into it through the outlet at the
// open end; a stop at the far end keeps the racks on the table.

import { SHEET } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { dishTableFront, dishTableTop, flowArrow, rackRails, rackRailsPlan, RIM, tableFrame, type Side } from "./common";

/** Distance of the rack stop from the closed end (mm). */
const STOP = 40;

function makeOutletTable(kind: string, machine: Side): KindDef {
  // The racks run away from the machine; the stop is at the far end (k = 1: at the right).
  const k = machine === "left" ? 1 : -1;
  return {
    kind,
    plan(s) {
      const stopX = k * (s.w / 2 - STOP);
      rackRailsPlan(s, Math.min(-k * s.w / 2, stopX), Math.max(-k * s.w / 2, stopX));
      const half = Math.min(250, s.d / 2 - INSET);
      s.line("detail", [stopX, -half], [stopX, half]);
      const a = -k * (s.w / 2 - INSET);
      const b = stopX - k * INSET * 2;
      flowArrow(s, Math.min(a, b), Math.max(a, b), 0, k > 0 ? "right" : "left");
      s.circle("detail", -k * (s.w / 2 - INSET * 1.5), 0, INSET / 2);
      upstandLine(s);
    },
    elevation(f) {
      dishTableFront(f);
    },
    mesh(p, s) {
      tableFrame(p, s, s.h - RIM - SHEET * 2);
      const y = dishTableTop(p, s, [], [machine]);
      const stop = STOP / 1000;
      const stopX = k * (s.w / 2 - stop);
      const railEnd = stopX - k * 0.01;
      rackRails(p, Math.min(-k * s.w / 2, railEnd), Math.max(-k * s.w / 2, railEnd), y);
      // The rack stop: a bar across the rails near the closed end, bent down into two posts.
      p.tube(
        "handle",
        [
          { x: stopX, y, z: -0.24 },
          { x: stopX, y: y + 0.03, z: -0.24 },
          { x: stopX, y: y + 0.03, z: 0.24 },
          { x: stopX, y, z: 0.24 },
        ],
        0.008,
        { bend: 0.015 },
      );
      // Outlet near the open end, where the drip water collects: a turned strainer.
      p.lathe("satin", -k * (s.w / 2 - 0.075), y - 0.001, 0, [
        [0, 0],
        [0.03, 0],
        [0.03, 0.002],
        [0.022, 0.003],
        [0, 0.003],
      ]);
    },
  };
}

export const dishOutletTable = makeOutletTable("dishOutletTable", "left");
export const dishOutletTableRight = makeOutletTable("dishOutletTableRight", "right");
