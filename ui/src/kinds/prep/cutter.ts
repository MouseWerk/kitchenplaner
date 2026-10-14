// Food processor (Kutter), a table-top unit: the motor base with its buttons, the stainless bowl
// on top, the clear lid with the scraper arm and the lid knob. Stands on a work table
// (`tableTop`).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";

function layout({ w, d, h }: Size) {
  const rb = Math.min(w / 2 - 0.02, d * 0.35);
  const zc = -d / 2 + d * 0.48;
  const front = d / 2 - 0.02;
  return { rb, zc, front, baseTop: h * 0.42, bowlTop: h * 0.78, lidTop: h * 0.88 };
}

export const cutter: KindDef = {
  kind: "cutter",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { rb, zc } = layout(m);
    pCircle(s, "detail", 0, zc, rb);
    pCircle(s, "detail", 0, zc, 0.035);
    pRect(s, "detail", rb, zc - 0.015, m.w / 2, zc + 0.015);
  },
  elevation(f) {
    const m = metres(f.item);
    const { rb, baseTop, bowlTop, lidTop } = layout(m);
    mBox(f, "detail", -m.w * 0.35, m.w * 0.35, m.h * 0.08, m.h * 0.32, "item-dark");
    mBox(f, "detail", -rb, rb, baseTop, bowlTop);
    mBox(f, "detail", -rb, rb, bowlTop, lidTop, "glass");
    mBox(f, "detail", -0.02, 0.02, lidTop, m.h);
    mCircle(f, -m.w * 0.15, m.h * 0.2, 0.018);
    mCircle(f, m.w * 0.15, m.h * 0.2, 0.018);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { rb, zc, front, baseTop, bowlTop, lidTop } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, front);
    p.box("panel", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, front);
    p.box("panelDark", -w * 0.35, w * 0.35, h * 0.08, h * 0.32, front, front + 0.008);
    p.knob(-w * 0.15, h * 0.2, front + 0.008, d / 2, 0.018);
    p.knob(w * 0.15, h * 0.2, front + 0.008, d / 2, 0.018);
    // Bowl with its handle, the clear lid on a dark rim, the scraper arm and the knob.
    p.cyl("steel", 0, zc, baseTop, bowlTop, rb);
    p.box("steel", rb - 0.005, w / 2, h * 0.6, h * 0.66, zc - 0.015, zc + 0.015);
    p.cyl("steelDark", 0, zc, bowlTop, bowlTop + 0.01, rb);
    p.cyl("glass", 0, zc, bowlTop + 0.01, lidTop, rb);
    p.box("handle", 0, rb * 0.8, lidTop, lidTop + 0.01, zc - 0.01, zc + 0.01);
    p.cyl("steelDark", 0, zc, lidTop, h - (h - lidTop) * 0.4, 0.035);
    p.cyl("knob", 0, zc, h - (h - lidTop) * 0.4, h, 0.02);
  },
};
