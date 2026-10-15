// Steak tenderiser (Steakmaschine), a table-top unit: a stainless housing with the feed funnel on
// top and its hinged safety cover, the counter-rotating blade rollers inside, the outlet at the
// front low down over a tray, and the buttons above it.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, metres, pRect } from "./common";
import { pushButton, sideSlots } from "./machine";
import { housing, ratingPlate } from "../parts/details";

function layout({ w, d, h }: Size) {
  const bodyTop = h * 0.78;
  const front = d / 2 - 0.09;
  const slot = { x: w * 0.3, z0: -d * 0.12, z1: d * 0.04 };
  return { bodyTop, front, slot };
}

export const tenderiser: KindDef = {
  kind: "tenderiser",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { front, slot } = layout(m);
    pRect(s, "detail", -slot.x - 0.02, slot.z0 - 0.02, slot.x + 0.02, slot.z1 + 0.02);
    pRect(s, "detail", -slot.x, slot.z0, slot.x, slot.z1);
    pRect(s, "detail", -m.w * 0.36, front, m.w * 0.36, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { bodyTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, bodyTop);
    mBox(f, "detail", -m.w * 0.36, m.w * 0.36, bodyTop, m.h);
    mBox(f, "detail", -m.w * 0.3, m.w * 0.3, MACHINE_FOOT + 0.06, MACHINE_FOOT + 0.1, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { bodyTop, front, slot } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, front);
    housing(p, "steel", -w / 2, w / 2, MACHINE_FOOT, bodyTop, -d / 2, front, 0.015);
    // The feed funnel with its dark slot down to the rollers, the safety cover hinged behind it.
    p.roundedBox("steel", -slot.x - 0.02, slot.x + 0.02, bodyTop - 0.01, h - 0.012, slot.z0 - 0.02, slot.z1 + 0.02, 0.008);
    p.box("slot", -slot.x, slot.x, h - 0.0125, h - 0.012, slot.z0, slot.z1);
    p.roundedBox("satin", -slot.x - 0.025, slot.x + 0.025, h - 0.012, h, slot.z0 - 0.08, slot.z0 - 0.025, 0.005);
    p.rod("satin", "x", 0, h - 0.006, slot.z0 - 0.025, slot.x * 2, 0.006);
    // The outlet low at the front with the tray it drops the meat on.
    p.plate("slot", -w * 0.3, w * 0.3, MACHINE_FOOT + 0.06, MACHINE_FOOT + 0.1, front, front + 0.001, 0.01);
    p.pan("steel", -w * 0.36, w * 0.36, 0.002, 0.045, front - 0.01, d / 2, { wall: 0.003, r: 0.015 });
    // Start and stop and the rating plate on the front, vent slots in the left side.
    pushButton(p, w * 0.2, bodyTop * 0.75, front, 0.012, "panel");
    pushButton(p, -w * 0.2, bodyTop * 0.75, front, 0.012, "knob");
    ratingPlate(p, 0, bodyTop * 0.5, front);
    sideSlots(p, -w / 2, -1, bodyTop * 0.3, bodyTop * 0.7, -d / 2 + 0.05, front - 0.05, 5);
  },
};
