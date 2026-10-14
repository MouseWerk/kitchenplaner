// Vegetable preparation machine (Gemüseschneidemaschine), a table-top unit: the motor block at
// the back, the round cutting head on it with the feed hopper and its pusher lever, the outlet
// chute at the front over a GN pan. Stands on a work table (`tableTop`).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, mLine, pCircle, pRect } from "./common";

function layout({ w, d, h }: Size) {
  const motorFront = -d / 2 + d * 0.55;
  const r = Math.min(w / 2 - 0.01, d * 0.3);
  const zc = -d / 2 + d * 0.48;
  const hopper = { x: -r * 0.3, z: zc - r * 0.1, r: r * 0.55 };
  const tube = { x: r * 0.55, z: zc + r * 0.25, r: Math.min(0.03, r * 0.2) };
  return { motorFront, r, zc, hopper, tube, motorTop: h * 0.5, headTop: h * 0.66, hopperTop: h * 0.86 };
}

export const vegCutter: KindDef = {
  kind: "vegCutter",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { motorFront, r, zc, hopper, tube } = layout(m);
    pRect(s, "hidden", -m.w / 2, -m.d / 2, m.w / 2, motorFront);
    pCircle(s, "detail", 0, zc, r);
    pCircle(s, "detail", hopper.x, hopper.z, hopper.r);
    pCircle(s, "detail", tube.x, tube.z, tube.r);
    pRect(s, "detail", -r * 0.55, zc + r * 0.4, r * 0.55, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { r, hopper, motorTop, headTop, hopperTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, motorTop);
    mBox(f, "detail", -r, r, motorTop, headTop);
    mBox(f, "detail", hopper.x - hopper.r, hopper.x + hopper.r, headTop, hopperTop);
    mBox(f, "detail", -r * 0.55, r * 0.55, m.h * 0.3, motorTop, "item-dark");
    mLine(f, [hopper.x, hopperTop], [hopper.x, m.h - 0.03]);
    mCircle(f, hopper.x, m.h - 0.02, 0.02);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { motorFront, r, zc, hopper, tube, motorTop, headTop, hopperTop } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, motorFront);
    p.box("steel", -w / 2, w / 2, MACHINE_FOOT, motorTop, -d / 2, motorFront);
    // Start and stop buttons on the front of the motor block, beside the chute.
    p.knob(-w * 0.38, motorTop * 0.6, motorFront, motorFront + 0.02, 0.016);
    p.knob(w * 0.38, motorTop * 0.6, motorFront, motorFront + 0.02, 0.016);
    // Cutting head, hopper with its pusher plate, the round feed tube.
    p.cyl("steel", 0, zc, motorTop, headTop, r);
    p.cyl("steelDark", 0, zc, headTop - 0.012, headTop, r + 0.002);
    p.cyl("steel", hopper.x, hopper.z, headTop, hopperTop, hopper.r);
    p.cyl("steelDark", hopper.x, hopper.z, hopperTop, hopperTop + 0.02, hopper.r * 0.95);
    p.cyl("steel", tube.x, tube.z, headTop, hopperTop + 0.02, tube.r);
    // Pusher lever from the hinge at the back over the hopper, its knob the unit's top.
    p.box("steelDark", hopper.x - 0.015, hopper.x + 0.015, hopperTop + 0.02, hopperTop + 0.045, zc - r, zc + r);
    p.cyl("knob", hopper.x, zc + r - 0.02, hopperTop + 0.045, h, 0.02);
    // Outlet chute at the front, with its dark mouth.
    p.box("steel", -r * 0.55, r * 0.55, h * 0.3, motorTop, zc + r * 0.4, d / 2);
    p.box("steelDark", -r * 0.45, r * 0.45, h * 0.3 - 0.004, h * 0.3, zc + r * 0.4, d / 2 - 0.01);
  },
};
