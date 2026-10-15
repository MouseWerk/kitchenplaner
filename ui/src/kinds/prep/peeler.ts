// Potato peeler (Kartoffelschälmaschine) on the floor: the drum on its stand with the lid and
// the water inlet, the round discharge hatch at the front over the chute, the control box on the
// stand. It needs cold water and a drain (usually over a floor gully with a peel trap).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot, mBox, mCircle, metres, pCircle, pRect } from "./common";
import { pushButton } from "./machine";
import { housing } from "../parts/details";

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
    housing(p, "steel", -w * 0.42, w * 0.42, FEET, drum0 + 0.01, -d / 2, standFront, 0.01);
    // Control box with its switch on the front of the stand.
    housing(p, "panelDark", w * 0.2, w * 0.42 - 0.004, h * 0.15, h * 0.35, standFront - 0.01, standFront + 0.06, 0.006);
    pushButton(p, w * 0.31, h * 0.29, standFront + 0.06, 0.014, "panel");
    pushButton(p, w * 0.31, h * 0.21, standFront + 0.06, 0.014, "knob");
    // The drum: a turned shell with the abrasive disc's housing at its foot and a rolled top
    // band, the lid with its knob, the water inlet with its valve at the back.
    const dh = drum1 - drum0;
    p.lathe("steel", 0, drum0, zd, [
      [0, 0],
      [r * 0.9, 0],
      [r, 0.02],
      [r, dh - 0.035],
      [r - 0.004, dh - 0.03],
      [r - 0.004, dh],
      [0, dh],
    ]);
    p.ring("steel", 0, zd, drum1 - 0.03, r - 0.012, 0.012);
    p.lathe("steel", 0, drum1, zd, [
      [0, 0],
      [r * 0.92, 0],
      [r * 0.92, (lid - drum1) * 0.5],
      [r * 0.88, lid - drum1],
      [0, lid - drum1],
    ]);
    p.lathe("knob", 0, lid, zd, [
      [0, 0],
      [0.03, 0],
      [0.03, 0.006],
      [0.018, 0.012],
      [0.018, (h - lid) * 0.7],
      [0.026, (h - lid) * 0.85],
      [0.02, h - lid],
      [0, h - lid],
    ]);
    const ix = r * 0.6;
    const iz = zd - r * 0.6;
    p.tube("handle", [{ x: ix, y: drum1 - 0.05, z: iz }, { x: ix, y: drum1 + h * 0.06, z: iz }, { x: ix * 0.5, y: drum1 + h * 0.06, z: iz * 0.6 + zd * 0.4 }], 0.008, { bend: 0.02 });
    p.lathe("satin", ix, drum1 + h * 0.03, iz, [
      [0, 0],
      [0.014, 0],
      [0.014, 0.025],
      [0, 0.025],
    ]);
    // Discharge hatch with its lever, and the chute below it out to the front.
    const zh = zd + r;
    p.lathe("steel", 0, hatchY, zh - 0.004, [
      [0, 0],
      [r * 0.38, 0],
      [r * 0.38, 0.01],
      [r * 0.34, 0.016],
      [0, 0.016],
    ], { axis: "z" });
    p.tube("handle", [{ x: -0.06, y: hatchY, z: zh + 0.012 }, { x: -0.06, y: hatchY, z: zh + 0.028 }, { x: 0.06, y: hatchY, z: zh + 0.028 }, { x: 0.06, y: hatchY, z: zh + 0.012 }], 0.006, { bend: 0.012 });
    const cw = r * 0.45;
    const cy0 = h * 0.4;
    p.extrude("steel", "z", zd + r * 0.8, d / 2, [
      [-cw, cy0 + 0.06],
      [-cw, cy0],
      [cw, cy0],
      [cw, cy0 + 0.06],
      [cw - 0.006, cy0 + 0.06],
      [cw - 0.006, cy0 + 0.006],
      [-cw + 0.006, cy0 + 0.006],
      [-cw + 0.006, cy0 + 0.06],
    ]);
  },
};
