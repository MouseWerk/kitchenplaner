// Centrifugal juicer (Zentrifugalentsafter), a table-top unit: a stainless motor base with the
// speed dial, the round centrifuge housing on top with its clear lid, the feed tube and its pusher,
// the juice spout at the front and the pulp container behind.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, mCircle, metres, pCircle, pRect } from "./common";
import { pilotLamp } from "./machine";
import { housing } from "../parts/details";

function layout({ w, d, h }: Size) {
  const back = -d / 2 + Math.min(0.13, d * 0.3);
  const baseTop = h * 0.5;
  const r = Math.min(w / 2 - 0.01, (d / 2 - back) * 0.55);
  const zc = back + r + 0.01;
  const ringTop = baseTop + 0.07;
  const lidTop = ringTop + 0.05;
  return { back, baseTop, r, zc, ringTop, lidTop };
}

export const juicer: KindDef = {
  kind: "juicer",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { back, r, zc } = layout(m);
    pRect(s, "detail", -m.w * 0.4, -m.d / 2, m.w * 0.4, back);
    pCircle(s, "detail", 0, zc, r);
    pCircle(s, "detail", r * 0.3, zc, 0.04);
    pRect(s, "detail", -0.015, zc + r, 0.015, m.d / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { baseTop, r, ringTop, lidTop } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, baseTop);
    mBox(f, "detail", -r, r, baseTop, ringTop);
    mBox(f, "detail", -r, r, ringTop, lidTop, "glass");
    mBox(f, "detail", r * 0.3 - 0.04, r * 0.3 + 0.04, lidTop, m.h);
    mCircle(f, 0, baseTop * 0.5, 0.025);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { back, baseTop, r, zc, ringTop, lidTop } = layout(s);
    machineFeet(p, -w / 2, w / 2, back, d / 2 - 0.03);
    housing(p, "steel", -w / 2, w / 2, MACHINE_FOOT, baseTop, back, d / 2 - 0.03, 0.02);
    p.knob(0, baseTop * 0.5, d / 2 - 0.03, d / 2, 0.025);
    pilotLamp(p, w * 0.3, baseTop * 0.5, d / 2 - 0.03);
    // The pulp container behind the base, up to the housing.
    p.roundedBox("panel", -w * 0.4, w * 0.4, 0.002, ringTop - 0.02, -d / 2, back + 0.004, 0.02);
    // The centrifuge housing with its rolled rim, the clear lid with the feed tube and pusher.
    p.lathe("steel", 0, baseTop - 0.002, zc, [
      [0, 0],
      [r - 0.01, 0],
      [r, 0.012],
      [r, ringTop - baseTop - 0.004],
      [r - 0.004, ringTop - baseTop + 0.002],
      [0, ringTop - baseTop + 0.002],
    ]);
    p.lathe("glass", 0, ringTop, zc, [
      [0, 0],
      [r - 0.003, 0],
      [r - 0.003, (lidTop - ringTop) * 0.4],
      [r * 0.7, lidTop - ringTop],
      [0, lidTop - ringTop],
    ]);
    const tx = r * 0.3;
    p.lathe("glass", tx, lidTop - 0.01, zc, [
      [0, 0],
      [0.042, 0],
      [0.042, h - lidTop - 0.03],
      [0.046, h - lidTop - 0.024],
      [0, h - lidTop - 0.024],
    ]);
    p.lathe("knob", tx, h - 0.1, zc, [
      [0, 0],
      [0.036, 0],
      [0.036, 0.075],
      [0.046, 0.078],
      [0.046, 0.094],
      [0.04, 0.1],
      [0, 0.1],
    ]);
    // The spout at the front of the housing, bent down over the glass.
    p.tube("satin", [{ x: 0, y: baseTop + 0.03, z: zc + r - 0.01 }, { x: 0, y: baseTop + 0.03, z: d / 2 - 0.012 }, { x: 0, y: baseTop - 0.01, z: d / 2 - 0.012 }], 0.012, { bend: 0.02 });
    // The clamps that hold the lid, at both sides.
    for (const sx of [-1, 1]) p.roundedBox("satin", sx > 0 ? r - 0.012 : -r - 0.008, sx > 0 ? r + 0.008 : -r + 0.012, baseTop + 0.02, ringTop + 0.025, zc - 0.02, zc + 0.02, 0.006);
  },
};
