// Waste water units on the floor: the compact grease trap under a sink (Fettabscheider,
// Kleinabscheider) with its clamped lid, and the lifting station (Abwasserhebeanlage) that pumps
// the waste water of a basement kitchen up to the sewer: a tank with the pump on top, the
// pressure pipe rising and the control box.

import { BODY_RADIUS, foot } from "../parts/mesh";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";
import { flangedPipe } from "./pipes";

// Sizes (m).
/** Inlet and outlet pipes (DN 70) and how far they stand out at the sides. */
const PIPE = 0.038;
const PIPE_OUT = 0.06;
/** Height of the trap's lid, and the radius of its tank's corners seen from above. */
const LID = 0.03;
const TANK_RADIUS = 0.03;
/** Thickness of a lid clamp on the tank's face. */
const CLAMP = 0.008;

export const greaseTrapCompact: KindDef = {
  kind: "greaseTrapCompact",
  plan(s) {
    const o = PIPE_OUT * 1000;
    s.rect("detail", s.L + o + 20, s.B + 20, s.R - o - 20, s.F - 20);
    for (const x of [s.L, s.R - o]) s.rect("detail", x, -PIPE * 1000, x + o, PIPE * 1000);
  },
  elevation(f) {
    const o = PIPE_OUT * 1000;
    f.line("detail", [f.l + o, f.top - LID * 1000], [f.r - o, f.top - LID * 1000]);
    f.box("detail", f.l, f.l + o, f.top - 120 - PIPE * 1000, f.top - 120 + PIPE * 1000);
    f.box("detail", f.r - o, f.r, f.top - 160 - PIPE * 1000, f.top - 160 + PIPE * 1000);
  },
  mesh(p, s) {
    const W = s.w / 2 - PIPE_OUT;
    // The tank stands in by the clamps' thickness at the front and the back.
    const D = s.d / 2 - CLAMP;
    // The tank: a moulded body with large round corners, its lid with a gasket and four clamps.
    p.roundedBox("steel", -W, W, 0.012, s.h - LID, -D, D, TANK_RADIUS, "vertical");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (W - 0.04), sz * (D - 0.04), 0.012, 0.02);
    p.roundedBox("rubber", -W + 0.004, W - 0.004, s.h - LID - 0.001, s.h - LID + 0.004, -D + 0.004, D - 0.004, TANK_RADIUS, "vertical");
    p.roundedBox("steel", -W, W, s.h - LID + 0.004, s.h - 0.001, -D, D, TANK_RADIUS, "vertical");
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (W - 0.09);
        p.roundedBox("satin", x - 0.015, x + 0.015, s.h - LID - 0.04, s.h - 0.008, sz > 0 ? D : -D - CLAMP, sz > 0 ? D + CLAMP : -D, 0.002);
      }
    }
    flangedPipe(p, -s.w / 2, -W, s.h - 0.12, 0, PIPE);
    flangedPipe(p, s.w / 2, W, s.h - 0.16, 0, PIPE);
    // The sight plate with the trap's data on the lid.
    p.roundedBox("panel", -0.06, 0.06, s.h - 0.0015, s.h, -0.04, 0.04, 0.004, "vertical");
  },
};

/** Lifting station: the pump motor's radius and height above the tank, the control box's size (m). */
const MOTOR_R = 0.09;
const MOTOR_H = 0.2;
const CONTROL = { w: 0.2, h: 0.25, d: 0.1 };
/** Pressure pipe (DN 40) radius. */
const PRESSURE = 0.025;

export const liftingStation: KindDef = {
  kind: "liftingStation",
  plan(s) {
    cross(s, "detail", false);
    s.circle("detail", -s.w * 0.15, 0, MOTOR_R * 1000);
  },
  elevation(f) {
    const z1 = f.top - MOTOR_H * 1000;
    f.line("detail", [f.l, z1], [f.r, z1]);
    const c = (f.l + f.r) / 2 - f.w * 0.15;
    f.box("detail", c - MOTOR_R * 1000, c + MOTOR_R * 1000, z1, f.top - 20);
    const xc = f.r - (CONTROL.w * 1000) / 2 - 30;
    f.box("detail", xc - (CONTROL.w * 1000) / 2, xc + (CONTROL.w * 1000) / 2, z1 - CONTROL.h * 1000 - 40, z1 - 40);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    const tank = s.h - MOTOR_H;
    // The tank: moulded polyethylene with ribs round it.
    p.roundedBox("panelDark", -W + 0.01, W - 0.01, 0, tank, -D + 0.01, D - CONTROL.d, 0.04, "vertical");
    for (const y of [tank * 0.3, tank * 0.65]) p.roundedBox("panelDark", -W, W, y, y + 0.03, -D, D - CONTROL.d + 0.006, 0.045, "vertical");
    p.roundedBox("panelDark", -W + 0.01, W - 0.01, tank - 0.03, tank, -D + 0.01, D - CONTROL.d - 0.01, 0.02);
    // The pump: a turned motor housing with cooling ribs on its own flange.
    const mx = -s.w * 0.15;
    p.lathe("paintGray", mx, tank, 0, [
      [0, 0],
      [MOTOR_R * 1.2, 0],
      [MOTOR_R * 1.2, 0.015],
      [MOTOR_R, 0.02],
      [MOTOR_R, MOTOR_H * 0.3],
      [MOTOR_R * 1.06, MOTOR_H * 0.33],
      [MOTOR_R * 1.06, MOTOR_H * 0.45],
      [MOTOR_R, MOTOR_H * 0.48],
      [MOTOR_R, MOTOR_H * 0.9],
      [MOTOR_R * 0.8, MOTOR_H],
      [0, MOTOR_H],
    ]);
    // The pressure pipe up out of the tank with a check valve, and the vent pipe.
    const px = W - 0.08;
    p.tube("panelDark", [
      { x: px, y: tank - 0.01, z: -D + 0.08 },
      { x: px, y: s.h - PRESSURE, z: -D + 0.08 },
      { x: px, y: s.h - PRESSURE, z: -D + PRESSURE },
    ], PRESSURE, { bend: 0.05 });
    p.lathe("satin", px, tank + 0.05, -D + 0.08, [[0, 0], [PRESSURE * 1.6, 0], [PRESSURE * 1.6, 0.07], [0, 0.07]]);
    p.lathe("panelDark", -W + 0.07, tank - 0.01, -D + 0.07, [[0, 0], [0.03, 0], [0.03, MOTOR_H - 0.03], [0.036, MOTOR_H - 0.02], [0.036, MOTOR_H], [0, MOTOR_H]]);
    // The control box in front with its display and alarm light.
    const xc = W - CONTROL.w / 2 - 0.03;
    const yc = tank - 0.04 - CONTROL.h / 2;
    const zf = s.d / 2;
    p.roundedBox("panel", xc - CONTROL.w / 2, xc + CONTROL.w / 2, yc - CONTROL.h / 2, yc + CONTROL.h / 2, zf - CONTROL.d, zf - 0.004, BODY_RADIUS * 3);
    p.plate("glassDark", xc - 0.06, xc + 0.06, yc + 0.03, yc + 0.08, zf - 0.0045, zf - 0.002, 0.004);
    p.lathe("signalRed", xc - 0.05, yc - 0.06, zf - 0.0045, [[0, 0], [0.012, 0], [0.012, 0.002], [0.008, 0.0045], [0, 0.0045]], { axis: "z" });
    for (const dx of [0.0, 0.035]) p.lathe("knob", xc + dx, yc - 0.06, zf - 0.0045, [[0, 0], [0.01, 0], [0.01, 0.003], [0, 0.0035]], { axis: "z" });
    // The cable from the box to the pump.
    p.tube("knob", [
      { x: xc - CONTROL.w / 2 + 0.02, y: yc + CONTROL.h / 2, z: zf - CONTROL.d / 2 },
      { x: mx + MOTOR_R * 0.7, y: tank + MOTOR_H * 0.7, z: zf - CONTROL.d / 2 },
      { x: mx + MOTOR_R * 0.7, y: tank + MOTOR_H * 0.7, z: 0 },
    ], 0.006, { bend: 0.04 });
  },
};
