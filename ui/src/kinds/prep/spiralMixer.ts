// Spiral mixer (Spiralkneter), a floor unit: an enamelled body on feet whose column at the back
// carries the head over the bowl, the stainless bowl turning on the base in front, the spiral hook
// and the breaker bar hanging from the head into the dough, a wire guard over the bowl and the
// timers on the head.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot, mBox, mCircle, metres, pCircle, pRect } from "./common";
import { controlPanel, pushButton, turnedBowl } from "./machine";
import { housing } from "../parts/details";

/** Height of the feet (m). */
const FEET = 0.04;
/** Wires of the bowl guard. */
const GUARD_WIRES = 18;

function layout({ w, d, h }: Size) {
  const baseTop = h * 0.36;
  const colFront = -d / 2 + d * 0.34;
  const headBottom = h * 0.8;
  const r = Math.min(w / 2 - 0.015, (d - (colFront + d / 2)) / 2 - 0.01);
  const zb = d / 2 - 0.01 - r;
  const bowlTop = baseTop + Math.min(r * 1.05, headBottom - baseTop - 0.12);
  return { baseTop, colFront, headBottom, r, zb, bowlTop };
}

export const spiralMixer: KindDef = {
  kind: "spiralMixer",
  plan(s) {
    const m = metres(s.item);
    const { colFront, r, zb } = layout(m);
    pRect(s, "detail", -m.w / 2 + 0.02, -m.d / 2 + 0.01, m.w / 2 - 0.02, colFront);
    pCircle(s, "detail", 0, zb, r);
    pCircle(s, "detail", r * 0.35, zb, 0.03);
    pRect(s, "hidden", -m.w * 0.3, colFront, m.w * 0.3, zb + r * 0.4);
  },
  elevation(f) {
    const m = metres(f.item);
    const { baseTop, headBottom, r, bowlTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, FEET, baseTop);
    mBox(f, "detail", -m.w / 2 + 0.02, m.w / 2 - 0.02, headBottom, m.h);
    mBox(f, "detail", -r, r, baseTop, bowlTop);
    mCircle(f, -m.w * 0.2, (headBottom + m.h) / 2, 0.025);
    mCircle(f, m.w * 0.2, (headBottom + m.h) / 2, 0.025);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { baseTop, colFront, headBottom, r, zb, bowlTop } = layout(s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.05), sz * (d / 2 - 0.05), FEET);
    // Base, column and head: one enamelled body.
    housing(p, "paintGray", -w / 2, w / 2, FEET, baseTop, -d / 2, d / 2, 0.02);
    housing(p, "paintGray", -w / 2 + 0.02, w / 2 - 0.02, baseTop - 0.01, headBottom + 0.02, -d / 2 + 0.004, colFront, 0.03);
    housing(p, "paintGray", -w / 2 + 0.01, w / 2 - 0.01, headBottom, h, -d / 2 + 0.008, zb + r * 0.45, 0.04);
    // The timers and buttons on the head's front.
    const zFace = zb + r * 0.45;
    const face = controlPanel(p, -w * 0.38, w * 0.38, headBottom + (h - headBottom) * 0.2, h - (h - headBottom) * 0.2, zFace);
    const yc = (headBottom + h) / 2;
    for (const sx of [-1, 1]) p.knob(sx * w * 0.2, yc, face, face + 0.022, 0.02);
    pushButton(p, -w * 0.04, yc, face, 0.011, "panel");
    pushButton(p, w * 0.04, yc, face, 0.011, "knob");
    // The bowl on its turntable, the spiral hook and the breaker bar, the wire guard.
    p.lathe("satin", 0, baseTop - 0.002, zb, [
      [0, 0],
      [r * 0.7, 0],
      [r * 0.7, 0.025],
      [0, 0.025],
    ]);
    turnedBowl(p, "steel", 0, baseTop + 0.02, zb, r, bowlTop - baseTop - 0.02, 0.005);
    const hookX = r * 0.3;
    const top = headBottom;
    const bottom = baseTop + 0.06;
    const turns = 2.25;
    const steps = 18;
    const rs = r * 0.22;
    const spiral = Array.from({ length: steps + 1 }, (_, k) => {
      const t = k / steps;
      const a = t * turns * Math.PI * 2;
      return { x: hookX + rs * Math.cos(a), y: bowlTop - 0.02 - t * (bowlTop - 0.02 - bottom), z: zb + rs * Math.sin(a) };
    });
    p.tube("satin", [{ x: hookX + rs, y: top, z: zb }, ...spiral], 0.01, { bend: 0.02 });
    p.lathe("satin", hookX, top - 0.04, zb, [
      [0, 0],
      [0.03, 0],
      [0.035, 0.04],
      [0, 0.04],
    ]);
    p.rod("satin", "y", -r * 0.45, (bottom + 0.04 + top) / 2, zb, top - bottom - 0.04, 0.012);
    p.wireCage(0, zb, bowlTop + 0.01, Math.min(headBottom - 0.02, bowlTop + 0.12), r, GUARD_WIRES);
  },
};
