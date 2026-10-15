// Dough sheeter (Teigausrollmaschine) on its stand: the roller housing in the middle with the
// thickness lever, a conveyor belt table to each side with its end roller, guards over the
// rollers, flour trays under the belts; the stand on castors.

import { SHELF_PITCH, type Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { CASTOR, mBox, mCircle, metres, pRect, tableCastor } from "./common";

/** Width of the roller guard beside the housing (m). */
const GUARD = 0.12;

function layout({ w, d, h }: Size) {
  const tower = Math.min(0.28, w * 0.12);
  const stand = Math.min(0.5, w * 0.22);
  const belt = { y0: h * 0.72, y1: h * 0.75, z: d * 0.33 };
  const front = d / 2 - 0.03;
  return { tower, stand, belt, front, towerY: h * 0.62 };
}

/** The x range from a to b in increasing order. */
function span(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

export const doughSheeter: KindDef = {
  kind: "doughSheeter",
  plan(s) {
    const m = metres(s.item);
    const { tower, belt } = layout(m);
    for (const sx of [-1, 1]) {
      const [x0, x1] = span(sx * (tower + GUARD), sx * (m.w / 2));
      pRect(s, "detail", x0, -belt.z, x1, belt.z);
    }
    pRect(s, "detail", -tower, -m.d / 2, tower, m.d / 2 - 0.03);
  },
  elevation(f) {
    const m = metres(f.item);
    const { tower, stand, belt, towerY } = layout(m);
    mBox(f, "detail", -stand, stand, 0.11, towerY);
    for (const sx of [-1, 1]) {
      const [x0, x1] = span(sx * tower, sx * (m.w / 2));
      mBox(f, "detail", x0, x1, belt.y0, belt.y1 + 0.008);
      const cx = sx * (stand - 0.04);
      mBox(f, "detail", cx - 0.015, cx + 0.015, 0, 0.09);
    }
    mBox(f, "detail", -tower, tower, towerY, m.h);
    mCircle(f, 0, m.h * 0.85, 0.04);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { tower, stand, belt, front, towerY } = layout(s);
    // Stand on castors.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tableCastor(p, sx * (stand - 0.04), sz * (d / 2 - 0.1));
    p.box("steel", -stand, stand, CASTOR, towerY, -d / 2 + 0.05, d / 2 - 0.08);
    // Roller housing with the control strip and the thickness lever on its front.
    p.box("steel", -tower, tower, towerY, h, -d / 2, front);
    p.box("steelDark", -tower + 0.01, tower - 0.01, h - 0.02, h, -d / 2 + 0.02, front - 0.02);
    p.box("panelDark", -tower * 0.7, tower * 0.7, towerY + 0.03, towerY + 0.09, front, front + 0.01);
    p.knob(0, h * 0.85, front, d / 2, 0.04);
    for (const sx of [-1, 1]) {
      // Belt table frame, the light belt on it and the end roller.
      const [x0, x1] = span(sx * tower, sx * (w / 2 - 0.025));
      p.box("steel", x0, x1, belt.y0, belt.y1, -belt.z, belt.z);
      p.box("panel", x0 + 0.01, x1 - 0.01, belt.y1, belt.y1 + 0.008, -belt.z + 0.02, belt.z - 0.02);
      p.rod("steelDark", "z", sx * (w / 2 - 0.025), belt.y1 - 0.01, 0, belt.z * 2, 0.025);
      // Guard over the rollers beside the housing.
      const [g0, g1] = span(sx * tower, sx * (tower + GUARD));
      p.wireBox(g0, g1, belt.y1, belt.y1 + 0.12, -belt.z, belt.z, SHELF_PITCH, { bottom: false, top: true });
      // Flour tray under the belt.
      const [t0, t1] = span(sx * (tower + 0.05), sx * (w / 2 - 0.15));
      p.tub("steelDark", t0, t1, belt.y0 - 0.06, belt.y0 - 0.02, -belt.z + 0.03, belt.z - 0.03);
    }
  },
};
