// Chocolate tempering machine (Schokoladen-Temperiermaschine), a table-top unit: a stainless body
// with the control panel at the front, the heated bowl of melted chocolate at the back with the
// feed screw's tube rising out of it to the pouring head, and the vibrating grid over a drip tray
// at the front where the chocolate is poured.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, metres, mLine, pCircle, pRect } from "./common";
import { controlPanel, displayWindow, pushButton, turnedBowl } from "./machine";
import { housing } from "../parts/details";

/** Radius of the screw's tube (m). */
const SCREW = 0.035;

function layout({ w, d, h }: Size) {
  const bodyTop = h * 0.45;
  const r = Math.min(w / 2 - 0.02, d * 0.26);
  const zb = -d / 2 + 0.02 + r;
  const bowlTop = bodyTop + Math.min(0.17, r * 0.85);
  const grid = { z0: zb + r + 0.03, z1: d / 2 - 0.02 };
  return { bodyTop, r, zb, bowlTop, grid };
}

export const temperingMachine: KindDef = {
  kind: "temperingMachine",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { r, zb, grid } = layout(m);
    pCircle(s, "detail", 0, zb, r);
    pCircle(s, "detail", 0, zb, SCREW);
    pRect(s, "detail", -m.w / 2 + 0.03, grid.z0, m.w / 2 - 0.03, grid.z1);
    pRect(s, "detail", -0.02, zb, 0.02, grid.z0 + 0.06);
  },
  elevation(f) {
    const m = metres(f.item);
    const { bodyTop, r, bowlTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, bodyTop);
    mBox(f, "detail", -r, r, bodyTop, bowlTop);
    mBox(f, "detail", -SCREW, SCREW, bowlTop, m.h);
    mLine(f, [-m.w / 2 + 0.03, bodyTop + 0.01], [m.w / 2 - 0.03, bodyTop + 0.01]);
    mBox(f, "detail", -m.w * 0.36, m.w * 0.36, bodyTop * 0.25, bodyTop * 0.75, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { bodyTop, r, zb, bowlTop, grid } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, d / 2 - 0.008);
    housing(p, "steel", -w / 2, w / 2, MACHINE_FOOT, bodyTop, -d / 2, d / 2 - 0.008, 0.015);
    const face = controlPanel(p, -w * 0.36, w * 0.36, bodyTop * 0.25, bodyTop * 0.75, d / 2 - 0.008);
    const yc = bodyTop / 2;
    displayWindow(p, -w * 0.32, -w * 0.02, yc - 0.025, yc + 0.025, face);
    pushButton(p, w * 0.1, yc, face, 0.011, "panel", d / 2 - face);
    pushButton(p, w * 0.24, yc, face, 0.011, "knob", d / 2 - face);
    // The bowl with the melted chocolate.
    turnedBowl(p, "steel", 0, bodyTop - 0.002, zb, r, bowlTop - bodyTop + 0.002);
    p.lathe("foodBrown", 0, bodyTop + 0.01, zb, [
      [0, 0],
      [r - 0.008, 0],
      [r - 0.006, bowlTop - bodyTop - 0.05],
      [0, bowlTop - bodyTop - 0.048],
    ]);
    // The screw's tube rising out of the chocolate, its head bent forward to the pouring nozzle.
    p.lathe("steel", 0, bodyTop + 0.02, zb, [
      [0, 0],
      [SCREW, 0],
      [SCREW, h - bodyTop - 0.02 - 0.012],
      [SCREW - 0.006, h - bodyTop - 0.02],
      [0, h - bodyTop - 0.02],
    ]);
    const hy = h - 0.045;
    p.tube("steel", [{ x: 0, y: hy, z: zb }, { x: 0, y: hy, z: grid.z0 + 0.04 }, { x: 0, y: hy - 0.06, z: grid.z0 + 0.04 }], 0.022, { bend: 0.04 });
    // The vibrating grid over its drip tray.
    p.pan("steel", -w / 2 + 0.03, w / 2 - 0.03, bodyTop - 0.02, bodyTop + 0.012, grid.z0, grid.z1, { wall: 0.003, r: 0.015 });
    p.grid(-w / 2 + 0.035, w / 2 - 0.035, bodyTop + 0.012, bodyTop + 0.018, grid.z0 + 0.005, grid.z1 - 0.005, 0.012, "z");
  },
};
