// Ice crusher (Eiscrusher), a table-top unit: a stainless housing with the clear ice hopper and
// its lid on top, the outlet chute at the front over a removable tray, and the switch.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, metres, pRect } from "./common";
import { pushButton, sideSlots } from "./machine";
import { housing } from "../parts/details";

function layout({ d, h }: Size) {
  const front = d / 2 - 0.13;
  const bodyTop = h * 0.62;
  const chute = { y0: h * 0.3, y1: h * 0.45 };
  return { front, bodyTop, chute };
}

export const iceShaver: KindDef = {
  kind: "iceShaver",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { front } = layout(m);
    pRect(s, "detail", -m.w / 2 + 0.02, -m.d / 2 + 0.02, m.w / 2 - 0.02, front - 0.02);
    pRect(s, "detail", -m.w * 0.3, front, m.w * 0.3, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { bodyTop, chute } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, bodyTop);
    mBox(f, "detail", -m.w / 2 + 0.02, m.w / 2 - 0.02, bodyTop, m.h, "glass");
    mBox(f, "detail", -m.w * 0.3, m.w * 0.3, chute.y0, chute.y1);
    mBox(f, "detail", -m.w * 0.36, m.w * 0.36, 0, 0.08);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { front, bodyTop, chute } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, front);
    housing(p, "steel", -w / 2, w / 2, MACHINE_FOOT, bodyTop, -d / 2, front, 0.015);
    // The hopper: clear walls on the housing, a dark lid with its grip.
    p.roundedBox("glass", -w / 2 + 0.015, w / 2 - 0.015, bodyTop - 0.002, h - 0.02, -d / 2 + 0.015, front - 0.015, 0.012);
    p.roundedBox("knob", -w / 2 + 0.01, w / 2 - 0.01, h - 0.02, h - 0.004, -d / 2 + 0.01, front - 0.01, 0.008);
    p.roundedBox("knob", -0.04, 0.04, h - 0.006, h, front - 0.05, front - 0.02, 0.004);
    // The chute at the front and the tray below it.
    p.roundedBox("steel", -w * 0.3, w * 0.3, chute.y0, chute.y1, front - 0.01, d / 2 - 0.03, 0.01);
    p.box("slot", -w * 0.26, w * 0.26, chute.y0 - 0.001, chute.y0, front, d / 2 - 0.045);
    p.pan("steel", -w * 0.36, w * 0.36, 0.002, 0.08, front - 0.02, d / 2, { wall: 0.003, r: 0.02 });
    p.roundedBox("panel", -w * 0.33, w * 0.33, 0.006, 0.04, front - 0.015, d / 2 - 0.006, 0.01, "vertical");
    pushButton(p, w * 0.25, bodyTop * 0.75, front, 0.012, "knob");
    sideSlots(p, w / 2, 1, bodyTop * 0.3, bodyTop * 0.65, -d / 2 + 0.04, front - 0.04, 4);
  },
};
