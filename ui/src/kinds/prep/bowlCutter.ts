// Bowl cutter (Schüsselkutter), a floor unit: the stainless machine body on feet with its control
// panel, the wide turning bowl on top with the cone in its middle, the knife hood over the knife
// shaft at the right of the bowl, and the motor housing behind it.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot, mBox, metres, pCircle, pRect } from "./common";
import { controlPanel, displayWindow, pushButton, sideSlots } from "./machine";
import { housing, ratingPlate } from "../parts/details";

/** Height of the feet under the body (m). */
const FEET = 0.1;

function layout({ w, d, h }: Size) {
  const bodyTop = h * 0.62;
  const R = Math.min(d / 2 - 0.02, w * 0.36);
  const bx = -w / 2 + 0.02 + R;
  const bowlH = Math.min(0.16, (h - bodyTop) * 0.4);
  const hood = { x0: bx + R * 0.15, x1: w / 2 - 0.02, z0: -R * 0.55, z1: R * 0.55, y0: bodyTop + bowlH * 0.4 };
  return { bodyTop, R, bx, bowlH, hood };
}

export const bowlCutter: KindDef = {
  kind: "bowlCutter",
  plan(s) {
    const m = metres(s.item);
    const { R, bx, hood } = layout(m);
    pCircle(s, "detail", bx, 0, R);
    pCircle(s, "detail", bx, 0, R * 0.25);
    pRect(s, "detail", hood.x0, hood.z0, hood.x1, hood.z1);
  },
  elevation(f) {
    const m = metres(f.item);
    const { bodyTop, R, bx, bowlH, hood } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, FEET, bodyTop);
    mBox(f, "detail", bx - R, bx + R, bodyTop, bodyTop + bowlH);
    mBox(f, "detail", hood.x0, hood.x1, hood.y0, m.h);
    mBox(f, "detail", -m.w * 0.3, m.w * 0.1, bodyTop - 0.2, bodyTop - 0.05, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { bodyTop, R, bx, bowlH, hood } = layout(s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.06), sz * (d / 2 - 0.06), FEET);
    housing(p, "steel", -w / 2, w / 2, FEET, bodyTop, -d / 2, d / 2 - 0.008, 0.015);
    // The control panel in the front, with the display and the speed and stop buttons.
    const face = controlPanel(p, -w * 0.3, w * 0.1, bodyTop - 0.2, bodyTop - 0.05, d / 2 - 0.008);
    displayWindow(p, -w * 0.27, -w * 0.12, bodyTop - 0.17, bodyTop - 0.08, face);
    for (const [i, cap] of (["panel", "panel", "knob"] as const).entries()) pushButton(p, -w * 0.06 + i * 0.05, bodyTop - 0.125, face, 0.013, cap, d / 2 - face);
    ratingPlate(p, w * 0.32, FEET + 0.08, d / 2 - 0.008);
    for (const sx of [-1, 1] as const) sideSlots(p, sx * (w / 2), sx, FEET + 0.1, FEET + 0.3, -d / 2 + 0.1, d / 2 - 0.1, 6);
    // The bowl: a wide turned channel round a cone, its rim rolled.
    p.lathe("steel", bx, bodyTop - 0.002, 0, [
      [0, 0],
      [R * 0.85, 0],
      [R, bowlH * 0.25],
      [R, bowlH - 0.006],
      [R - 0.003, bowlH],
      [R - 0.008, bowlH - 0.004],
      [R * 0.78, bowlH * 0.3],
      [R * 0.62, bowlH * 0.18],
      [R * 0.45, bowlH * 0.24],
      [R * 0.25, bowlH * 0.75],
      [R * 0.1, bowlH * 0.88],
      [0, bowlH * 0.9],
    ]);
    // The meat in the channel, a ring of forcemeat.
    p.lathe("foodRed", bx, bodyTop + bowlH * 0.18, 0, [
      [R * 0.5, 0],
      [R * 0.76, 0],
      [R * 0.74, bowlH * 0.2],
      [R * 0.6, bowlH * 0.28],
      [R * 0.48, bowlH * 0.18],
      [R * 0.5, 0],
    ]);
    // The knife hood over the right of the bowl, with its handle, and the motor housing behind.
    housing(p, "steel", hood.x0, hood.x1, hood.y0, h, hood.z0, hood.z1, 0.05);
    p.tube("handle", [{ x: hood.x0 + 0.05, y: h - 0.08, z: hood.z1 }, { x: hood.x0 + 0.05, y: h - 0.08, z: hood.z1 + 0.04 }, { x: hood.x0 + 0.2, y: h - 0.08, z: hood.z1 + 0.04 }, { x: hood.x0 + 0.2, y: h - 0.08, z: hood.z1 }], 0.01, { bend: 0.02 });
    housing(p, "steel", hood.x0 + 0.05, w / 2, bodyTop - 0.02, hood.y0 + 0.12, -d / 2, hood.z0 + 0.02, 0.02);
  },
};
