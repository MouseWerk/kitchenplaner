// Pasta machine (Nudelmaschine), a table-top extruder: a stainless body with the kneading tub on
// top under its clear hinged lid, the die (Matrize) in its ring nut at the front with the cutter,
// the pasta tray under the die and the control panel at the side of the die.

import { roundedRectOutline, type Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";
import { controlPanel, openTop, pushButton, sideSlots } from "./machine";

/** Depth of the kneading tub, its corner radius and rim, and the body's corner radius (m). */
const TUB = 0.1;
const TUB_R = 0.03;
const RIM = 0.008;
const BODY = 0.015;

function layout({ w, d, h }: Size) {
  const front = d / 2 - 0.15;
  const bodyTop = h * 0.66;
  const tub = { x: w / 2 - 0.025, z0: -d / 2 + 0.03, z1: front - 0.02 };
  const die = { y: h * 0.38, r: Math.min(0.05, w * 0.16), z: front + 0.045 };
  return { front, bodyTop, tub, die };
}

export const pastaMachine: KindDef = {
  kind: "pastaMachine",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { front, tub, die } = layout(m);
    pRect(s, "detail", -tub.x, tub.z0, tub.x, tub.z1);
    pCircle(s, "detail", 0, (front + die.z) / 2, die.r);
    pRect(s, "detail", -m.w * 0.36, front + 0.02, m.w * 0.36, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { bodyTop, die } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, bodyTop);
    mBox(f, "detail", -m.w / 2 + 0.02, m.w / 2 - 0.02, bodyTop, m.h, "glass");
    mCircle(f, 0, die.y, die.r);
    mCircle(f, 0, die.y, die.r * 0.6);
    mBox(f, "detail", -m.w * 0.36, m.w * 0.36, 0, 0.06);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { front, bodyTop, tub, die } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, front);
    // The body, open at the top for the kneading tub let into it.
    const tubY = bodyTop - TUB;
    p.roundedBox("steel", -w / 2, w / 2, MACHINE_FOOT, tubY, -d / 2, front, BODY, "vertical");
    openTop(p, "steel", -w / 2, w / 2, -d / 2, front, tubY, bodyTop, roundedRectOutline(-tub.x + RIM, tub.x - RIM, tub.z0 + RIM, tub.z1 - RIM, TUB_R - RIM), BODY);
    // The tub with dough in it, under the clear lid on its hinge.
    p.pan("steel", -tub.x, tub.x, bodyTop - TUB + 0.002, bodyTop + 0.003, tub.z0, tub.z1, { wall: 0.003, r: TUB_R, rim: RIM });
    p.roundedBox("foodCream", -tub.x + 0.015, tub.x - 0.015, bodyTop - 0.09, bodyTop - 0.05, tub.z0 + 0.015, tub.z1 - 0.015, 0.02, "vertical");
    const lh = h - bodyTop - 0.003;
    const hx = tub.x - 0.03;
    const hz = (tub.z1 - tub.z0) / 2 - 0.03;
    p.lathe("glass", 0, bodyTop + 0.003, (tub.z0 + tub.z1) / 2, [
      [0, 0],
      [0.028, 0],
      [0.028, lh * 0.5],
      [0.012, lh],
      [0, lh],
    ], { rect: [hx, hz] });
    p.rod("satin", "x", 0, bodyTop + 0.012, tub.z0 + 0.004, tub.x * 1.4, 0.008);
    // The die in its ring nut, the cutter's blade over it and its motor housing.
    p.lathe("satin", 0, die.y, front, [
      [0, 0],
      [die.r * 1.15, 0],
      [die.r * 1.15, 0.008],
      [die.r, 0.012],
      [die.r, die.z - front - 0.004],
      [die.r * 0.95, die.z - front],
      [die.r * 0.6, die.z - front],
      [die.r * 0.6, die.z - front - 0.004],
      [0, die.z - front - 0.004],
    ], { axis: "z" });
    p.lathe("slot", 0, die.y, die.z - 0.0045, [
      [0, 0],
      [die.r * 0.58, 0],
      [die.r * 0.58, 0.001],
      [0, 0.001],
    ], { axis: "z" });
    p.roundedBox("handle", -0.003, 0.003, die.y - die.r * 0.9, die.y + die.r * 0.1, die.z, die.z + 0.003, 0.0015);
    // The pasta tray under the die.
    p.pan("steel", -w * 0.36, w * 0.36, 0.002, 0.06, front - 0.01, d / 2, { wall: 0.003, r: 0.02 });
    p.roundedBox("foodCream", -w * 0.3, w * 0.3, 0.006, 0.025, front + 0.02, d / 2 - 0.02, 0.008, "vertical");
    // The control panel above the die, vent slots in the side.
    const face = controlPanel(p, -w * 0.38, w * 0.38, bodyTop - 0.1, bodyTop - 0.04, front);
    pushButton(p, -w * 0.18, bodyTop - 0.07, face, 0.011, "panel");
    pushButton(p, 0, bodyTop - 0.07, face, 0.011, "panel");
    pushButton(p, w * 0.18, bodyTop - 0.07, face, 0.011, "knob");
    sideSlots(p, w / 2, 1, MACHINE_FOOT + 0.05, die.y, -d / 2 + 0.05, front - 0.05, 5);
  },
};
