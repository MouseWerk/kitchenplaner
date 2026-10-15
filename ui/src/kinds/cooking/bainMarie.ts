// Bain-marie: a heated water basin holding GN 1/1 containers crosswise (one per 400 mm) to keep
// sauces and side dishes warm; an open base below.

import { BOWL_RADIUS, CONTROLS, GN_RADIUS, SHEET, type MaterialId } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { lineFront, lineModule } from "./common";

/** A GN 1/1 container (mm): 325 wide when it stands crosswise, 530 deep. */
const GN_W = 325;
const GN_D = 530;
/** Room for one container across the width (mm). */
const GN_PITCH = 350;
/** Width of the rim a container hangs by (m). */
const GN_RIM = 0.008;
/** What the containers hold, in turn. */
const FOODS: readonly MaterialId[] = ["foodCream", "foodRed", "foodBrown", "foodGreen"];
/** Thickness of the top (m). */
const TOP_SHEET = 0.03;
/** Depth of the water basin and of the containers (m). */
const BASIN = 0.2;
const PAN = 0.15;

function pans(widthMm: number): number {
  return Math.max(1, Math.floor((widthMm - INSET) / GN_PITCH));
}

/** Centres of the containers across the width, in the unit of `w`. */
function panCentres(w: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => -w / 2 + (w / n) * (i + 0.5));
}

export const bainMarie: KindDef = {
  kind: "bainMarie",
  plan(s) {
    const y0 = s.B + INSET;
    const y1 = s.F - CONTROL_STRIP;
    s.rect("detail", s.L + INSET / 2, y0, s.R - INSET / 2, y1);
    const pw = Math.min(GN_W, s.w / pans(s.w) - INSET);
    const pd = Math.min(GN_D, y1 - y0 - INSET);
    for (const cx of panCentres(s.w, pans(s.w))) s.rect("detail", cx - pw / 2, (y0 + y1) / 2 - pd / 2, cx + pw / 2, (y0 + y1) / 2 + pd / 2);
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, 1, "open");
  },
  mesh(p, s) {
    const n = pans(s.w * 1000);
    const m = 0.025;
    const hole = { x0: -s.w / 2 + m, x1: s.w / 2 - m, z0: -s.d / 2 + m * 2, z1: s.d / 2 - CONTROLS - m };
    lineModule(p, s, { base: "open", knobs: 1, underTop: s.h - TOP_SHEET, solidTo: s.h - BASIN - 0.01 });
    p.topWithHoles("steel", s.w, s.d, s.h - TOP_SHEET, s.h, [hole]);
    const wall = SHEET / 2;
    p.tub("steelDark", hole.x0, hole.x1, s.h - BASIN, s.h, hole.z0, hole.z1, wall);
    p.roundedBox("water", hole.x0 + wall, hole.x1 - wall, s.h - BASIN + wall, s.h - 0.06, hole.z0 + wall, hole.z1 - wall, BOWL_RADIUS - wall, "vertical");
    // The containers hang in the basin by their rim, filled with sauces and sides a little below it.
    const pw = Math.min(GN_W / 1000, s.w / n - 0.02);
    const pd = Math.min(GN_D / 1000, hole.z1 - hole.z0 - 0.02);
    const cz = (hole.z0 + hole.z1) / 2;
    panCentres(s.w, n).forEach((cx, i) => {
      p.pan("steel", cx - pw / 2, cx + pw / 2, s.h - PAN, s.h - 0.001, cz - pd / 2, cz + pd / 2, { wall: 0.002, r: GN_RADIUS, rim: GN_RIM });
      const fill = GN_RADIUS - GN_RIM - 0.002;
      p.roundedBox(FOODS[i % FOODS.length], cx - pw / 2 + GN_RIM + 0.002, cx + pw / 2 - GN_RIM - 0.002, s.h - PAN + 0.004, s.h - 0.035, cz - pd / 2 + GN_RIM + 0.002, cz + pd / 2 - GN_RIM - 0.002, fill, "vertical");
    });
  },
};
