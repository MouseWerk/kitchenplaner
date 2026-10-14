// Meat mincer (Fleischwolf), a table-top unit: the motor body at the back, the worm tube
// reaching forward with the ring nut over the cutting plate, the feed throat and the filling
// tray on top. Stands on a work table (`tableTop`).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";

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
    machineFeet(p, -w * 0.42, w * 0.42, -d / 2, bodyFront);
    p.box("steel", -w * 0.42, w * 0.42, MACHINE_FOOT, bodyTop, -d / 2, bodyFront);
    p.knob(w * 0.28, bodyTop * 0.45, bodyFront, bodyFront + 0.02, 0.016);
    // Worm tube, ring nut and the cutting plate's hub at the front.
    const tubeEnd = d / 2 - 0.03;
    p.rod("steel", "z", 0, tubeY, (bodyFront + tubeEnd) / 2, tubeEnd - bodyFront, tubeR);
    p.rod("steelDark", "z", 0, tubeY, d / 2 - 0.015, 0.03, tubeR * 1.35);
    // Feed throat up to the tray, the tray open at the top with the dark throat in its floor.
    p.cyl("steel", 0, throatZ, tubeY, tray.y0, tubeR * 0.8);
    p.tub("steel", -w / 2, w / 2, tray.y0, h, tray.z0, tray.z1);
    p.cyl("steelDark", 0, throatZ, tray.y0 + 0.01, tray.y0 + 0.012, tubeR * 0.7);
  },
};
