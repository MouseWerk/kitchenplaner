// Bone saw (Knochenbandsäge), a floor unit: a stainless base cabinet on feet with the motor and
// the control panel, the work table with its sliding carriage and fence, the column at the back
// carrying the upper wheel housing, and the band blade running down between them through its
// adjustable guide.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot, mBox, metres, mLine, pRect } from "./common";
import { controlPanel, displayWindow, pushButton } from "./machine";
import { housing, ratingPlate } from "../parts/details";

/** Height of the feet (m). */
const FEET = 0.08;

function layout({ w, d, h }: Size) {
  const table = h * 0.52;
  const upper = { y0: h - Math.min(0.45, h * 0.26), z1: d * 0.12 };
  const blade = { x: -w * 0.08, z: d * 0.05 };
  const column = { x0: -w * 0.42, x1: w * 0.1, z0: -d / 2, z1: -d / 2 + Math.min(0.2, d * 0.28) };
  return { table, upper, blade, column };
}

export const boneSaw: KindDef = {
  kind: "boneSaw",
  plan(s) {
    const m = metres(s.item);
    const { blade, column } = layout(m);
    pRect(s, "detail", column.x0, column.z0, column.x1, column.z1);
    pRect(s, "detail", blade.x + 0.03, -m.d / 2 + 0.04, m.w / 2 - 0.03, m.d / 2 - 0.04);
    s.line("detail", [blade.x * 1000, column.z1 * 1000], [blade.x * 1000, (blade.z + 0.02) * 1000]);
  },
  elevation(f) {
    const m = metres(f.item);
    const { table, upper, blade } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, table - 0.04, table);
    mBox(f, "detail", -m.w / 2 + 0.03, m.w / 2 - 0.03, FEET, table - 0.04);
    mBox(f, "detail", -m.w / 2 + 0.02, m.w / 2 - 0.02, upper.y0, m.h);
    mLine(f, [blade.x, table], [blade.x, upper.y0]);
    mBox(f, "detail", -m.w * 0.3, m.w * 0.3, table - 0.22, table - 0.08, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { table, upper, blade, column } = layout(s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.08), sz * (d / 2 - 0.08), FEET);
    // The base cabinet with its control panel.
    housing(p, "steel", -w / 2 + 0.03, w / 2 - 0.03, FEET, table - 0.04, -d / 2 + 0.03, d / 2 - 0.03, 0.015);
    const face = controlPanel(p, -w * 0.3, w * 0.3, table - 0.22, table - 0.08, d / 2 - 0.03);
    displayWindow(p, -w * 0.25, -w * 0.05, table - 0.18, table - 0.12, face);
    pushButton(p, w * 0.08, table - 0.15, face, 0.013, "panel", d / 2 - face);
    pushButton(p, w * 0.2, table - 0.15, face, 0.016, "knob", d / 2 - face);
    ratingPlate(p, w * 0.3, FEET + 0.1, d / 2 - 0.03);
    // The work table, the carriage sliding on it and the fence along the blade.
    p.roundedBox("steel", -w / 2, w / 2, table - 0.04, table, -d / 2, d / 2, 0.004);
    p.roundedBox("satin", blade.x + 0.03, w / 2 - 0.03, table, table + 0.012, -d / 2 + 0.04, d / 2 - 0.04, 0.004);
    p.roundedBox("steelDark", blade.x + 0.03, blade.x + 0.045, table + 0.012, table + 0.09, -d / 2 + 0.06, d / 2 - 0.06, 0.003);
    p.tube("handle", [{ x: w / 2 - 0.08, y: table + 0.012, z: d / 2 - 0.05 }, { x: w / 2 - 0.08, y: table + 0.08, z: d / 2 - 0.05 }, { x: w / 2 - 0.08, y: table + 0.08, z: d / 2 - 0.1 }], 0.01, { bend: 0.02 });
    // The column at the back and the upper wheel housing it carries, with its hinged cover.
    housing(p, "steel", column.x0, column.x1, table - 0.01, upper.y0 + 0.02, column.z0, column.z1, 0.015);
    housing(p, "steel", -w / 2 + 0.02, w / 2 - 0.02, upper.y0, h, -d / 2, upper.z1, 0.03);
    p.lathe("satin", w * 0.15, (upper.y0 + h) / 2, upper.z1, [
      [0, 0],
      [0.05, 0],
      [0.05, 0.004],
      [0.04, 0.008],
      [0, 0.008],
    ], { axis: "z" });
    // The blade from the table up to the guide under the upper housing, the guide on its post.
    const gy = upper.y0 - 0.1;
    p.box("handle", blade.x - 0.0006, blade.x + 0.0006, table, upper.y0, blade.z - 0.01, blade.z + 0.01);
    p.roundedBox("satin", blade.x - 0.025, blade.x + 0.025, gy, gy + 0.05, blade.z - 0.02, blade.z + 0.025, 0.006);
    p.roundedBox("satin", blade.x - 0.012, blade.x + 0.012, gy + 0.05, upper.y0 + 0.005, blade.z + 0.025 - 0.024, blade.z + 0.025, 0.004);
  },
};
