// Food processor (Kutter), a table-top unit: the motor base with its control panel, the
// stainless bowl with its handle on top, the clear domed lid with the scraper arm and the lid
// knob, the blade hub seen through the lid. Stands on a work table (`tableTop`).

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";
import { controlPanel, pushButton, turnedBowl } from "./machine";
import { housing } from "../parts/details";

function layout({ w, d, h }: Size) {
  const rb = Math.min(w / 2 - 0.02, d * 0.35);
  const zc = -d / 2 + d * 0.48;
  const front = d / 2 - 0.012;
  return { rb, zc, front, baseTop: h * 0.42, bowlTop: h * 0.78, lidTop: h * 0.9 };
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
    housing(p, "paintGray", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, front, 0.015);
    // The control panel with the start and stop buttons and the pulse lever between them.
    const face = controlPanel(p, -w * 0.35, w * 0.35, h * 0.08, h * 0.32, front);
    pushButton(p, -w * 0.15, h * 0.2, face, 0.016, "panel", d / 2 - face);
    pushButton(p, w * 0.15, h * 0.2, face, 0.016, "knob", d / 2 - face);
    p.roundedBox("knob", -0.012, 0.012, h * 0.14, h * 0.26, face, face + 0.006, 0.004);
    // The bowl sits in a satin collar on the base, its handle at the right.
    p.lathe("satin", 0, baseTop - 0.002, zc, [
      [0, 0],
      [rb + 0.006, 0],
      [rb + 0.006, 0.012],
      [0, 0.012],
    ]);
    turnedBowl(p, "steel", 0, baseTop + 0.01, zc, rb, bowlTop - baseTop - 0.01);
    const hy0 = baseTop + (bowlTop - baseTop) * 0.3;
    const hy1 = baseTop + (bowlTop - baseTop) * 0.8;
    const hr = 0.01;
    p.tube(
      "steel",
      [
        { x: rb - 0.004, y: hy1, z: zc },
        { x: w / 2 - hr, y: hy1, z: zc },
        { x: w / 2 - hr, y: hy0, z: zc },
        { x: rb - 0.004, y: hy0, z: zc },
      ],
      hr,
      { bend: 0.02 },
    );
    // Blade hub and blade inside the bowl, seen through the lid.
    p.lathe("satin", 0, baseTop + 0.014, zc, [
      [0, 0],
      [0.03, 0],
      [0.025, 0.05],
      [0, 0.06],
    ]);
    p.roundedBox("handle", -rb * 0.75, rb * 0.75, baseTop + 0.03, baseTop + 0.034, zc - 0.012, zc + 0.012, 0.002);
    // The clear domed lid on its rubber seal, the scraper arm and the knob on top.
    p.lathe("rubber", 0, bowlTop - 0.004, zc, [
      [rb - 0.008, 0],
      [rb + 0.003, 0],
      [rb + 0.003, 0.008],
      [rb - 0.008, 0.008],
      [rb - 0.008, 0],
    ]);
    const lh = lidTop - bowlTop;
    p.lathe("glass", 0, bowlTop + 0.004, zc, [
      [0, 0],
      [rb - 0.002, 0],
      [rb - 0.002, lh * 0.35],
      [rb * 0.85, lh * 0.8],
      [rb * 0.4, lh - 0.004],
      [0, lh - 0.004],
    ]);
    p.tube(
      "handle",
      [
        { x: 0, y: lidTop + 0.004, z: zc },
        { x: rb * 0.7, y: lidTop - 0.004, z: zc },
        { x: rb * 0.8, y: bowlTop + lh * 0.4, z: zc },
      ],
      0.006,
      { bend: 0.03 },
    );
    p.lathe("knob", 0, lidTop, zc, [
      [0, 0],
      [0.035, 0],
      [0.035, 0.008],
      [0.02, 0.016],
      [0.02, (h - lidTop) * 0.7],
      [0.024, (h - lidTop) * 0.85],
      [0.016, h - lidTop],
      [0, h - lidTop],
    ]);
  },
};
