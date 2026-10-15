// Stick blender on a stand (Stabmixer im Ständer), a table-top unit: a base plate with a stock pot
// on it, a satin column at the back with a clamp that holds the blender's motor over the pot, its
// long shaft reaching into the pot down to the blade bell.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { mBox, mCircle, metres, mLine, pCircle, pRect } from "./common";
import { pushButton } from "./machine";

/** Base plate thickness, column radius and the blender's motor radius (m). */
const BASE = 0.012;
const COLUMN = 0.018;
const MOTOR = 0.045;

function layout({ w, d, h }: Size) {
  const zc = -d / 2 + 0.035;
  // Room at the sides for the pot's handles, at the back for the column.
  const r = Math.min(w / 2 - 0.035, (d - 0.09) / 2);
  const zp = d / 2 - 0.01 - r;
  return { zc, r, zp, potTop: BASE + Math.min(0.3, h * 0.36), motor0: h * 0.58, motor1: h * 0.86, clampY: h * 0.72 };
}

export const stickBlender: KindDef = {
  kind: "stickBlender",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { zc, r, zp } = layout(m);
    pCircle(s, "detail", 0, zp, r);
    pCircle(s, "detail", 0, zp, MOTOR);
    pCircle(s, "detail", 0, zc, COLUMN);
    pRect(s, "detail", -0.02, zc, 0.02, zp - MOTOR);
  },
  elevation(f) {
    const m = metres(f.item);
    const { r, potTop, motor0, motor1 } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, 0, BASE);
    mBox(f, "detail", -r, r, BASE, potTop);
    mBox(f, "detail", -MOTOR, MOTOR, motor0, motor1);
    mLine(f, [0, motor0], [0, BASE + 0.04]);
    mBox(f, "detail", -COLUMN, COLUMN, BASE, m.h);
    mCircle(f, 0, (motor1 + m.h) / 2, 0.02);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { zc, r, zp, potTop, motor0, motor1, clampY } = layout(s);
    p.roundedBox("steel", -w / 2, w / 2, 0, BASE, -d / 2, d / 2, 0.004);
    // The stock pot with its rolled rim and two handles.
    const ph = potTop - BASE;
    p.lathe("steel", 0, BASE, zp, [
      [0, 0],
      [r - 0.01, 0],
      [r, 0.01],
      [r, ph - 0.004],
      [r - 0.002, ph],
      [r - 0.004, ph - 0.004],
      [r - 0.004, 0.012],
      [0, 0.012],
    ]);
    for (const sx of [-1, 1]) {
      p.tube("satin", [{ x: sx * (r - 0.004), y: potTop - 0.05, z: zp - 0.03 }, { x: sx * (w / 2 - 0.008), y: potTop - 0.05, z: zp - 0.03 }, { x: sx * (w / 2 - 0.008), y: potTop - 0.05, z: zp + 0.03 }, { x: sx * (r - 0.004), y: potTop - 0.05, z: zp + 0.03 }], 0.006, { bend: 0.012 });
    }
    // The column with its cap, the clamp and the arm to the blender.
    p.lathe("satin", 0, BASE, zc, [
      [0, 0],
      [COLUMN * 1.8, 0],
      [COLUMN * 1.8, 0.006],
      [COLUMN, 0.014],
      [COLUMN, h - BASE - 0.02],
      [COLUMN * 0.8, h - BASE],
      [0, h - BASE],
    ]);
    p.roundedBox("steelDark", -0.03, 0.03, clampY - 0.04, clampY + 0.04, zc - 0.03, zc + 0.03, 0.006);
    p.lathe("knob", 0.03, clampY, zc, [
      [0, 0],
      [0.008, 0],
      [0.008, 0.01],
      [0.014, 0.014],
      [0.014, 0.026],
      [0, 0.028],
    ], { axis: "x" });
    p.roundedBox("steelDark", -0.02, 0.02, clampY - 0.02, clampY + 0.02, zc + 0.03, zp - MOTOR + 0.01, 0.005);
    // The blender: motor housing with its switch and handle loop, the shaft and the blade bell.
    p.lathe("paintGray", 0, motor0, zp, [
      [0, 0],
      [MOTOR * 0.7, 0],
      [MOTOR, 0.03],
      [MOTOR, motor1 - motor0 - 0.015],
      [MOTOR * 0.8, motor1 - motor0],
      [0, motor1 - motor0],
    ]);
    pushButton(p, 0, motor1 - 0.05, zp + MOTOR - 0.004, 0.008, "knob");
    p.tube("knob", [{ x: 0, y: motor1 - 0.01, z: zp - MOTOR * 0.6 }, { x: 0, y: h - 0.02, z: zp - MOTOR * 0.6 }, { x: 0, y: h - 0.02, z: zp + MOTOR * 0.6 }, { x: 0, y: motor1 - 0.01, z: zp + MOTOR * 0.6 }], 0.012, { bend: 0.025 });
    p.lathe("satin", 0, BASE + 0.03, zp, [
      [0, 0],
      [0.035, 0],
      [0.035, 0.012],
      [0.03, 0.03],
      [0.012, 0.045],
      [0.012, motor0 - BASE - 0.03],
      [0, motor0 - BASE - 0.03],
    ]);
  },
};
