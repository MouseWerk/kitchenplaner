// Chamber vacuum packer (Vakuumiergerät): a stainless body with the control panel at the front
// and a clear domed lid over the chamber with the seal bar inside. The table size stands on a
// work table (`tableTop`), the floor size on castors.

import type { Front } from "../parts/elevation";
import { roundedRectOutline, type Parts, type Size } from "../parts/mesh";
import type { PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, machineFeet, MACHINE_FOOT, mBox, metres, pRect, tableCastor } from "./common";
import { controlPanel, displayWindow, openTop, pushButton } from "./machine";
import { ratingPlate, ventSlots } from "../parts/details";

/** Where the parts lie (m): a flat lid on the table size, a deeper one on the floor size. */
function layout({ d, h }: Size, floor: boolean) {
  const bottom = floor ? CASTOR : MACHINE_FOOT;
  const lidY = h - (floor ? 0.16 : h * 0.3);
  const panel = { y0: floor ? lidY - 0.22 : bottom + (lidY - bottom) * 0.15, y1: lidY - 0.025 };
  const seal = d / 2 - 0.12;
  return { bottom, lidY, panel, seal };
}

function plan(s: PlanSketch, floor: boolean) {
  const m = metres(s.item);
  const { seal } = layout(m, floor);
  pRect(s, "detail", -m.w / 2 + 0.03, -m.d / 2 + 0.03, m.w / 2 - 0.03, m.d / 2 - 0.05);
  pRect(s, "detail", -m.w / 2 + 0.06, seal - 0.006, m.w / 2 - 0.06, seal + 0.006);
}

function elevation(f: Front, floor: boolean) {
  const m = metres(f.item);
  const { bottom, lidY, panel } = layout(m, floor);
  mBox(f, "detail", -m.w / 2, m.w / 2, bottom, lidY);
  mBox(f, "detail", -m.w * 0.42, m.w * 0.42, panel.y0, panel.y1, "item-dark");
  mBox(f, "detail", -m.w * 0.3, -m.w * 0.05, panel.y0 + (panel.y1 - panel.y0) * 0.3, panel.y1 - (panel.y1 - panel.y0) * 0.2);
  mBox(f, "detail", -m.w / 2 + 0.03, m.w / 2 - 0.03, lidY + 0.015, m.h - 0.01, "glass");
  mBox(f, "detail", -m.w * 0.25, m.w * 0.25, m.h - 0.015, m.h);
}

function mesh(p: Parts, s: Size, floor: boolean) {
  const { w, d, h } = s;
  const { bottom, lidY, panel, seal } = layout(s, floor);
  const front = d / 2 - 0.02;
  if (floor) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tableCastor(p, sx * (w / 2 - 0.06), sz * (d / 2 - 0.08));
  } else machineFeet(p, -w / 2, w / 2, -d / 2, front);
  // The body, open at the top for the chamber pressed into its deck.
  const chamberDepth = floor ? 0.12 : Math.min(0.08, (lidY - bottom) * 0.35);
  const y0 = lidY - chamberDepth - 0.004;
  const ch = { x0: -w / 2 + 0.04, x1: w / 2 - 0.04, z0: -d / 2 + 0.04, z1: front - 0.04 };
  p.roundedBox("steel", -w / 2, w / 2, bottom, y0, -d / 2, front, BODY_R, "vertical");
  openTop(p, "steel", -w / 2, w / 2, -d / 2, front, y0, lidY, roundedRectOutline(ch.x0, ch.x1, ch.z0, ch.z1, CHAMBER_R), BODY_R);
  p.pan("steel", ch.x0, ch.x1, lidY - chamberDepth, lidY - 0.001, ch.z0, ch.z1, { wall: 0.003, r: CHAMBER_R });
  // The seal bar across the chamber with its red-brown silicone strip, and a filler plate.
  p.roundedBox("satin", ch.x0 + 0.02, ch.x1 - 0.02, lidY - 0.03, lidY - 0.012, seal - 0.012, seal + 0.012, 0.004);
  p.roundedBox("rubber", ch.x0 + 0.025, ch.x1 - 0.025, lidY - 0.012, lidY - 0.008, seal - 0.005, seal + 0.005, 0.002);
  p.roundedBox("panel", ch.x0 + 0.03, ch.x1 - 0.03, lidY - chamberDepth + 0.003, lidY - chamberDepth + 0.015, ch.z0 + 0.03, seal - 0.03, 0.003);
  // Control panel with the display and keys facing the user.
  const face = controlPanel(p, -w * 0.42, w * 0.42, panel.y0, panel.y1, front);
  const ph = panel.y1 - panel.y0;
  const keyY = panel.y0 + ph / 2;
  displayWindow(p, -w * 0.36, -w * 0.08, panel.y0 + ph * 0.25, panel.y1 - ph * 0.25, face);
  for (const x of [w * 0.06, w * 0.16, w * 0.26]) p.plate("knob", x - 0.014, x + 0.014, keyY - 0.01, keyY + 0.01, face, face + 0.003, 0.004, true);
  pushButton(p, w * 0.36, keyY, face, 0.01, "knob", d / 2 - face);
  if (floor) {
    // Vent slots of the pump compartment and the rating plate.
    ventSlots(p, -w * 0.3, w * 0.3, bottom + 0.06, bottom + 0.26, front, 6);
    ratingPlate(p, w * 0.36, bottom + 0.08, front);
  }
  // Lid: the rubber gasket on its frame, the clear dome turned round the chamber's outline, the
  // hinge at the back and the handle at the front.
  const lx = (w - 0.05) / 2;
  const lz0 = -d / 2 + 0.025;
  const lz1 = front - 0.015;
  const lzc = (lz0 + lz1) / 2;
  const lhz = (lz1 - lz0) / 2;
  const rr = Math.min(0.04, lx / 2, lhz / 2);
  p.lathe("rubber", 0, lidY, lzc, [
    [rr - 0.012, 0],
    [rr, 0],
    [rr, 0.008],
    [rr - 0.012, 0.008],
    [rr - 0.012, 0],
  ], { rect: [lx - rr, lhz - rr] });
  const dome = h - lidY - 0.008;
  p.lathe("glass", 0, lidY + 0.008, lzc, [
    [rr - 0.002, 0],
    [rr - 0.002, dome * 0.55],
    [rr * 0.6, dome * 0.9],
    [0, dome],
  ], { rect: [lx - rr, lhz - rr] });
  const hy = lidY + 0.008 + dome * 0.45;
  for (const sx of [-1, 1]) p.rod("satin", "x", sx * w * 0.3, lidY + 0.012, -d / 2 + 0.012, 0.06, 0.008);
  p.tube(
    "handle",
    [
      { x: -w * 0.25, y: hy, z: lz1 - 0.004 },
      { x: -w * 0.25, y: h - 0.03, z: d / 2 - 0.01 },
      { x: w * 0.25, y: h - 0.03, z: d / 2 - 0.01 },
      { x: w * 0.25, y: hy, z: lz1 - 0.004 },
    ],
    0.01,
    { bend: 0.02 },
  );
}

/** Corner radius of the vacuum chamber and its opening, and of the body's upright corners (m). */
const CHAMBER_R = 0.03;
const BODY_R = 0.008;

export const vacuumTable: KindDef = {
  kind: "vacuumTable",
  placement: "tableTop",
  plan: (s) => plan(s, false),
  elevation: (f) => elevation(f, false),
  mesh: (p, s) => mesh(p, s, false),
};

export const vacuumFloor: KindDef = {
  kind: "vacuumFloor",
  plan: (s) => plan(s, true),
  elevation: (f) => elevation(f, true),
  mesh: (p, s) => mesh(p, s, true),
};
