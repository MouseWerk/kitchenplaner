// Inlet table of a dish line (Zulauftisch): a table with a raised rim, a basin with the
// pre-rinse shower at its far end and rack rails that lead the racks into the dishwasher, which
// stands to the right of it (the right end is open) or, in the mirrored table, to the left.

import { INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { SHEET } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain, dishTableFront, dishTableTop, flowArrow, overflow, preRinseFront, preRinsePlan, preRinseShower, rackRails, rackRailsPlan, RIM, SHOWER_RISE, tableFrame, type Side } from "./common";

/** The basin at the left end (mm): at most this wide and deep, and its depth. */
const BASIN_W = 450;
const BASIN_D = 450;
const BASIN_DEPTH = 200;
/** Distance of the basin from the left end and the back (mm). */
const MARGIN = 80;

/** The basin's extent in the item frame (mm), at the end away from the machine. */
function basin(w: number, d: number, machine: Side) {
  const bw = Math.min(BASIN_W, w * 0.4);
  const bd = Math.min(BASIN_D, d - 2 * MARGIN);
  const x0 = machine === "right" ? -w / 2 + MARGIN : w / 2 - MARGIN - bw;
  return { x0, x1: x0 + bw, y0: -bd / 2, y1: bd / 2 };
}

function makeInletTable(kind: string, machine: Side): KindDef {
  const right = machine === "right";
  return {
    kind,
    rise: SHOWER_RISE,
    plan(s) {
      const b = basin(s.w, s.d, machine);
      s.rect("detail", b.x0, b.y0, b.x1, b.y1);
      s.circle("detail", (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, INSET / 2);
      preRinsePlan(s, (b.x0 + b.x1) / 2);
      if (right) {
        rackRailsPlan(s, b.x1 + INSET, s.R);
        flowArrow(s, b.x1 + INSET * 2, s.R - INSET, 0, "right");
      } else {
        rackRailsPlan(s, s.L, b.x0 - INSET);
        flowArrow(s, s.L + INSET, b.x0 - INSET * 2, 0, "left");
      }
      upstandLine(s);
    },
    elevation(f) {
      const c = (f.l + f.r) / 2;
      const b = basin(f.w, f.item.depth, machine);
      dishTableFront(f);
      f.box("hidden", c + b.x0, c + b.x1, f.top - RIM * 1000 - BASIN_DEPTH, f.top - FRONT_TOP - FRONT_INSET);
      preRinseFront(f, c + (b.x0 + b.x1) / 2, f.top - RIM * 1000, SHOWER_RISE + RIM * 1000);
    },
    mesh(p, s) {
      const b = basin(s.w * 1000, s.d * 1000, machine);
      const hole = { x0: b.x0 / 1000, x1: b.x1 / 1000, z0: b.y0 / 1000, z1: b.y1 / 1000 };
      const depth = BASIN_DEPTH / 1000;
      tableFrame(p, s, s.h - RIM - SHEET * 2);
      const y = dishTableTop(p, s, [hole], [machine]);
      p.tub("steel", hole.x0, hole.x1, y - depth, y, hole.z0, hole.z1);
      bowlDrain(p, (hole.x0 + hole.x1) / 2, (hole.z0 + hole.z1) / 2, y - depth, -s.d / 2);
      overflow(p, (hole.x0 + hole.x1) / 2, hole.z0 + SHEET, y);
      if (right) rackRails(p, hole.x1 + 0.05, s.w / 2, y);
      else rackRails(p, -s.w / 2, hole.x0 - 0.05, y);
      preRinseShower(p, (hole.x0 + hole.x1) / 2, -s.d / 2 + SHEET * 1.5, y, SHOWER_RISE / 1000 + RIM);
    },
  };
}

export const dishInletTable = makeInletTable("dishInletTable", "right");
export const dishInletTableLeft = makeInletTable("dishInletTableLeft", "left");
