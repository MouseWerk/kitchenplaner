// Water softener (Wasserenthärtungsanlage, Doppelsäule): two resin columns that take turns, each
// with its control valve on top, the brine tank with the salt beside them, and the pipes to the
// wall. It softens the water for dishwashers, combi ovens and coffee machines.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { button } from "./details";
import { display } from "../parts/details";

/** Radius of a resin column and the height of the control valve on it (m). */
const COLUMN_R = 0.13;
const HEAD = 0.18;
/** Width of the brine tank at the right (m), at most this share of the width. */
const BRINE = 0.36;
const BRINE_SHARE = 0.45;
/** Height of the brine tank (m), at most this share of the height. */
const BRINE_H = 0.8;

/** The layout of a softener w × d × h (m): column centres, radius, brine tank. */
function layout(w: number, d: number, h: number) {
  const bw = Math.min(BRINE, w * BRINE_SHARE);
  const r = Math.min(COLUMN_R, (w - bw - 0.02) / 4, d / 2 - 0.05);
  const x0 = -w / 2 + r;
  return { r, cols: [x0, x0 + 2 * r + 0.01], cz: -d / 2 + 0.05 + r, brine: { x0: w / 2 - bw, h: Math.min(BRINE_H, h * 0.6) }, headY: h - HEAD };
}

export const waterSoftener: KindDef = {
  kind: "waterSoftener",
  plan(s) {
    const k = layout(s.w / 1000, s.d / 1000, s.item.height / 1000);
    for (const x of k.cols) s.circle("detail", x * 1000, k.cz * 1000, k.r * 1000);
    const bx = k.brine.x0 * 1000;
    s.rect("detail", bx, s.B + 20, s.R, s.F);
    s.rect("detail", bx + INSET, s.B + INSET, s.R - INSET, s.F - INSET);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const k = layout(f.w / 1000, f.item.depth / 1000, f.item.height / 1000);
    const c = (l + r) / 2;
    const rr = k.r * 1000;
    for (const xm of k.cols) {
      const x = c + xm * 1000;
      f.box("detail", x - rr, x + rr, z0, top - HEAD * 1000);
      f.box("detail", x - rr * 0.6, x + rr * 0.6, top - HEAD * 1000, top - FRONT_INSET / 2);
    }
    const bx = c + k.brine.x0 * 1000;
    const bh = z0 + k.brine.h * 1000;
    f.box("detail", bx, r, z0, bh);
    f.line("detail", [bx, bh - FEET / 3], [r, bh - FEET / 3]);
  },
  mesh(p, s) {
    const k = layout(s.w, s.d, s.h);
    const zb = -s.d / 2;
    const zf = s.d / 2;
    for (const x of k.cols) {
      // The resin column: a pressure vessel with domed ends on a foot ring.
      const h = k.headY - 0.03;
      const r = k.r;
      p.lathe("panelDark", x, 0, k.cz, [
        [0, 0],
        [r * 0.8, 0],
        [r * 0.8, 0.04],
        [r * 0.95, 0.06],
        [r, 0.1],
        [r, h - r * 0.5],
        [r * 0.8, h - r * 0.15],
        [r * 0.45, h],
        [0, h],
      ]);
      // The control valve on top: a white head with its display and button, a cap behind.
      const hw = Math.min(0.16, r * 1.3);
      const y0 = k.headY - 0.04;
      p.roundedBox("panel", x - hw / 2, x + hw / 2, y0, s.h - 0.02, k.cz - r * 0.7, k.cz + r * 0.9, 0.02);
      p.roundedBox("paintGray", x - hw / 2 + 0.01, x + hw / 2 - 0.01, s.h - 0.024, s.h, k.cz - r * 0.6, k.cz + r * 0.8, 0.01);
      const zFace = k.cz + r * 0.9;
      display(p, x, s.h - 0.08, hw * 0.6, 0.035, zFace);
      button(p, x, y0 + 0.04, zFace, 0.008);
      // The pipes from the valve to the wall and the brine line to the tank.
      p.tube("satin", [
        { x: x - hw * 0.25, y: y0 + 0.05, z: k.cz - r * 0.7 },
        { x: x - hw * 0.25, y: y0 + 0.05, z: zb },
      ], 0.014);
      p.tube("rubber", [
        { x: x + hw / 2, y: y0 + 0.03, z: k.cz },
        { x: k.brine.x0 + 0.08, y: y0 + 0.03, z: k.cz },
        { x: k.brine.x0 + 0.08, y: k.brine.h, z: k.cz },
      ], 0.005, { bend: 0.05 });
    }
    // The brine tank with its lid and the salt fill opening.
    const bx0 = k.brine.x0;
    p.roundedBox("panel", bx0, s.w / 2, 0, k.brine.h - 0.03, zb + 0.02, zf, 0.03);
    p.roundedBox("paintGray", bx0 + 0.005, s.w / 2 - 0.005, k.brine.h - 0.035, k.brine.h, zb + 0.025, zf - 0.005, 0.015);
    p.lathe("paintGray", (bx0 + s.w / 2) / 2, k.brine.h, (zb + zf) / 2 + 0.01, [
      [0, 0],
      [0.09, 0],
      [0.09, 0.01],
      [0.08, 0.015],
      [0, 0.015],
    ]);
  },
};
