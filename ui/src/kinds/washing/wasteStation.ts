// Waste station (Abfallstation): a table with an opening for each waste bin in its top, the bins
// standing on castors underneath and open to the front, so they can be rolled out and emptied
// (one bin per 400 mm of width, for food waste, packaging and residual waste).

import { FEET, INSET as FRONT_INSET, LEG as FRONT_LEG, TOP as FRONT_TOP } from "../parts/elevation";
import { BODY_RADIUS, BOWL_RADIUS, DOOR, foot, SHEET, TOP, TOP_RADIUS, type Hole } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { funnel, wasteBin } from "./details";

/** Width each bin takes (mm). */
const BIN_PITCH = 400;
/** Opening in the top over each bin (mm), and the bin's radius and height (mm). */
const OPENING = 260;
const BIN_R = 170;
const BIN_H = 650;
/** Depth of the funnel under each opening (m). */
const FUNNEL = 0.1;
/** Height of the feet under the side panels (m). */
const FOOT_H = 0.03;

const binCount = (w: number) => Math.max(1, Math.round(w / BIN_PITCH));

/** Centres of the bins along the width (mm or m, as `w`). */
function centres(w: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => -w / 2 + (w * (i + 0.5)) / n);
}

export const wasteStation: KindDef = {
  kind: "wasteStation",
  plan(s) {
    const n = binCount(s.w);
    const o = Math.min(OPENING, s.w / n - 60, s.d - 160) / 2;
    const r = Math.min(BIN_R, s.w / n / 2 - 20, s.d / 2 - 30);
    for (const x of centres(s.w, n)) {
      s.rect("detail", x - o, -o, x + o, o);
      s.circle("hidden", x, 0, r);
    }
    upstandLine(s);
  },
  elevation(f) {
    const { l, r, z0 } = f;
    const I = FRONT_INSET;
    const n = binCount(f.w);
    const c = (l + r) / 2;
    f.worktop();
    f.box("detail", l, l + FRONT_LEG, z0, f.top - FRONT_TOP);
    f.box("detail", r - FRONT_LEG, r, z0, f.top - FRONT_TOP);
    const half = Math.min(BIN_R, f.w / n / 2 - I);
    const binTop = Math.min(z0 + BIN_H, f.top - FRONT_TOP - I * 2);
    for (const x of centres(f.w, n)) {
      f.box("detail", c + x - half, c + x + half, z0 + FEET / 3, binTop);
      f.line("detail", [c + x - half, binTop - I], [c + x + half, binTop - I]);
    }
  },
  mesh(p, s) {
    const n = binCount(s.w * 1000);
    const o = Math.min(OPENING / 1000, s.w / n - 0.06, s.d - 0.16) / 2;
    const holes: Hole[] = centres(s.w, n).map((x) => ({ x0: x - o, x1: x + o, z0: -o, z1: o }));
    const zb = -s.d / 2;
    const zf = s.d / 2;
    // Side panels on feet (no kick plate: the bins roll out over the floor), a back panel, the
    // top with an opening and a funnel over each bin.
    for (const [a, b] of [
      [-s.w / 2, -s.w / 2 + SHEET * 2],
      [s.w / 2 - SHEET * 2, s.w / 2],
    ]) {
      p.roundedBox("steel", a, b, FOOT_H, s.h - TOP, zb, zf - DOOR, BODY_RADIUS, "vertical");
      for (const z of [zb + 0.03, zf - DOOR - 0.03]) foot(p, (a + b) / 2, z, FOOT_H, SHEET);
    }
    p.roundedBox("steel", -s.w / 2 + SHEET * 2, s.w / 2 - SHEET * 2, FOOT_H, s.h - TOP, zb, zb + SHEET, BODY_RADIUS, "vertical");
    p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, holes);
    // The apron under the top at the front, rounded over its lower edge.
    p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - TOP - 0.06, s.h - TOP + TOP_RADIUS, zf - DOOR, zf - DOOR + SHEET, BODY_RADIUS);
    const r = Math.min(BIN_R / 1000, s.w / n / 2 - 0.03, s.d / 2 - 0.05);
    const binTop = Math.min(BIN_H / 1000, s.h - TOP - FUNNEL - 0.02);
    for (const h of holes) {
      const x = (h.x0 + h.x1) / 2;
      funnel(p, h.x0, h.x1, h.z0, h.z1, s.h - TOP - FUNNEL, s.h, BOWL_RADIUS);
      // The bin on castors with a grip at the front.
      wasteBin(p, x, 0, binTop, r);
      p.tube("knob", [
        { x: x - 0.05, y: binTop - 0.07, z: r * 0.92 },
        { x: x - 0.05, y: binTop - 0.07, z: r + 0.015 },
        { x: x + 0.05, y: binTop - 0.07, z: r + 0.015 },
        { x: x + 0.05, y: binTop - 0.07, z: r * 0.92 },
      ], 0.007, { bend: 0.012 });
    }
  },
};
