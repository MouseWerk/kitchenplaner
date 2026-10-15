// Label scale (Etikettierwaage), a table-top unit: a flat white base with the stainless weighing
// platform at the front, the tower at the back with the display at its top, the keyboard under it
// and the label printer's slot.

import type { Size } from "../parts/mesh";
import { TOP_RADIUS } from "../parts/mesh";
import type { KindDef } from "../types";
import { machineFeet, MACHINE_FOOT, mBox, metres, pRect } from "./common";
import { displayWindow } from "./machine";
import { housing } from "../parts/details";

/** Keys of the keyboard: columns and rows. */
const KEY_COLS = 5;
const KEY_ROWS = 3;

function layout({ w, d, h }: Size) {
  const baseTop = Math.min(0.1, h * 0.2);
  const towerFront = -d / 2 + Math.min(0.14, d * 0.32);
  const pan = { x: w / 2 - 0.02, z0: towerFront + 0.02, z1: d / 2 - 0.01, y: baseTop + 0.004 };
  return { baseTop, towerFront, pan };
}

export const labelScale: KindDef = {
  kind: "labelScale",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { towerFront, pan } = layout(m);
    pRect(s, "detail", -m.w / 2, -m.d / 2, m.w / 2, towerFront);
    pRect(s, "detail", -pan.x, pan.z0, pan.x, pan.z1);
  },
  elevation(f) {
    const m = metres(f.item);
    const { baseTop, pan } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, MACHINE_FOOT, baseTop);
    mBox(f, "detail", -pan.x, pan.x, pan.y, pan.y + 0.015);
    mBox(f, "detail", -m.w / 2 + 0.03, m.w / 2 - 0.03, m.h - 0.13, m.h - 0.03, "item-dark");
    mBox(f, "detail", -m.w / 2 + 0.03, m.w / 2 - 0.03, baseTop + 0.08, m.h - 0.16);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { baseTop, towerFront, pan } = layout(s);
    machineFeet(p, -w / 2, w / 2, -d / 2, d / 2);
    housing(p, "panel", -w / 2, w / 2, MACHINE_FOOT, baseTop, -d / 2, d / 2, 0.012);
    p.roundedBox("steel", -pan.x, pan.x, pan.y, pan.y + 0.015, pan.z0, pan.z1, TOP_RADIUS);
    // The tower with the display at its top and the keyboard, the printer's slot under it.
    housing(p, "panel", -w / 2, w / 2, baseTop - 0.01, h, -d / 2, towerFront, 0.015);
    const zf = towerFront;
    p.plate("panelDark", -w / 2 + 0.025, w / 2 - 0.025, h - 0.14, h - 0.02, zf - 0.001, zf + 0.002, 0.008, true);
    displayWindow(p, -w / 2 + 0.035, w / 2 - 0.035, h - 0.13, h - 0.03, zf + 0.002);
    const k0 = baseTop + 0.08;
    const k1 = h - 0.16;
    p.plate("panelDark", -w / 2 + 0.025, w / 2 - 0.025, k0, k1, zf - 0.001, zf + 0.002, 0.006, true);
    const kw = (w - 0.07) / KEY_COLS;
    const kh = (k1 - k0 - 0.02) / KEY_ROWS;
    for (let c = 0; c < KEY_COLS; c++) {
      for (let r = 0; r < KEY_ROWS; r++) {
        const x = -w / 2 + 0.035 + kw * (c + 0.5);
        const y = k0 + 0.01 + kh * (r + 0.5);
        p.plate(c === KEY_COLS - 1 ? "knob" : "panel", x - kw * 0.38, x + kw * 0.38, y - kh * 0.34, y + kh * 0.34, zf + 0.002, zf + 0.005, 0.003, true);
      }
    }
    p.plate("slot", -w * 0.3, w * 0.3, baseTop + 0.03, baseTop + 0.045, zf - 0.001, zf + 0.0005, 0.007);
  },
};
