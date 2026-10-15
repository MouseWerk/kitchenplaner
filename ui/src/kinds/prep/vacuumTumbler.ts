// Vacuum tumbler (Vakuum-Tumbler), a table-top unit: a stainless drum lying on the drive rollers
// of a low base with the control panel at the front, its lid at the right end held by a clamp
// with the vacuum valve.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pRect } from "./common";
import { controlPanel, displayWindow, pushButton } from "./machine";
import { housing } from "../parts/details";

/** How far the drum's rolling rings stand out of it (m). */
const RING = 0.003;

function layout({ w, d, h }: Size) {
  const baseTop = Math.min(0.12, h * 0.3);
  // The rolling rings stand out of the drum by RING; they are the highest parts.
  const R = Math.min(d / 2 - 0.01, (h - baseTop) / 2) - RING;
  const cy = h - R - RING;
  const x0 = -w / 2 + 0.03;
  const x1 = w / 2 - 0.05;
  return { baseTop, R, cy, x0, x1 };
}

export const vacuumTumbler: KindDef = {
  kind: "vacuumTumbler",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { R, x0, x1 } = layout(m);
    pRect(s, "detail", x0, -R, x1, R);
    pRect(s, "detail", x1, -R * 0.6, m.w / 2, R * 0.6);
  },
  elevation(f) {
    const m = metres(f.item);
    const { baseTop, R, cy, x0, x1 } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, baseTop);
    mBox(f, "detail", x0, x1, cy - R, cy + R);
    mBox(f, "detail", x1, m.w / 2, cy - R * 0.6, cy + R * 0.6);
    mCircle(f, 0, baseTop * 0.55, 0.012);
  },
  mesh(p, s) {
    const { w, d } = s;
    const { baseTop, R, cy, x0, x1 } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, d / 2);
    housing(p, "steel", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, d / 2 - 0.008, 0.012);
    const face = controlPanel(p, -w * 0.38, w * 0.38, MACHINE_FOOT + 0.015, baseTop - 0.015, d / 2 - 0.008);
    const yc = (MACHINE_FOOT + baseTop) / 2;
    displayWindow(p, -w * 0.34, -w * 0.08, yc - 0.018, yc + 0.018, face);
    pushButton(p, w * 0.05, yc, face, 0.01, "panel", d / 2 - face);
    pushButton(p, w * 0.15, yc, face, 0.01, "knob", d / 2 - face);
    // The drive rollers under the drum.
    for (const sz of [-1, 1]) {
      p.lathe("rubber", x0 + 0.02, cy - R * 0.92, sz * R * 0.5, [
        [0, 0],
        [0.018, 0],
        [0.018, x1 - x0 - 0.04],
        [0, x1 - x0 - 0.04],
      ], { axis: "x" });
    }
    // The drum with its two rolling rings, the lid at its right end and the clamp over it.
    const len = x1 - x0;
    p.lathe("steel", x0, cy, 0, [
      [0, 0],
      [R * 0.92, 0],
      [R, 0.012],
      [R, len - 0.004],
      [R - 0.004, len],
      [0, len],
    ], { axis: "x" });
    for (const t of [0.22, 0.78]) {
      p.lathe("satin", x0 + len * t - 0.008, cy, 0, [
        [R - 0.002, 0],
        [R + RING, 0.003],
        [R + RING, 0.013],
        [R - 0.002, 0.016],
        [R - 0.002, 0],
      ], { axis: "x" });
    }
    p.lathe("satin", x1 - 0.002, cy, 0, [
      [0, 0],
      [R * 0.6, 0],
      [R * 0.6, 0.014],
      [R * 0.45, 0.022],
      [0, 0.022],
    ], { axis: "x" });
    p.lathe("knob", x1 + 0.02, cy, 0, [
      [0, 0],
      [0.02, 0],
      [0.02, 0.01],
      [0.012, 0.02],
      [0.012, w / 2 - x1 - 0.02 - 0.012],
      [0.016, w / 2 - x1 - 0.02 - 0.006],
      [0.014, w / 2 - x1 - 0.02],
      [0, w / 2 - x1 - 0.02],
    ], { axis: "x" });
  },
};
