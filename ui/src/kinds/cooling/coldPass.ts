// Refrigerated pass (Kühldurchreiche): a refrigerated counter whose top carries a cooled glass
// case with two glass shelves, sliding glass doors on both sides, so the kitchen puts cold
// starters and desserts in from the front and the service takes them out at the back. The base
// has doors on the kitchen side; the case's cold air comes from the base through the deck.

import { TOP as FRONT_TOP } from "../parts/elevation";
import { LEG_RADIUS, TOP, TOP_RADIUS, worktop, type MaterialId, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { m, turnAround } from "./common";
import { counterBase, counterFrontElevation, counterPlan } from "./counterFridge";

/** Height of the counter's top above the floor (mm). */
const COUNTER_MM = 900;
/** Glass shelves in the case, and the depth of the steel cover over it (m). */
const SHELVES = 2;
const COVER = 0.04;
/** Corner posts and glass (m), the gap between two sliding panes. */
const POST = 0.03;
const PANE = 0.006;
const TRACK = 0.012;
/** Plates on the shelves: radius and pitch (m). */
const PLATE = { r: 0.12, pitch: 0.3 };
/** Most plates on a level, for the budget (a wide pass spaces them out). */
const MAX_PLATES = 5;
const STARTERS: readonly MaterialId[] = ["foodGreen", "foodCream", "foodRed"];

/** The sliding panes of one side, built on the front (the back's are turned round). */
function slidingPanes(p: Parts, s: Size, y0: number, y1: number): void {
  const x0 = -s.w / 2 + POST;
  const x1 = s.w / 2 - POST;
  const n = Math.max(2, Math.round((x1 - x0) / 0.6));
  const pw = (x1 - x0) / n;
  const zt = s.d / 2 - POST / 2;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * pw - (i > 0 ? 0.02 : 0);
    const b = x0 + (i + 1) * pw + (i < n - 1 ? 0.02 : 0);
    const z = zt - (i % 2 === 0 ? TRACK : 0);
    p.plate("glass", a, b, y0 + 0.004, y1 - 0.004, z - PANE / 2, z + PANE / 2, 0.004);
    const gx = i % 2 === 0 ? a + 0.03 : b - 0.03;
    p.roundedBox("handle", gx - 0.006, gx + 0.006, (y0 + y1) / 2 - 0.08, (y0 + y1) / 2 + 0.08, z + PANE / 2, z + PANE / 2 + 0.006, 0.003, "vertical");
  }
}

export const coldPass: KindDef = {
  kind: "coldPass",
  plan(s) {
    counterPlan(s, "doors");
    // The case on its posts, the sliding panes on both sides.
    const p = POST * 1000;
    s.rect("detail", s.L + p, s.B + p, s.R - p, s.F - p);
    s.line("detail", [s.L + p, s.F - INSET / 2], [s.R - p, s.F - INSET / 2]);
    s.line("detail", [s.L + p, s.B + INSET / 2], [s.R - p, s.B + INSET / 2]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const c = z0 + COUNTER_MM;
    f.box("detail", l, r, c - FRONT_TOP, c);
    counterFrontElevation(f, "doors", c - FRONT_TOP);
    const p = POST * 1000;
    f.box("detail", l, l + p, c, top - COVER * 1000);
    f.box("detail", r - p, r, c, top - COVER * 1000);
    f.line("detail", [l, top - COVER * 1000], [r, top - COVER * 1000]);
    f.box("detail", l + p, r - p, c + 10, top - COVER * 1000 - 10, "glass");
    for (let i = 1; i <= SHELVES; i++) {
      const z = c + ((top - COVER * 1000 - c) * i) / (SHELVES + 1);
      f.line("detail", [l + p, z], [r - p, z]);
    }
  },
  mesh(p, s) {
    const c = m(COUNTER_MM);
    const yc = s.h - COVER;
    counterBase(p, s, "doors", c - TOP);
    worktop(p, "steel", -s.w / 2, s.w / 2, c - TOP, c, -s.d / 2, s.d / 2);
    // The posts and the cover with its light strip.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - POST / 2);
        const z = sz * (s.d / 2 - POST / 2);
        p.roundedBox("steel", x - POST / 2, x + POST / 2, c - TOP_RADIUS, yc + 0.002, z - POST / 2, z + POST / 2, LEG_RADIUS, "vertical");
      }
    }
    p.roundedBox("steel", -s.w / 2, s.w / 2, yc, s.h, -s.d / 2, s.d / 2, TOP_RADIUS);
    p.plate("panel", -s.w / 2 + POST, s.w / 2 - POST, yc - 0.004, yc + 0.001, -0.03, 0.03, 0.004);
    // Fixed end panes, then the sliding panes on the kitchen side and, turned round, the service side.
    for (const sx of [-1, 1]) p.box("glass", sx * (s.w / 2 - POST / 2) - PANE / 2, sx * (s.w / 2 - POST / 2) + PANE / 2, c, yc, -s.d / 2 + POST, s.d / 2 - POST);
    slidingPanes(p, s, c, yc);
    const from = p.g.children.length;
    slidingPanes(p, s, c, yc);
    turnAround(p, from);
    // Glass shelves on brackets, plates of starters on them and on the deck.
    const x0 = -s.w / 2 + POST;
    const x1 = s.w / 2 - POST;
    const zIn = s.d / 2 - POST - TRACK - 0.01;
    const n = Math.max(1, Math.min(MAX_PLATES, Math.floor((x1 - x0) / PLATE.pitch)));
    for (let k = 0; k <= SHELVES; k++) {
      const y = c + ((yc - c) * k) / (SHELVES + 1);
      if (k > 0) {
        p.box("glass", x0, x1, y - 0.008, y, -zIn, zIn);
        for (const sx of [-1, 1]) p.box("satin", sx * (x1 - 0.01) - 0.006, sx * (x1 - 0.01) + 0.006, y - 0.03, y - 0.008, -zIn, zIn);
      }
      for (let i = 0; i < n; i++) {
        const x = x0 + (x1 - x0) * ((i + 0.5) / n);
        p.lathe("panel", x, y + 0.001, 0, [
          [0, 0],
          [PLATE.r * 0.55, 0],
          [PLATE.r * 0.6, 0.006],
          [PLATE.r, 0.016],
          [PLATE.r * 0.97, 0.018],
          [PLATE.r * 0.6, 0.009],
          [0, 0.009],
        ]);
        p.lathe(STARTERS[(i + k) % STARTERS.length], x, y + 0.009, 0, [
          [0, 0],
          [PLATE.r * 0.45, 0],
          [PLATE.r * 0.3, 0.03],
          [0, 0.04],
        ]);
      }
    }
  },
};
