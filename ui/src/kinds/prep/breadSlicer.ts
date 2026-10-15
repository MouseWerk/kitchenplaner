// Bread slicer (Brotschneidemaschine), a floor unit with reciprocating blades (Gattermesser): a
// tall enamelled housing on feet, the feed shaft at the top with its clear safety lid, the slices
// coming out onto a tray at the front with the bag holder under it, the hand lever at the right
// and the switch panel; a door to the drive below.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot, mBox, metres, mLine, pRect } from "./common";
import { controlPanel, pushButton } from "./machine";
import { housing, ventSlots } from "../parts/details";

/** Height of the feet (m). */
const FEET = 0.06;
/** Room beside the housing for the hand lever, and the radius of the lever's grip (m). */
const LEVER_ROOM = 0.04;
const GRIP = 0.016;
/** Thickness of the clear lid over the feed shaft (m). */
const LID = 0.02;

function layout({ w, d, h }: Size) {
  const front = d / 2 - 0.16;
  const tray = { y: h * 0.6, x: w * 0.36 };
  return { front, tray };
}

export const breadSlicer: KindDef = {
  kind: "breadSlicer",
  plan(s) {
    const m = metres(s.item);
    const { front, tray } = layout(m);
    pRect(s, "detail", -m.w / 2, -m.d / 2, m.w / 2 - LEVER_ROOM, front);
    pRect(s, "detail", -tray.x, front, tray.x, m.d / 2);
    pRect(s, "detail", -m.w * 0.36, -m.d / 2 + 0.08, m.w * 0.36, front - 0.06);
  },
  elevation(f) {
    const m = metres(f.item);
    const { tray } = layout(m);
    mBox(f, "detail", -m.w * 0.4, m.w * 0.4, m.h - LID, m.h, "glass");
    mBox(f, "detail", -tray.x, tray.x, tray.y - 0.04, tray.y);
    mBox(f, "detail", -m.w / 2 + 0.04, m.w / 2 - 0.04, FEET + 0.05, tray.y - 0.2);
    mLine(f, [m.w / 2 - GRIP, m.h * 0.65], [m.w / 2 - GRIP, m.h * 0.82 + 0.08]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { front, tray } = layout(s);
    // The housing leaves room at the right for the hand lever.
    const xr = w / 2 - LEVER_ROOM;
    for (const x of [-w / 2 + 0.06, xr - 0.06]) for (const z of [-d / 2 + 0.06, front - 0.06]) foot(p, x, z, FEET);
    housing(p, "paintGray", -w / 2, xr, FEET, h - LID, -d / 2, front, 0.02);
    // The feed shaft at the top: its dark mouth under the clear lid, the lid on two satin hinges.
    p.box("slot", -w * 0.36, w * 0.36, h - LID - 0.0015, h - LID, -d / 2 + 0.08, front - 0.06);
    p.roundedBox("glass", -w * 0.4, w * 0.4, h - LID, h, -d / 2 + 0.05, front - 0.03, 0.008);
    for (const sx of [-1, 1]) p.rod("satin", "x", sx * w * 0.3, h - 0.012, -d / 2 + 0.04, 0.06, 0.008);
    // The outlet over the slice tray at the front, the tray with its rim, the bag holder below.
    p.plate("slot", -tray.x, tray.x, tray.y, tray.y + 0.16, front, front + 0.001, 0.01);
    p.pan("steel", -tray.x, tray.x, tray.y - 0.04, tray.y, front - 0.01, d / 2, { wall: 0.003, r: 0.02 });
    for (const sx of [-1, 1]) p.tube("wire", [{ x: sx * tray.x * 0.8, y: tray.y - 0.06, z: front }, { x: sx * tray.x * 0.8, y: tray.y - 0.06, z: d / 2 - 0.02 }, { x: sx * tray.x * 0.8, y: tray.y - 0.16, z: d / 2 - 0.02 }], 0.004, { bend: 0.015 });
    // The switch panel at the top right of the front, the drive's door below the tray.
    const face = controlPanel(p, w * 0.12, w * 0.42, h * 0.72, h * 0.8, front);
    pushButton(p, w * 0.2, h * 0.76, face, 0.012, "panel");
    pushButton(p, w * 0.34, h * 0.76, face, 0.012, "knob");
    p.roundedBox("paintGray", -w / 2 + 0.04, w / 2 - 0.04, FEET + 0.05, tray.y - 0.2, front, front + 0.012, 0.004, "top", "z");
    p.barHandle("x", -0.1, 0.1, tray.y - 0.25, front + 0.012, front + 0.03);
    ventSlots(p, -w * 0.25, w * 0.25, FEET + 0.1, FEET + 0.22, front + 0.012, 4);
    // The hand lever on the right side that pushes the loaf through the blades.
    const lx = w / 2 - GRIP;
    p.tube("handle", [{ x: xr - 0.005, y: h * 0.65, z: 0 }, { x: lx, y: h * 0.65, z: 0 }, { x: lx, y: h * 0.82, z: 0 }], 0.01, { bend: 0.025 });
    p.lathe("knob", lx, h * 0.82 - 0.01, 0, [
      [0, 0],
      [GRIP * 0.8, 0],
      [GRIP, 0.02],
      [GRIP, 0.07],
      [GRIP * 0.7, 0.09],
      [0, 0.09],
    ]);
  },
};
