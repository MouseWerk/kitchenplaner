// Potato peeler (Kartoffelschälmaschine) on the floor: the drum on its stand with the lid and
// the water inlet, the round discharge hatch at the front over the chute, the control box on the
// stand. It needs cold water and a drain (usually over a floor gully with a peel trap).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot, mBox, mCircle, metres, pCircle, pRect } from "./common";

/** Height of the feet under the stand (m). */
const FEET = 0.1;

function layout({ w, d, h }: Size) {
  const r = Math.min(w / 2, d * 0.34);
  const zd = -d / 2 + r + 0.01;
  const standFront = -d / 2 + d * 0.66;
  return { r, zd, standFront, drum0: h * 0.45, drum1: h * 0.88, lid: h * 0.91, hatchY: h * 0.62 };
}

export const peeler: KindDef = {
  kind: "peeler",
  plan(s) {
    const m = metres(s.item);
    const { r, zd } = layout(m);
    pCircle(s, "detail", 0, zd, r);
    pCircle(s, "detail", 0, zd, r * 0.92);
    pRect(s, "detail", -r * 0.45, zd + r * 0.8, r * 0.45, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { r, drum0, drum1, lid, hatchY } = layout(m);
    mBox(f, "detail", -m.w * 0.42, m.w * 0.42, FEET, drum0);
    mBox(f, "detail", -r, r, drum0, drum1);
    mBox(f, "detail", -r * 0.92, r * 0.92, drum1, lid);
    mCircle(f, 0, hatchY, r * 0.38);
    mBox(f, "detail", -r * 0.45, r * 0.45, m.h * 0.4, m.h * 0.46);
    mBox(f, "detail", m.w * 0.2, m.w * 0.42, m.h * 0.15, m.h * 0.35, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { r, zd, standFront, drum0, drum1, lid, hatchY } = layout(s);
    for (const sx of [-1, 1]) for (const z of [-d / 2 + 0.04, standFront - 0.04]) foot(p, sx * (w * 0.42 - 0.04), z, FEET);
    p.box("steel", -w * 0.42, w * 0.42, FEET, drum0, -d / 2, standFront);
    // Control box with its switch on the front of the stand.
    p.box("panelDark", w * 0.2, w * 0.42, h * 0.15, h * 0.35, standFront, standFront + 0.06);
    p.knob(w * 0.31, h * 0.25, standFront + 0.06, standFront + 0.085, 0.02);
    // Drum with its top band, the lid with its knob and the water inlet at the back.
    p.cyl("steel", 0, zd, drum0, drum1, r);
    p.cyl("steelDark", 0, zd, drum1 - 0.03, drum1, r);
    p.cyl("steel", 0, zd, drum1, lid, r * 0.92);
    p.cyl("knob", 0, zd, lid, h, 0.025);
    p.cyl("handle", r * 0.6, zd - r * 0.6, drum1, drum1 + h * 0.07, 0.012);
    // Discharge hatch with its lever, and the chute below it out to the front.
    p.rod("steelDark", "z", 0, hatchY, zd + r + 0.008, 0.016, r * 0.38);
    p.box("handle", -0.06, 0.06, hatchY - 0.008, hatchY + 0.008, zd + r + 0.016, zd + r + 0.03);
    p.box("steel", -r * 0.45, r * 0.45, h * 0.4, h * 0.42, zd + r * 0.8, d / 2);
    for (const sx of [-1, 1]) p.box("steel", sx * r * 0.45 - 0.004, sx * r * 0.45 + 0.004, h * 0.42, h * 0.46, zd + r * 0.8, d / 2);
  },
};
