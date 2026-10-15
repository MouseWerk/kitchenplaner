// Vegetable preparation machine (Gemüseschneidemaschine), a table-top unit: the motor block at
// the back with its start and stop buttons, the round cutting head on it with the feed hopper,
// its pusher plate and lever, the round feed tube, and the outlet chute at the front over a GN
// pan. Stands on a work table (`tableTop`).

import type { Parts, Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, mLine, pCircle, pRect } from "./common";
import { pushButton, sideSlots } from "./machine";
import { housing, ratingPlate } from "../parts/details";

function layout({ w, d, h }: Size) {
  const motorFront = -d / 2 + d * 0.55;
  const r = Math.min(w / 2 - 0.01, d * 0.3);
  const zc = -d / 2 + d * 0.48;
  const hopper = { x: -r * 0.3, z: zc - r * 0.1, r: r * 0.55 };
  const tube = { x: r * 0.55, z: zc + r * 0.25, r: Math.min(0.03, r * 0.2) };
  const chute = { x: r * 0.55, y0: h * 0.3 };
  return { motorFront, r, zc, hopper, tube, chute, motorTop: h * 0.5, headTop: h * 0.66, hopperTop: h * 0.86 };
}

/** A short turned column with a rim at its top (hopper, feed tube) from y0 to y1 (m). */
function rimmedColumn(p: Parts, x: number, z: number, y0: number, y1: number, r: number): void {
  const lip = Math.min(0.006, r * 0.2);
  p.lathe("steel", x, y0, z, [
    [0, 0],
    [r, 0],
    [r, y1 - y0 - lip * 1.5],
    [r + lip, y1 - y0 - lip],
    [r + lip, y1 - y0],
    [0, y1 - y0],
  ]);
}

export const vegCutter: KindDef = {
  kind: "vegCutter",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { motorFront, r, zc, hopper, tube, chute } = layout(m);
    pRect(s, "hidden", -m.w / 2, -m.d / 2, m.w / 2, motorFront);
    pCircle(s, "detail", 0, zc, r);
    pCircle(s, "detail", hopper.x, hopper.z, hopper.r);
    pCircle(s, "detail", tube.x, tube.z, tube.r);
    pRect(s, "detail", -chute.x, zc + r * 0.4, chute.x, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { r, hopper, chute, motorTop, headTop, hopperTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, motorTop);
    mBox(f, "detail", -r, r, motorTop, headTop);
    mBox(f, "detail", hopper.x - hopper.r, hopper.x + hopper.r, headTop, hopperTop);
    mBox(f, "detail", -chute.x, chute.x, chute.y0, motorTop, "item-dark");
    mLine(f, [hopper.x, hopperTop], [hopper.x, m.h - 0.03]);
    mCircle(f, hopper.x, m.h - 0.02, 0.02);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { motorFront, r, zc, hopper, tube, chute, motorTop, headTop, hopperTop } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, motorFront);
    housing(p, "steel", -w / 2, w / 2, MACHINE_FOOT, motorTop, -d / 2, motorFront);
    // Start and stop buttons on the front of the motor block beside the chute, the rating plate
    // under them, the motor's vent slots in the sides.
    const yb = motorTop * 0.62;
    pushButton(p, -w * 0.36, yb, motorFront, 0.012, "panel");
    pushButton(p, w * 0.36, yb, motorFront, 0.012, "knob");
    ratingPlate(p, -w * 0.32, motorTop * 0.3, motorFront);
    for (const sx of [-1, 1] as const) sideSlots(p, sx * (w / 2), sx, motorTop * 0.35, motorTop * 0.75, -d / 2 + 0.05, motorFront - 0.05, 4);
    // The cutting head: a turned drum with a rounded top edge, its lid seam a dark ring.
    const hh = headTop - motorTop;
    p.lathe("steel", 0, motorTop, zc, [
      [0, 0],
      [r - 0.006, 0],
      [r, 0.006],
      [r, hh - 0.008],
      [r - 0.008, hh],
      [0, hh],
    ]);
    p.ring("steelDark", 0, zc, motorTop + hh * 0.45, r, 0.002);
    // Hopper with its pusher plate, the round feed tube.
    rimmedColumn(p, hopper.x, hopper.z, headTop - 0.002, hopperTop, hopper.r);
    p.lathe("satin", hopper.x, hopperTop, hopper.z, [
      [0, 0],
      [hopper.r * 0.95, 0],
      [hopper.r * 0.95, 0.01],
      [hopper.r * 0.85, 0.02],
      [0, 0.02],
    ]);
    rimmedColumn(p, tube.x, tube.z, headTop - 0.002, hopperTop + 0.02, tube.r);
    // The pusher lever from its hinge post at the back over the hopper, its knob the unit's top.
    const ly = hopperTop + 0.032;
    const zBack = zc - r + 0.02;
    p.lathe("steelDark", hopper.x, headTop - 0.002, zBack, [
      [0, 0],
      [0.016, 0],
      [0.012, 0.01],
      [0.012, ly - headTop + 0.002],
      [0, ly - headTop + 0.002 + 0.012],
    ]);
    const zKnob = zc + r - 0.02;
    p.tube("steel", [{ x: hopper.x, y: ly, z: zBack }, { x: hopper.x, y: ly, z: zKnob }], 0.01);
    p.lathe("knob", hopper.x, ly, zKnob, [
      [0, 0],
      [0.012, 0],
      [0.012, 0.02],
      [0.02, (h - ly) * 0.55],
      [0.018, (h - ly) * 0.85],
      [0.01, h - ly],
      [0, h - ly],
    ]);
    // Outlet chute at the front under the head, with its dark mouth over the GN pan.
    p.roundedBox("steel", -chute.x, chute.x, chute.y0, motorTop, motorFront - 0.01, d / 2, 0.01);
    p.box("slot", -chute.x + 0.012, chute.x - 0.012, chute.y0 - 0.001, chute.y0, motorFront + 0.01, d / 2 - 0.012);
  },
};
