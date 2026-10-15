// Dough divider and rounder (Teigteil- und Wirkmaschine), a floor unit: a stainless pedestal on
// feet with the control knobs, the round dividing head on top with its lid and the hand lever that
// closes it, the rounding plate in the head's floor where the pieces come out.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot, mBox, mCircle, metres, mLine, pCircle, pRect } from "./common";
import { controlPanel, pilotLamp, pushButton } from "./machine";
import { housing } from "../parts/details";

/** Height of the feet (m). */
const FEET = 0.08;

function layout({ w, d, h }: Size) {
  const bodyTop = h * 0.74;
  const r = Math.min(w / 2 - 0.03, d / 2 - 0.03);
  const headTop = h * 0.86;
  return { bodyTop, r, headTop };
}

export const dividerRounder: KindDef = {
  kind: "dividerRounder",
  plan(s) {
    const m = metres(s.item);
    const { r } = layout(m);
    pCircle(s, "detail", 0, 0, r);
    pCircle(s, "detail", 0, 0, r * 0.8);
    pRect(s, "detail", m.w / 2 - 0.05, -0.02, m.w / 2 - 0.01, m.d / 2 - 0.01);
  },
  elevation(f) {
    const m = metres(f.item);
    const { bodyTop, r, headTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, FEET, bodyTop);
    mBox(f, "detail", -r, r, bodyTop, headTop);
    mBox(f, "detail", -r * 0.8, r * 0.8, headTop, headTop + 0.03);
    mLine(f, [m.w / 2 - 0.03, headTop - 0.05], [m.w / 2 - 0.03, m.h]);
    mCircle(f, -m.w * 0.2, bodyTop - 0.1, 0.025);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { bodyTop, r, headTop } = layout(s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.05), sz * (d / 2 - 0.05), FEET);
    housing(p, "steel", -w / 2, w / 2, FEET, bodyTop, -d / 2, d / 2 - 0.012, 0.015);
    const face = controlPanel(p, -w * 0.4, w * 0.4, bodyTop - 0.17, bodyTop - 0.04, d / 2 - 0.012);
    p.knob(-w * 0.2, bodyTop - 0.105, face, d / 2, 0.022);
    p.knob(0, bodyTop - 0.105, face, d / 2, 0.022);
    pushButton(p, w * 0.17, bodyTop - 0.105, face, 0.012, "panel", d / 2 - face);
    pilotLamp(p, w * 0.3, bodyTop - 0.105, face);
    // The head: a turned drum with the rounding plate's rim showing at its foot, the lid on top.
    const hh = headTop - bodyTop;
    p.lathe("steel", 0, bodyTop - 0.002, 0, [
      [0, 0],
      [r, 0],
      [r, 0.03],
      [r - 0.01, 0.035],
      [r - 0.01, hh - 0.02],
      [r - 0.016, hh],
      [0, hh],
    ]);
    p.ring("satin", 0, 0, bodyTop + 0.03, r - 0.012, 0.004);
    p.lathe("steel", 0, headTop, 0, [
      [0, 0],
      [r * 0.82, 0],
      [r * 0.82, 0.02],
      [r * 0.7, 0.032],
      [0, 0.036],
    ]);
    // The hand lever from its pivot at the right of the head up over the lid.
    const lx = w / 2 - 0.03;
    p.lathe("satin", lx - 0.02, headTop - 0.05, 0, [
      [0, 0],
      [0.03, 0],
      [0.03, 0.04],
      [0, 0.04],
    ], { axis: "x" });
    p.tube("handle", [{ x: lx, y: headTop - 0.05, z: 0 }, { x: lx, y: h - 0.03, z: 0 }, { x: lx, y: h - 0.03, z: d / 2 - 0.06 }], 0.012, { bend: 0.05 });
    p.lathe("knob", lx, h - 0.03, d / 2 - 0.08, [
      [0, 0],
      [0.018, 0],
      [0.022, 0.03],
      [0.02, 0.07],
      [0, 0.08],
    ], { axis: "z" });
    p.lathe("knob", lx, h - 0.06, d / 2 - 0.08, [
      [0, 0],
      [0.012, 0],
      [0.012, 0.06],
      [0, 0.06],
    ]);
  },
};
