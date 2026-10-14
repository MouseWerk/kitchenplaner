// Scales: a bench scale (Tischwaage) with the weighing platform over a flat body and the display
// console at the front, standing on a work table (`tableTop`); and a platform
// scale (Plattformwaage) on the floor with the display on a column at the back.

import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, metres, pRect } from "./common";

/** Depth of the display console of the bench scale, as a share of the depth. */
const CONSOLE = 0.2;
/** Height of the platform scale's frame and plate (m). */
const PLATFORM = 0.08;
const PLATE = 0.015;
/** Display head of the platform scale (m). */
const HEAD_H = 0.15;
const HEAD_D = 0.1;

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
    mBox(f, "detail", -w * 0.4, w * 0.4, h * 0.55, h * 0.75, "item-dark");
    mBox(f, "detail", -w / 2 + 0.01, w / 2 - 0.01, h * 0.85, h);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    machineFeet(p, -w / 2, w / 2, -d / 2, d / 2);
    p.box("panel", -w / 2, w / 2, MACHINE_FOOT, h * 0.55, -d / 2, d / 2);
    // Console with the display and keys on its top, facing the user.
    const c0 = d / 2 - d * CONSOLE;
    p.box("panelDark", -w * 0.4, w * 0.4, h * 0.55, h * 0.75, c0, d / 2);
    p.box("glassDark", -w * 0.3, w * 0.05, h * 0.75, h * 0.75 + 0.002, c0 + 0.01, d / 2 - 0.01);
    for (const x of [w * 0.15, w * 0.27]) p.box("knob", x - 0.015, x + 0.015, h * 0.75, h * 0.75 + 0.003, c0 + 0.02, d / 2 - 0.02);
    // The platform on its load cell.
    const pz = (-d / 2 + c0) / 2;
    p.cyl("steelDark", 0, pz, h * 0.55, h * 0.85, 0.02);
    p.box("steel", -w / 2 + 0.01, w / 2 - 0.01, h * 0.85, h, -d / 2 + 0.01, c0 - d * 0.02);
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
    p.box("steelDark", -w / 2, w / 2, MACHINE_FOOT, PLATFORM, -d / 2, d / 2);
    p.box("steel", -w / 2 + 0.02, w / 2 - 0.02, PLATFORM, PLATFORM + PLATE, -d / 2 + 0.02, d / 2 - 0.02);
    // Column at the back with the display head facing the front.
    const zc = -d / 2 + 0.045;
    p.box("steelDark", -0.025, 0.025, PLATFORM + PLATE, h - HEAD_H, zc - 0.025, zc + 0.025);
    const hw = Math.min(0.14, w * 0.3);
    const zf = -d / 2 + 0.02 + HEAD_D;
    p.box("panelDark", -hw, hw, h - HEAD_H, h, -d / 2 + 0.02, zf);
    p.box("glassDark", -hw + 0.02, hw - 0.02, h - HEAD_H * 0.6, h - HEAD_H * 0.15, zf, zf + 0.003);
    for (const x of [-hw * 0.5, 0, hw * 0.5]) p.box("knob", x - 0.012, x + 0.012, h - HEAD_H * 0.85, h - HEAD_H * 0.7, zf, zf + 0.006);
  },
};
