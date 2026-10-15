// Burger press (Burgerpresse), a hand-operated table-top unit: a cast base plate with the round
// mould at the front, a column at the back and the lever on its pivot that lowers the press
// plate into the mould.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { mBox, mCircle, metres, mLine, pCircle, pRect, rubberFoot } from "./common";

/** Base plate thickness and column radius (m). */
const BASE = 0.02;
const COLUMN = 0.014;

function layout({ w, d, h }: Size) {
  const r = Math.min(w / 2 - 0.02, d * 0.25);
  const zm = d / 2 - 0.02 - r;
  const zc = -d / 2 + 0.03;
  const pivot = h - 0.045;
  return { r, zm, zc, pivot };
}

export const burgerPress: KindDef = {
  kind: "burgerPress",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { r, zm, zc } = layout(m);
    pCircle(s, "detail", 0, zm, r);
    pCircle(s, "detail", 0, zc, COLUMN);
    pRect(s, "detail", -0.012, zc, 0.012, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { r, pivot } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, 0, BASE);
    mBox(f, "detail", -r, r, BASE, BASE + 0.025);
    mBox(f, "detail", -COLUMN, COLUMN, BASE, m.h);
    mLine(f, [0, pivot], [0, BASE + 0.08]);
    mCircle(f, 0, pivot, 0.02);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { r, zm, zc, pivot } = layout(s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rubberFoot(p, sx * (w / 2 - 0.015), sz * (d / 2 - 0.015), 0.01, 0.004);
    p.roundedBox("satin", -w / 2, w / 2, 0.003, BASE, -d / 2, d / 2, 0.006);
    // The mould: a turned ring on the plate with a patty of minced meat in it.
    p.lathe("steel", 0, BASE - 0.001, zm, [
      [r - 0.012, 0],
      [r, 0],
      [r, 0.025],
      [r - 0.003, 0.028],
      [r - 0.012, 0.025],
      [r - 0.012, 0],
    ]);
    p.lathe("foodRed", 0, BASE, zm, [
      [0, 0],
      [r - 0.013, 0],
      [r - 0.013, 0.012],
      [0, 0.014],
    ]);
    // The column with its cap, the lever on its pivot reaching over the mould to the grip.
    p.lathe("steel", 0, BASE, zc, [
      [0, 0],
      [COLUMN * 2, 0],
      [COLUMN * 2, 0.006],
      [COLUMN, 0.014],
      [COLUMN, h - BASE - 0.01],
      [COLUMN * 0.7, h - BASE],
      [0, h - BASE],
    ]);
    p.roundedBox("satin", -0.02, 0.02, pivot - 0.025, pivot + 0.025, zc - 0.02, zc + 0.03, 0.006);
    p.tube("steel", [{ x: 0, y: pivot, z: zc + 0.02 }, { x: 0, y: pivot, z: zm }, { x: 0, y: pivot - 0.02, z: d / 2 - 0.07 }], 0.009, { bend: 0.04 });
    p.lathe("knob", 0, pivot - 0.02, d / 2 - 0.08, [
      [0, 0],
      [0.012, 0],
      [0.016, 0.02],
      [0.015, 0.07],
      [0, 0.08],
    ], { axis: "z" });
    // The plunger from the lever down to the press plate over the mould.
    const plate = BASE + 0.07;
    p.rod("satin", "y", 0, (plate + pivot) / 2, zm, pivot - plate, 0.008);
    p.lathe("steel", 0, plate, zm, [
      [0, 0],
      [r - 0.016, 0],
      [r - 0.016, 0.008],
      [0.015, 0.016],
      [0, 0.016],
    ]);
  },
};
