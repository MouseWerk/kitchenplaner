// Planetary mixer (Planetenrührmaschine): base, column and head in a light grey enamel, the
// stainless bowl on its lifting arms in front of the column, the tool hanging from the planetary
// drive, a wire guard over the bowl. The 10 l size stands on a work table (`tableTop`),
// the 40 and 60 l sizes on the floor with a hand wheel to lift the bowl.

import type { Parts, Size } from "../parts/mesh";
import type { KindDef } from "../types";
import type { Front } from "../parts/elevation";
import type { PlanSketch } from "../parts/plan";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";
import { controlPanel, displayWindow, handWheel, pushButton, turnedBowl } from "./machine";
import { housing } from "../parts/details";

/** Bowl rim standing out of the bowl (m). */
const RIM = 0.008;
/** Upright wires of the bowl guard. */
const GUARD_WIRES = 16;

function layout({ w, d, h }: Size, floor: boolean) {
  const baseTop = MACHINE_FOOT + h * (floor ? 0.05 : 0.07);
  const colFront = -d / 2 + d * 0.32;
  const headBottom = h * 0.8;
  const headFront = d / 2 - d * 0.15;
  const rb = Math.min(w / 2 - 0.02, d * 0.32);
  const zb = d / 2 - rb - RIM;
  const yb0 = h * (floor ? 0.32 : 0.14);
  const yb1 = yb0 + rb * (floor ? 1.5 : 1.3);
  return { baseTop, colFront, headBottom, headFront, rb, zb, yb0, yb1 };
}

function plan(s: PlanSketch, floor: boolean) {
  const m = metres(s.item);
  const { colFront, headFront, rb, zb } = layout(m, floor);
  pRect(s, "detail", -m.w * 0.28, -m.d / 2 + 0.01, m.w * 0.28, colFront);
  pCircle(s, "detail", 0, zb, rb + RIM);
  pRect(s, "hidden", -m.w * 0.3, colFront, m.w * 0.3, headFront);
}

function elevation(f: Front, floor: boolean) {
  const m = metres(f.item);
  const { baseTop, headBottom, rb, yb0, yb1 } = layout(m, floor);
  mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, baseTop);
  mBox(f, "detail", -m.w * 0.28, m.w * 0.28, baseTop, headBottom);
  mBox(f, "detail", -m.w * 0.3, m.w * 0.3, headBottom, m.h);
  mBox(f, "detail", -rb, rb, yb0, yb1);
  mBox(f, "detail", -rb - RIM, rb + RIM, yb1 - 0.01, yb1);
  mCircle(f, m.w * 0.18, m.h * 0.9, 0.02);
}

function mesh(p: Parts, s: Size, floor: boolean) {
  const { w, d, h } = s;
  const { baseTop, colFront, headBottom, headFront, rb, zb, yb0, yb1 } = layout(s, floor);
  machineFeet(p, -w / 2, w / 2, -d / 2, d / 2);
  // Base, column and head: one enamelled casting, drawn as three pressed housings.
  housing(p, "paintGray", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, d / 2, 0.015);
  housing(p, "paintGray", -w * 0.28, w * 0.28, baseTop - 0.01, headBottom + 0.02, -d / 2 + 0.014, colFront, 0.02);
  housing(p, "paintGray", -w * 0.3, w * 0.3, headBottom, h, -d / 2 + 0.01, headFront, 0.03);
  // Controls on the front of the head: the timer display, start and stop, the speed knob.
  const face = controlPanel(p, -w * 0.24, w * 0.24, h - (h - headBottom) * 0.8, h - (h - headBottom) * 0.2, headFront);
  const yc = h - (h - headBottom) / 2;
  displayWindow(p, -w * 0.2, -w * 0.04, yc - 0.015, yc + 0.015, face);
  pushButton(p, w * 0.02, yc, face, 0.009, "panel");
  pushButton(p, w * 0.08, yc, face, 0.009, "knob");
  p.knob(w * 0.17, yc, face, face + 0.02, 0.016);
  // The bowl with its rolled rim, held by two arms from the column on satin lugs.
  turnedBowl(p, "steel", 0, yb0, zb, rb, yb1 - yb0);
  p.ring("steel", 0, zb, yb1 - 0.004, rb + RIM - 0.004, 0.004);
  const armX = Math.min(w / 2, rb + RIM + 0.03);
  for (const sx of [-1, 1]) {
    p.roundedBox("paintGray", sx > 0 ? armX - 0.02 : -armX, sx > 0 ? armX : -armX + 0.02, yb1 - 0.075, yb1 - 0.04, colFront - 0.01, zb, 0.006);
    const lug = armX - 0.02 - rb + 0.004;
    p.rod("satin", "x", sx * (rb - 0.004 + lug / 2), yb1 - 0.0575, zb, lug, 0.012);
  }
  // Planetary drive under the head, the flat beater reaching into the bowl and the wire guard.
  const hubTop = headBottom;
  p.lathe("satin", 0, hubTop - 0.06, zb, [
    [0, 0],
    [0.03, 0],
    [0.04, 0.02],
    [0.05, 0.05],
    [0.05, 0.06],
    [0, 0.06],
  ]);
  const ri = rb * 0.62;
  const yTool = yb0 + 0.03;
  p.tube(
    "satin",
    [
      { x: 0, y: hubTop - 0.06, z: zb },
      { x: 0, y: yb1 - 0.02, z: zb },
      { x: -ri, y: yb1 - rb * 0.35, z: zb },
      { x: -ri * 0.7, y: yTool, z: zb },
      { x: ri * 0.7, y: yTool, z: zb },
      { x: ri, y: yb1 - rb * 0.35, z: zb },
      { x: 0, y: yb1 - 0.02, z: zb },
    ],
    0.006,
    { bend: rb * 0.25 },
  );
  p.wireCage(0, zb, yb1, yb1 + (hubTop - 0.06 - yb1) * 0.6, rb + RIM, GUARD_WIRES);
  if (floor) {
    // Hand wheel on the right of the column lifts the bowl.
    const zc = (-d / 2 + colFront) / 2;
    const r = Math.min(0.08, (colFront + d / 2) / 2 - 0.01);
    p.rod("satin", "x", w * 0.28 + 0.015, h * 0.5, zc, 0.03, 0.012);
    handWheel(p, w * 0.28 + 0.035, h * 0.5, zc, r, 0.008, 1);
  }
}

export const mixerTable: KindDef = {
  kind: "mixerTable",
  placement: "tableTop",
  plan: (s) => plan(s, false),
  elevation: (f) => elevation(f, false),
  mesh: (p, s) => mesh(p, s, false),
};

export const mixerFloor: KindDef = {
  kind: "mixerFloor",
  plan: (s) => plan(s, true),
  elevation: (f) => elevation(f, true),
  mesh: (p, s) => mesh(p, s, true),
};
