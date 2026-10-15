// Dough sheeter (Teigausrollmaschine) on its stand: the roller housing in the middle with the
// thickness lever, a conveyor belt table to each side with its end roller, guards over the
// rollers, flour trays under the belts; the stand on castors.

import { TOP_RADIUS, type Size, WIRE_FRAME } from "../parts/mesh";
import type { KindDef } from "../types";
import { CASTOR, mBox, mCircle, metres, pRect, tableCastor } from "./common";
import { controlPanel, pushButton } from "./machine";
import { housing, ratingPlate } from "../parts/details";

/** Width, height and wire pitch of the roller guard beside the housing (m). */
const GUARD = 0.12;
const GUARD_H = 0.12;
const GUARD_PITCH = 0.04;

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
    housing(p, "steel", -stand, stand, CASTOR, towerY, -d / 2 + 0.05, d / 2 - 0.08, 0.01);
    ratingPlate(p, stand - 0.07, CASTOR + 0.06, d / 2 - 0.08);
    // Roller housing with its dark top cover, the control panel and the thickness lever.
    housing(p, "steel", -tower, tower, towerY, h - 0.012, -d / 2, front, 0.012);
    p.roundedBox("steelDark", -tower + 0.006, tower - 0.006, h - 0.016, h, -d / 2 + 0.006, front - 0.006, 0.006);
    const face = controlPanel(p, -tower * 0.75, tower * 0.75, towerY + 0.025, towerY + 0.1, front);
    pushButton(p, -tower * 0.4, towerY + 0.0625, face, 0.012, "panel", d / 2 - face);
    pushButton(p, tower * 0.4, towerY + 0.0625, face, 0.012, "knob", d / 2 - face);
    // The lever turns on a satin hub; its arm reaches up and to the side.
    const ly = h * 0.85;
    p.lathe("satin", 0, ly, front, [
      [0, 0],
      [0.04, 0],
      [0.04, 0.006],
      [0.03, 0.012],
      [0, 0.012],
    ], { axis: "z" });
    p.tube("handle", [{ x: 0, y: ly, z: front + 0.012 }, { x: tower * 0.55, y: ly + 0.07, z: front + 0.012 }], 0.007);
    p.lathe("knob", tower * 0.55, ly + 0.07, front + 0.005, [
      [0, 0],
      [0.014, 0],
      [0.016, 0.01],
      [0.012, d / 2 - front - 0.005],
      [0, d / 2 - front - 0.005],
    ], { axis: "z" });
    for (const sx of [-1, 1]) {
      // Belt table frame, the light belt on it and the end roller.
      const [x0, x1] = span(sx * tower, sx * (w / 2 - 0.025));
      p.roundedBox("steel", x0, x1, belt.y0, belt.y1, -belt.z, belt.z, TOP_RADIUS);
      p.roundedBox("panel", x0 + 0.01, x1 - 0.01, belt.y1 - 0.002, belt.y1 + 0.008, -belt.z + 0.02, belt.z - 0.02, 0.003);
      const rx = sx * (w / 2 - 0.025);
      p.lathe("satin", rx, belt.y1 - 0.01, -belt.z, [
        [0, 0],
        [0.025, 0],
        [0.025, belt.z * 2],
        [0, belt.z * 2],
      ], { axis: "z" });
      // Guard over the rollers beside the housing: a wire grid on four posts.
      const [g0, g1] = span(sx * tower, sx * (tower + GUARD));
      const gy = belt.y1 + GUARD_H;
      p.grid(g0, g1, gy - 2 * WIRE_FRAME, gy, -belt.z, belt.z, GUARD_PITCH, "x");
      for (const x of [g0 + WIRE_FRAME, g1 - WIRE_FRAME]) {
        for (const z of [-belt.z + WIRE_FRAME, belt.z - WIRE_FRAME]) p.rod("wire", "y", x, (belt.y1 + gy) / 2, z, GUARD_H, WIRE_FRAME);
      }
      // Flour tray under the belt.
      const [t0, t1] = span(sx * (tower + 0.05), sx * (w / 2 - 0.15));
      p.pan("steel", t0, t1, belt.y0 - 0.06, belt.y0 - 0.02, -belt.z + 0.03, belt.z - 0.03, { wall: 0.003, r: 0.02 });
    }
  },
};
