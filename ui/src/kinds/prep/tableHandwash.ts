// Work table with a hand wash basin (Arbeitstisch mit Handwaschbecken): a wall table with a
// round basin pressed into its top at the left end, a mixer tap behind it and the waste pipe to
// the wall; legs on feet and an undershelf beside the waste.

import { INSET as FRONT_INSET, TAP, TOP as FRONT_TOP } from "../parts/elevation";
import { SHEET, tap, TOP, type Hole } from "../parts/mesh";
import { INSET, UPSTAND, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableFront, tableTop } from "./common";
import { turnedBowl } from "./machine";
import { strainer } from "./tableSink";

/** Radius of the basin (mm, a usual Ø 340 basin), its depth, and its distance from the left end. */
const BASIN_R = 170;
const BASIN_DEPTH = 150;
const BASIN_SET = 70;
/** Depth position of the basin's centre (mm, in front of the upstand). */
const BASIN_Y = 20;

/** The basin's centre along the width (mm), shrunk onto narrow tables. */
function basinX(w: number): number {
  return -w / 2 + BASIN_SET + radius(w);
}

function radius(w: number): number {
  return Math.min(BASIN_R, w / 2 - BASIN_SET);
}

export const tableHandwash: KindDef = {
  kind: "tableHandwash",
  rise: TAP,
  plan(s) {
    upstandLine(s);
    const cx = basinX(s.w);
    s.circle("detail", cx, BASIN_Y, radius(s.w));
    s.circle("detail", cx, BASIN_Y, INSET / 2);
    s.circle("detail", cx, s.B + UPSTAND / 2 + INSET / 2, INSET / 2);
  },
  elevation(f) {
    tableFront(f, { upstand: true, shelf: true });
    const cx = (f.l + f.r) / 2 + basinX(f.w);
    const r = radius(f.w);
    // The basin lies behind the front: hidden. The tap stands over it.
    f.box("hidden", cx - r, cx + r, f.top - BASIN_DEPTH, f.top - FRONT_TOP);
    f.line("detail", [cx, f.top], [cx, f.top + TAP], [cx - FRONT_INSET * 3, f.top + TAP]);
  },
  mesh(p, s, item) {
    const cx = basinX(item.width) / 1000;
    const r = radius(item.width) / 1000;
    const cz = BASIN_Y / 1000;
    const hole: Hole = { x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r, r };
    tableFrame(p, s, s.h - TOP, { shelf: true });
    tableTop(p, s, { back: true }, [hole]);
    const y0 = s.h - BASIN_DEPTH / 1000;
    turnedBowl(p, "steel", cx, y0, cz, r, BASIN_DEPTH / 1000 - 0.001, SHEET / 2);
    strainer(p, cx, cz, y0 + SHEET / 2);
    // The waste pipe from the basin down and back to the wall.
    p.tube(
      "steelDark",
      [
        { x: cx, y: y0, z: cz },
        { x: cx, y: y0 - 0.12, z: cz },
        { x: cx, y: y0 - 0.12, z: -s.d / 2 + 0.03 },
      ],
      0.02,
      { bend: 0.04 },
    );
    tap(p, cx, -s.d / 2, s.h, TAP / 1000);
  },
};
