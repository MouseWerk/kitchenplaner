// Cooking blender (Kochmixer), a table-top unit: a white moulded base with the display and the
// selector dial at the front, the heated stainless jug in its seat on top with its handle, the
// lid with the measuring cup in its middle.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { mBox, mCircle, metres, pCircle, pRect, rubberFoot } from "./common";
import { controlPanel, displayWindow } from "./machine";
import { housing } from "../parts/details";

function layout({ w, d, h }: Size) {
  const baseTop = h * 0.42;
  const r = Math.min(w * 0.28, d * 0.26);
  const zj = -d / 2 + 0.03 + r;
  const jugTop = h * 0.9;
  return { baseTop, r, zj, jugTop };
}

export const cookingBlender: KindDef = {
  kind: "cookingBlender",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { r, zj } = layout(m);
    pCircle(s, "detail", 0, zj, r);
    pCircle(s, "detail", 0, zj, r * 0.35);
    pRect(s, "detail", r, zj - 0.015, m.w / 2 - 0.01, zj + 0.015);
  },
  elevation(f) {
    const m = metres(f.item);
    const { baseTop, r, jugTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, 0.006, baseTop);
    mBox(f, "detail", -r, r, baseTop, jugTop);
    mBox(f, "detail", -r * 0.35, r * 0.35, jugTop, m.h);
    mCircle(f, 0, baseTop * 0.4, 0.03);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { baseTop, r, zj, jugTop } = layout(s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rubberFoot(p, sx * (w / 2 - 0.03), sz * (d / 2 - 0.03), 0.012, 0.008);
    housing(p, "panel", -w / 2, w / 2, 0.006, baseTop, -d / 2, d / 2 - 0.006, 0.035);
    // The control field: the display over the selector dial in its satin ring.
    const face = controlPanel(p, -w * 0.32, w * 0.32, baseTop * 0.15, baseTop * 0.85, d / 2 - 0.008);
    displayWindow(p, -w * 0.24, w * 0.24, baseTop * 0.58, baseTop * 0.8, face);
    p.lathe("satin", 0, baseTop * 0.36, face, [
      [0, 0],
      [0.034, 0],
      [0.034, 0.002],
      [0, 0.002],
    ], { axis: "z" });
    p.knob(0, baseTop * 0.36, face + 0.002, d / 2, 0.028);
    // The jug in its seat, slightly narrower at its foot, its handle at the right.
    p.lathe("panel", 0, baseTop - 0.004, zj, [
      [0, 0],
      [r + 0.008, 0],
      [r + 0.008, 0.018],
      [0, 0.018],
    ]);
    const jh = jugTop - baseTop - 0.014;
    p.lathe("steel", 0, baseTop + 0.014, zj, [
      [0, 0],
      [r * 0.86, 0],
      [r * 0.92, jh * 0.3],
      [r, jh - 0.006],
      [r + 0.004, jh],
      [0, jh],
    ]);
    p.tube("knob", [{ x: r * 0.95, y: jugTop - 0.03, z: zj }, { x: w / 2 - 0.012, y: jugTop - 0.04, z: zj }, { x: w / 2 - 0.012, y: baseTop + 0.05, z: zj }, { x: r * 0.88, y: baseTop + 0.04, z: zj }], 0.012, { bend: 0.025 });
    // The lid and the measuring cup standing in it.
    p.lathe("knob", 0, jugTop, zj, [
      [0, 0],
      [r + 0.006, 0],
      [r + 0.006, 0.01],
      [r * 0.6, 0.018],
      [0, 0.018],
    ]);
    p.lathe("glass", 0, jugTop + 0.012, zj, [
      [0, 0],
      [r * 0.3, 0],
      [r * 0.35, h - jugTop - 0.012],
      [0, h - jugTop - 0.012],
    ]);
  },
};
