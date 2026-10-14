// Planetary mixer (Planetenrührmaschine): base, column and head in a light grey enamel, the
// stainless bowl on its lifting arms in front of the column, the tool hanging from the planetary
// drive, a wire guard over the bowl. The 10 l size stands on a work table (`tableTop`),
// the 40 and 60 l sizes on the floor with a hand wheel to lift the bowl.

import type { Parts, Size } from "../parts/mesh";
import type { KindDef } from "../types";
import type { Front } from "../parts/elevation";
import type { PlanSketch } from "../parts/plan";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";

/** Bowl rim standing out of the bowl (m). */
const RIM = 0.008;

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
  p.box("panel", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, d / 2);
  p.box("panel", -w * 0.28, w * 0.28, baseTop, headBottom, -d / 2 + 0.01, colFront);
  p.box("panel", -w * 0.3, w * 0.3, headBottom, h, -d / 2 + 0.01, headFront);
  // Speed lever and stop button on the front of the head.
  p.knob(w * 0.18, h * 0.9, headFront, headFront + 0.025, 0.02);
  p.box("knob", -w * 0.22, -w * 0.14, h * 0.88, h * 0.92, headFront, headFront + 0.006);
  // Bowl with its rim and the dark inside, held by two arms from the column.
  p.cyl("steel", 0, zb, yb0, yb1, rb);
  p.cyl("steel", 0, zb, yb1 - 0.01, yb1, rb + RIM);
  p.cyl("steelDark", 0, zb, yb1, yb1 + 0.002, rb - 0.012);
  const armX = Math.min(w / 2, rb + RIM + 0.03);
  for (const sx of [-1, 1]) p.box("panel", sx * (armX - 0.02), sx * armX, yb1 - 0.07, yb1 - 0.04, colFront, zb);
  // Planetary drive under the head, the tool reaching into the bowl and the wire guard.
  const hubTop = headBottom;
  p.cyl("steelDark", 0, zb, hubTop - 0.05, hubTop, 0.045);
  p.cyl("steelDark", rb * 0.3, zb, yb1 - rb * 0.8, hubTop - 0.05, 0.008);
  p.cyl("basket", 0, zb, yb1, yb1 + (hubTop - 0.05 - yb1) * 0.6, rb + RIM);
  if (floor) {
    // Hand wheel on the right of the column lifts the bowl.
    const zc = (-d / 2 + colFront) / 2;
    p.rod("steelDark", "x", w * 0.28 + 0.02, h * 0.5, zc, 0.04, 0.012);
    p.rod("handle", "x", w * 0.28 + 0.045, h * 0.5, zc, 0.012, Math.min(0.08, (colFront + d / 2) / 2));
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
