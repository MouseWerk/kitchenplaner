// Scales: a bench scale (Tischwaage), a flat body with the weighing platform resting just above
// it and the display console at the front, standing on a work table (`tableTop`); and a platform
// scale (Plattformwaage) on the floor with the display on a column at the back.

import type { KindDef } from "../types";
import { BODY_RADIUS, TOP_RADIUS } from "../parts/mesh";
import { machineFeet, MACHINE_FOOT, mBox, metres, pRect } from "./common";
import { displayWindow } from "./machine";
import { housing } from "../parts/details";

/** Depth of the display console of the bench scale, as a share of the depth. */
const CONSOLE = 0.2;
/** Thickness of the bench scale's platform and its gap over the body (m). */
const PAN = 0.02;
const PAN_GAP = 0.004;
/** Height of the platform scale's frame and plate (m). */
const PLATFORM = 0.08;
const PLATE = 0.015;
/** Display head of the platform scale (m). */
const HEAD_H = 0.15;
const HEAD_D = 0.1;

/** Heights of the bench scale (m): body top, platform underside; the platform's top is `h`. */
function benchLevels(h: number) {
  const pan0 = h - PAN;
  return { body: pan0 - PAN_GAP, pan0 };
}

export const benchScale: KindDef = {
  kind: "benchScale",
  placement: "tableTop",
  plan(s) {
    const { w, d } = metres(s.item);
    pRect(s, "detail", -w / 2 + 0.01, -d / 2 + 0.01, w / 2 - 0.01, d / 2 - d * (CONSOLE + 0.02));
    pRect(s, "detail", -w * 0.4, d / 2 - d * CONSOLE, w * 0.4, d / 2);
  },
  elevation(f) {
    const { w, h } = metres(f.item);
    const { body, pan0 } = benchLevels(h);
    // The console's display face on the body's front, the platform above it.
    mBox(f, "detail", -w * 0.4, w * 0.4, MACHINE_FOOT + 0.01, body - 0.01, "item-dark");
    mBox(f, "detail", -w / 2 + 0.01, w / 2 - 0.01, pan0, h);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { body, pan0 } = benchLevels(h);
    machineFeet(p, -w / 2, w / 2, -d / 2, d / 2);
    // The body stops short of the front for the console's face plate.
    const zb = d / 2 - 0.004;
    housing(p, "panel", -w / 2, w / 2, MACHINE_FOOT, body, -d / 2, zb, 0.01);
    // The console at the front: a dark face with the display and the keys, facing the user.
    const c0 = d / 2 - d * CONSOLE;
    const y0 = MACHINE_FOOT + 0.01;
    const y1 = body - 0.01;
    p.plate("panelDark", -w * 0.4, w * 0.4, y0, y1, zb - 0.003, zb, 0.006, true);
    displayWindow(p, -w * 0.34, w * 0.05, y0 + 0.008, y1 - 0.008, zb);
    for (const x of [w * 0.15, w * 0.27]) p.plate("knob", x - 0.015, x + 0.015, y0 + 0.012, y1 - 0.012, zb, d / 2, 0.005, true);
    // The platform resting on the load cell, a few millimetres over the body.
    p.roundedBox("steel", -w / 2 + 0.01, w / 2 - 0.01, pan0, h, -d / 2 + 0.01, c0 - d * 0.02, TOP_RADIUS);
  },
};

export const platformScale: KindDef = {
  kind: "platformScale",
  plan(s) {
    const { w, d } = metres(s.item);
    const hw = Math.min(0.14, w * 0.3);
    pRect(s, "detail", -w / 2 + 0.02, -d / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.02);
    pRect(s, "detail", -hw, -d / 2 + 0.02, hw, -d / 2 + 0.02 + HEAD_D);
  },
  elevation(f) {
    const { w, h } = metres(f.item);
    const hw = Math.min(0.14, w * 0.3);
    mBox(f, "detail", -w / 2 + 0.02, w / 2 - 0.02, PLATFORM, PLATFORM + PLATE);
    mBox(f, "detail", -0.025, 0.025, PLATFORM + PLATE, h - HEAD_H);
    mBox(f, "detail", -hw, hw, h - HEAD_H, h, "item-dark");
    mBox(f, "detail", -hw + 0.02, hw - 0.02, h - HEAD_H * 0.6, h - HEAD_H * 0.15);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    machineFeet(p, -w / 2, w / 2, -d / 2, d / 2);
    // The frame on its feet, the chequered steel plate over the load cells.
    p.roundedBox("steelDark", -w / 2, w / 2, MACHINE_FOOT, PLATFORM, -d / 2, d / 2, BODY_RADIUS);
    p.roundedBox("steel", -w / 2 + 0.02, w / 2 - 0.02, PLATFORM - 0.002, PLATFORM + PLATE, -d / 2 + 0.02, d / 2 - 0.02, TOP_RADIUS);
    // Column at the back with the display head facing the front.
    const zc = -d / 2 + 0.045;
    p.lathe("steelDark", 0, PLATFORM + PLATE - 0.001, zc, [
      [0, 0],
      [0.04, 0],
      [0.04, 0.006],
      [0.02, 0.012],
      [0.02, h - HEAD_H - PLATFORM - PLATE + 0.02],
      [0, h - HEAD_H - PLATFORM - PLATE + 0.02],
    ]);
    const hw = Math.min(0.14, w * 0.3);
    const zf = -d / 2 + 0.02 + HEAD_D;
    housing(p, "panel", -hw, hw, h - HEAD_H, h, -d / 2 + 0.02, zf - 0.004, 0.012);
    const face = zf - 0.004;
    p.plate("panelDark", -hw + 0.012, hw - 0.012, h - HEAD_H + 0.012, h - 0.012, face - 0.001, face + 0.002, 0.006, true);
    displayWindow(p, -hw + 0.02, hw - 0.02, h - HEAD_H * 0.6, h - HEAD_H * 0.15, face + 0.002);
    for (const x of [-hw * 0.5, 0, hw * 0.5]) p.plate("knob", x - 0.012, x + 0.012, h - HEAD_H * 0.85, h - HEAD_H * 0.7, face + 0.002, zf, 0.004, true);
  },
};
