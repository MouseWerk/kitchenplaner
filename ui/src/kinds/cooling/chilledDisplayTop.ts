// Refrigerated counter-top display (Kühlvitrine, Aufsatzvitrine) for salads, sandwiches and
// desserts: a cooled base on the counter with the grille and the display on the staff side
// (the front), a glass case on corner posts with a glass shelf, sliding glass doors for the
// staff and a fixed pane on the guests' side, and a steel cover with the light.

import { BODY_RADIUS, LEG_RADIUS, TOP_RADIUS, type MaterialId, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { display, grille, grilleFront, LEAF_GAP_MM, m } from "./common";

/** Height of the cooled base and of the cover (mm). */
const BASE_MM = 130;
const COVER_MM = 40;
/** Corner posts (m), glass thickness (m), and the gap between the two sliding panes (m). */
const POST = 0.025;
const PANE = 0.006;
const TRACK = 0.012;
/** Goods: bowls on the base, packs on the shelf (m). */
const BOWL = { r: 0.075, h: 0.06, pitch: 0.2 };
const PACK = { w: 0.13, d: 0.07, h: 0.08, pitch: 0.16 };
const SALADS: readonly MaterialId[] = ["foodGreen", "foodRed", "foodCream"];

/** A salad bowl standing at (x, y, z): a turned bowl with its salad heaped in it. */
function bowl(p: Parts, x: number, y: number, z: number, mat: MaterialId): void {
  const { r, h } = BOWL;
  p.lathe("panel", x, y, z, [
    [0, 0],
    [r * 0.55, 0],
    [r * 0.95, h * 0.7],
    [r, h],
    [r * 0.94, h],
    [r * 0.88, h * 0.75],
    [0, h * 0.75],
  ]);
  p.lathe(mat, x, y + h * 0.7, z, [
    [0, 0],
    [r * 0.88, 0],
    [r * 0.7, h * 0.35],
    [r * 0.35, h * 0.55],
    [0, h * 0.6],
  ]);
}

/** A sandwich pack lying on its back at (x, y, z): a triangular wedge in its clear box. */
function pack(p: Parts, x: number, y: number, z: number): void {
  const { w, d, h } = PACK;
  p.extrude("foodCream", "x", x - w / 2, x + w / 2, [
    [z - d / 2, y],
    [z + d / 2, y],
    [z - d / 2 + 0.01, y + h],
  ]);
}

export const chilledDisplayTop: KindDef = {
  kind: "chilledDisplayTop",
  placement: "tableTop",
  plan(s) {
    // The case on its posts, the sliding panes at the front in two tracks.
    s.rect("detail", s.L + POST * 1000, s.B + POST * 1000, s.R - POST * 1000, s.F - POST * 1000);
    s.line("detail", [s.L + INSET, s.F - INSET / 2], [INSET, s.F - INSET / 2]);
    s.line("detail", [-INSET, s.F - INSET], [s.R - INSET, s.F - INSET]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const b = z0 + BASE_MM;
    f.line("detail", [l, b], [r, b]);
    f.line("detail", [l, top - COVER_MM], [r, top - COVER_MM]);
    grilleFront(f, l + LEAF_GAP_MM * 3, l + f.w * 0.5, z0 + 25, b - 25);
    const p = POST * 1000;
    f.box("detail", l, l + p, b, top - COVER_MM);
    f.box("detail", r - p, r, b, top - COVER_MM);
    // The two sliding panes overlapping in the middle, the shelf behind them.
    const c = (l + r) / 2;
    f.box("detail", l + p, c + 30, b + 10, top - COVER_MM - 10, "glass");
    f.box("detail", c - 30, r - p, b + 10, top - COVER_MM - 10, "glass");
    const shelf = (b + top - COVER_MM) / 2;
    f.line("detail", [l + p, shelf], [r - p, shelf]);
  },
  mesh(p, s) {
    const b = m(BASE_MM);
    const yc = s.h - m(COVER_MM);
    const front = s.d / 2;
    const back = -s.d / 2;
    // The cooled base: its deck is the case's floor; grille and display face the staff.
    p.roundedBox("steel", -s.w / 2, s.w / 2, 0, b, back, front - 0.006, BODY_RADIUS);
    grille(p, -s.w / 2 + 0.04, -s.w / 2 + s.w * 0.5, 0.025, b - 0.025, front - 0.006, front);
    display(p, s.w / 2 - 0.15, b / 2, front - 0.006);
    // Corner posts, the cover with its light strip, the glass.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - POST / 2);
        const z = sz * (s.d / 2 - POST / 2);
        p.roundedBox("steel", x - POST / 2, x + POST / 2, b - 0.002, yc + 0.002, z - POST / 2, z + POST / 2, LEG_RADIUS, "vertical");
      }
    }
    p.roundedBox("steel", -s.w / 2, s.w / 2, yc, s.h, back, front, TOP_RADIUS);
    p.plate("panel", -s.w / 2 + POST, s.w / 2 - POST, yc - 0.004, yc + 0.001, -0.03, 0.03, 0.004);
    const gx0 = -s.w / 2 + POST;
    const gx1 = s.w / 2 - POST;
    // Ends and the guests' side: fixed panes between the posts.
    p.box("glass", gx0, gx1, b, yc, back + POST / 2 - PANE / 2, back + POST / 2 + PANE / 2);
    for (const sx of [-1, 1]) p.box("glass", sx * (s.w / 2 - POST / 2) - PANE / 2, sx * (s.w / 2 - POST / 2) + PANE / 2, b, yc, back + POST, front - POST);
    // The staff side: two sliding panes in two tracks, each with a grip strip at its free edge.
    const zt = front - POST / 2;
    for (const [i, [a, c]] of [[gx0, 0.03], [-0.03, gx1]].entries()) {
      const z = zt - (i === 0 ? TRACK : 0);
      p.box("glass", a, c, b + 0.004, yc - 0.004, z - PANE / 2, z + PANE / 2);
      const gx = i === 0 ? c - 0.02 : a + 0.02;
      p.roundedBox("handle", gx - 0.006, gx + 0.006, b + 0.04, yc - 0.04, z + PANE / 2, z + PANE / 2 + 0.006, 0.003, "vertical");
    }
    // The glass shelf on its brackets, with the goods.
    const shelf = (b + yc) / 2;
    p.box("glass", gx0, gx1, shelf - 0.008, shelf, back + POST, front - POST - TRACK - 0.01);
    for (const sx of [-1, 1]) p.box("satin", sx * (gx1 - 0.01) - 0.006, sx * (gx1 - 0.01) + 0.006, shelf - 0.03, shelf - 0.008, back + POST, front - POST - TRACK - 0.01);
    const nb = Math.max(1, Math.floor((gx1 - gx0) / BOWL.pitch));
    for (let i = 0; i < nb; i++) bowl(p, gx0 + (gx1 - gx0) * ((i + 0.5) / nb), b + 0.001, -0.02, SALADS[i % SALADS.length]);
    const np = Math.max(1, Math.floor((gx1 - gx0) / PACK.pitch));
    for (let i = 0; i < np; i++) pack(p, gx0 + (gx1 - gx0) * ((i + 0.5) / np), shelf, -0.03);
  },
};
