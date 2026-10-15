// Meat mincer (Fleischwolf), a table-top unit: the motor body at the back, the worm tube
// reaching forward with the ring nut over the cutting plate, the feed throat and the filling
// tray on top. Stands on a work table (`tableTop`).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";
import { pushButton, sideSlots } from "./machine";
import { housing, ratingPlate } from "../parts/details";

function layout({ w, d, h }: Size) {
  const bodyFront = -d / 2 + d * 0.55;
  const tubeR = Math.min(0.045, w * 0.15, h * 0.1);
  const tubeY = h * 0.5;
  const throatZ = bodyFront + (d / 2 - 0.03 - bodyFront) * 0.3;
  const tray = { y0: h * 0.9, z0: throatZ - d * 0.22, z1: throatZ + d * 0.22 };
  return { bodyFront, tubeR, tubeY, throatZ, tray, bodyTop: h * 0.62 };
}

export const mincer: KindDef = {
  kind: "mincer",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { bodyFront, tubeR, throatZ, tray } = layout(m);
    pRect(s, "hidden", -m.w * 0.42, -m.d / 2, m.w * 0.42, bodyFront);
    pRect(s, "detail", -m.w / 2, tray.z0, m.w / 2, tray.z1);
    pCircle(s, "detail", 0, throatZ, tubeR * 0.8);
    pRect(s, "detail", -tubeR * 1.35, tray.z1, tubeR * 1.35, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { tubeR, tubeY, tray, bodyTop } = layout(m);
    mBox(f, "detail", -m.w * 0.42, m.w * 0.42, MACHINE_FOOT, bodyTop);
    mBox(f, "detail", -tubeR * 0.8, tubeR * 0.8, tubeY, tray.y0);
    mBox(f, "detail", -m.w / 2, m.w / 2, tray.y0, m.h);
    // The ring nut faces the viewer.
    mCircle(f, 0, tubeY, tubeR * 1.35);
    mCircle(f, 0, tubeY, tubeR * 0.6);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { bodyFront, tubeR, tubeY, throatZ, tray, bodyTop } = layout(s);
    const bw = w * 0.42;
    machineFeet(p, -bw, bw, -d / 2, bodyFront);
    housing(p, "steel", -bw, bw, MACHINE_FOOT, bodyTop, -d / 2, bodyFront, 0.012);
    pushButton(p, w * 0.28, bodyTop * 0.42, bodyFront, 0.011, "panel");
    pushButton(p, w * 0.28, bodyTop * 0.25, bodyFront, 0.011, "knob");
    ratingPlate(p, -w * 0.24, bodyTop * 0.3, bodyFront);
    for (const sx of [-1, 1] as const) sideSlots(p, sx * bw, sx, bodyTop * 0.3, bodyTop * 0.7, -d / 2 + 0.04, bodyFront - 0.04, 5);
    // Worm tube with its flange at the body, the ring nut over the cutting plate at the front.
    const tubeEnd = d / 2 - 0.03;
    const len = tubeEnd - bodyFront;
    p.lathe(
      "steel",
      0,
      tubeY,
      bodyFront,
      [
        [0, 0],
        [tubeR * 1.2, 0],
        [tubeR * 1.2, 0.01],
        [tubeR, 0.018],
        [tubeR, len],
        [0, len],
      ],
      { axis: "z" },
    );
    const nut = tubeR * 1.35;
    p.lathe(
      "satin",
      0,
      tubeY,
      tubeEnd - 0.01,
      [
        [0, 0],
        [nut * 0.9, 0],
        [nut, 0.006],
        [nut, 0.034],
        [nut * 0.92, 0.04],
        [nut * 0.62, 0.04],
        [nut * 0.62, 0.035],
        [0, 0.035],
      ],
      { axis: "z" },
    );
    // The cutting plate's holes seen in the nut's opening, and the nut's two wings.
    p.lathe(
      "slot",
      0,
      tubeY,
      tubeEnd + 0.025,
      [
        [0, 0],
        [nut * 0.6, 0],
        [nut * 0.6, 0.001],
        [0, 0.001],
      ],
      { axis: "z" },
    );
    for (const sx of [-1, 1]) p.roundedBox("satin", sx > 0 ? nut - 0.004 : -nut - 0.028, sx > 0 ? nut + 0.028 : -nut + 0.004, tubeY - 0.008, tubeY + 0.008, tubeEnd - 0.002, tubeEnd + 0.024, 0.004);
    // Feed throat up to the tray, the tray with its rim and the dark throat in its floor.
    p.lathe("steel", 0, tubeY, throatZ, [
      [0, 0],
      [tubeR * 0.8, 0],
      [tubeR * 0.8, tray.y0 - tubeY - 0.01],
      [tubeR * 1.1, tray.y0 - tubeY],
      [0, tray.y0 - tubeY],
    ]);
    p.pan("steel", -w / 2, w / 2, tray.y0, h, tray.z0, tray.z1, { wall: 0.003, r: 0.03 });
    p.lathe("slot", 0, tray.y0 + 0.0035, throatZ, [
      [0, 0],
      [tubeR * 0.65, 0],
      [tubeR * 0.65, 0.001],
      [0, 0.001],
    ]);
  },
};
