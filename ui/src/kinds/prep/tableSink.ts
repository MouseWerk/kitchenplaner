// Work table with a sink bowl: a wall table with one deep bowl at the right end and a mixer tap,
// for washing vegetables or rinsing at the preparation station.

import { INSET as FRONT_INSET, TAP, TOP as FRONT_TOP } from "../parts/elevation";
import { SHEET, tap, TOP, type Hole } from "../parts/mesh";
import { INSET, UPSTAND, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableFront, tableTop } from "./common";

/** Inner bowl size and depth (mm, a common 400 × 400 bowl, 250 deep). */
const BOWL = 400;
const BOWL_DEPTH = 250;
/** Distance of the bowl from the right end (mm), clear of the leg. */
const BOWL_SET = 100;

/** The bowl's x range from the right end, shrunk to fit narrow tables (mm). */
function bowlSpan(w: number): [number, number] {
  const bw = Math.min(BOWL, w - 2 * BOWL_SET);
  return [w / 2 - BOWL_SET - bw, w / 2 - BOWL_SET];
}

export const tableSink: KindDef = {
  kind: "tableSink",
  rise: TAP,
  plan(s) {
    upstandLine(s);
    const [a, b] = bowlSpan(s.w);
    const bd = Math.min(BOWL, s.d - 2 * INSET - UPSTAND);
    const cy = (s.B + UPSTAND + s.F) / 2;
    s.rect("detail", a, cy - bd / 2, b, cy + bd / 2);
    s.circle("detail", (a + b) / 2, cy, INSET / 2);
    s.circle("detail", (a + b) / 2, s.B + UPSTAND / 2 + INSET / 2, INSET / 2);
  },
  elevation(f) {
    tableFront(f, { upstand: true, shelf: true });
    const mid = (f.l + f.r) / 2;
    const [a, b] = bowlSpan(f.w);
    // The bowl lies behind the front: hidden. The tap stands over it.
    f.box("hidden", mid + a, mid + b, f.top - BOWL_DEPTH, f.top - FRONT_TOP);
    const tx = mid + (a + b) / 2;
    f.line("detail", [tx, f.top], [tx, f.top + TAP], [tx - FRONT_INSET * 3, f.top + TAP]);
  },
  mesh(p, s) {
    const [a, b] = bowlSpan(s.w * 1000).map((v) => v / 1000);
    const bd = Math.min(BOWL / 1000, s.d - 0.2);
    const zc = 0.02;
    const hole: Hole = { x0: a, x1: b, z0: zc - bd / 2, z1: zc + bd / 2 };
    tableFrame(p, s, s.h - TOP, { shelf: true });
    tableTop(p, s, { back: true }, [hole]);
    const y0 = s.h - BOWL_DEPTH / 1000;
    p.tub("steel", hole.x0, hole.x1, y0, s.h, hole.z0, hole.z1);
    p.cyl("steelDark", (a + b) / 2, zc, y0 + SHEET, y0 + SHEET + 0.003, 0.035);
    tap(p, (a + b) / 2, -s.d / 2, s.h, TAP / 1000);
  },
};
