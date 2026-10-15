// Fixtures on the walls of the building: the electrical distribution board (Unterverteilung),
// the gas emergency shut-off box (Gas-Absperreinrichtung), the fire extinguisher and the fire
// blanket, the emergency exit sign, the panel radiator and the wall-hung water heater.

import { arcPoints, BODY_RADIUS, DOOR_RADIUS, type Parts, type Point2 } from "../parts/mesh";
import type { KindDef } from "../types";

/** A small turned hinge barrel standing at (x, y) up to y + `len`, its axis at z (m). */
function hinge(p: Parts, x: number, y: number, z: number, len: number): void {
  const r = 0.005;
  p.lathe("satin", x, y, z, [
    [0, 0],
    [r * 0.7, 0],
    [r, r * 0.4],
    [r, len - r * 0.4],
    [r * 0.7, len],
    [0, len],
  ]);
}

/** A flat label (a sign, a rating plate) on a face at `zFace`, centred at (x, y) (m). */
function label(p: Parts, x: number, y: number, w: number, h: number, zFace: number, mat: "panel" | "signalRed" | "signalGreen" = "panel"): void {
  p.plate(mat, x - w / 2, x + w / 2, y - h / 2, y + h / 2, zFace - 0.0005, zFace + 0.0012, Math.min(w, h) * 0.1);
}

// ---------------------------------------------------------------------------------------------
// Distribution board

/** Door of the distribution board: thickness, and the cable gland plate on the top (m). */
const BOARD_DOOR = 0.02;
const GLANDS = 0.02;

export const distributionBoard: KindDef = {
  kind: "distributionBoard",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.F - BOARD_DOOR * 1000], [s.R, s.F - BOARD_DOOR * 1000]);
    s.quarter("hidden", s.L, s.F, s.w, 0);
  },
  elevation(f) {
    const i = 25;
    f.box("detail", f.l + i, f.r - i, f.z0 + i, f.top - GLANDS * 1000 - i);
    const zc = (f.z0 + f.top) / 2;
    f.circle("detail", f.r - 60, zc, 14);
    for (let k = 0; k < 4; k++) f.line("detail", [f.l + 80, f.z0 + 60 + k * 16], [f.r - 120, f.z0 + 60 + k * 16]);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const zd = s.d / 2 - BOARD_DOOR;
    const top = s.h - GLANDS;
    // The painted housing and its door, rounded like pressed sheet.
    p.roundedBox("paintGray", -W, W, 0, top, B, zd, BODY_RADIUS * 2, "vertical");
    p.roundedBox("paintGray", -W + 0.004, W - 0.004, 0.004, top - 0.004, zd, s.d / 2 - 0.006, DOOR_RADIUS * 2, "top", "z");
    for (const y of [0.08, top - 0.14]) hinge(p, -W + 0.005, y, zd + 0.002, 0.06);
    // The quarter-turn lock with its handle, a vent at the bottom, the warning label at the top.
    const yc = top / 2;
    p.lathe("knob", W - 0.06, yc, s.d / 2 - 0.006, [[0, 0], [0.016, 0], [0.016, 0.002], [0.012, 0.004], [0, 0.004]], { axis: "z" });
    p.roundedBox("knob", W - 0.066, W - 0.054, yc - 0.03, yc + 0.012, s.d / 2 - 0.004, s.d / 2, 0.003);
    for (let k = 0; k < 4; k++) {
      const y = 0.06 + k * 0.016;
      p.plate("slot", -W + 0.08, W - 0.12, y - 0.003, y + 0.003, s.d / 2 - 0.0068, s.d / 2 - 0.0055, 0.003);
    }
    label(p, 0, top - 0.08, 0.08, 0.07, s.d / 2 - 0.006);
    // Cable glands in the gland plate on top, the cables leaving upwards.
    p.roundedBox("steelDark", -W + 0.03, W - 0.03, top - 0.001, top + 0.004, B + 0.03, zd - 0.03, 0.002);
    const n = Math.max(2, Math.floor((s.w - 0.1) / 0.08));
    for (let i = 0; i < n; i++) {
      const x = -W + 0.05 + ((s.w - 0.1) * (i + 0.5)) / n;
      p.lathe("knob", x, top + 0.004, (B + zd) / 2, [[0, 0], [0.014, 0], [0.014, 0.006], [0.009, 0.009], [0.009, GLANDS - 0.004], [0, GLANDS - 0.004]]);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Gas emergency shut-off

export const gasShutoffBox: KindDef = {
  kind: "gasShutoffBox",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.F - 20], [s.R, s.F - 20]);
  },
  elevation(f) {
    const i = 30;
    f.box("detail", f.l + i, f.r - i, f.z0 + i, f.top - 80, "glass");
    f.box("detail", f.l + i, f.r - i, f.top - 65, f.top - 25);
    const c = (f.l + f.r) / 2;
    f.line("detail", [c, f.z0], [c, f.top - 80]);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const zf = s.d / 2 - 0.004;
    // The box: a back and four walls, open to the window door so the valve shows through it.
    const t = 0.006;
    const zb = zf - 0.01;
    p.roundedBox("panel", -W, W, 0, s.h, B, B + t, BODY_RADIUS);
    for (const sx of [-1, 1]) p.roundedBox("panel", sx > 0 ? W - t : -W, sx > 0 ? W : -W + t, 0, s.h, B, zb, BODY_RADIUS, "vertical");
    for (const [a, b] of [
      [0, t],
      [s.h - t, s.h],
    ]) {
      p.roundedBox("panel", -W + t, W - t, a, b, B, zb, BODY_RADIUS);
    }
    // The gas pipe running down through the box and the ball valve on it with its yellow gas lever.
    const zp = B + 0.045;
    p.rod("steelDark", "y", 0, s.h / 2, zp, s.h - 0.002, 0.014);
    const yv = s.h * 0.42;
    p.lathe("satin", 0, yv - 0.04, zp, [[0, 0], [0.02, 0], [0.024, 0.01], [0.024, 0.07], [0.02, 0.08], [0, 0.08]]);
    p.lathe("satin", 0, yv, zp + 0.02, [[0, 0], [0.008, 0], [0.008, 0.02], [0, 0.02]], { axis: "z" });
    p.tube("signalYellow", [
      { x: 0, y: yv, z: zp + 0.04 },
      { x: 0.1, y: yv, z: zp + 0.04 },
    ], 0.007);
    // The window door: a frame with round corners round the glass, and the sign above it on a
    // front panel that closes the box over the door, a strip under it.
    const y1 = s.h - 0.08;
    p.roundedBox("panel", -W, W, y1, s.h, zb - t, zb, BODY_RADIUS);
    p.roundedBox("panel", -W, W, 0, 0.02, zb - t, zb, BODY_RADIUS);
    p.lathe("panel", 0, (0.02 + y1) / 2, zf - 0.01, [[0, 0], [0.025, 0], [0.025, 0.01], [0, 0.01], [0, 0]], { axis: "z", rect: [W - 0.025 - 0.005, (y1 - 0.02) / 2 - 0.025] });
    p.box("glass", -W + 0.03, W - 0.03, 0.045, y1 - 0.025, zf - 0.006, zf - 0.004);
    label(p, 0, s.h - 0.045, s.w - 0.06, 0.04, zf - 0.009);
    p.lathe("knob", W - 0.03, y1 / 2, zf, [[0, 0], [0.008, 0], [0.008, 0.004], [0, 0.004]], { axis: "z" });
  },
};

// ---------------------------------------------------------------------------------------------
// Fire extinguisher and fire blanket

/** The extinguisher's valve head and the wall plate it hangs on (m). */
const HEAD = 0.1;
const WALL_PLATE = 0.012;

export const fireExtinguisher: KindDef = {
  kind: "fireExtinguisher",
  placement: "overhead",
  plan(s) {
    const r = (s.d / 1000 - WALL_PLATE - 0.002) * 500;
    s.circle("overhead", 0, s.B + WALL_PLATE * 1000 + r, r);
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const r = Math.min((f.item.depth / 1000 - WALL_PLATE - 0.002) * 500, f.w / 2 - 10);
    const body = f.top - HEAD * 1000;
    f.box("detail", c - r, c + r, f.z0, body);
    f.box("detail", c - 15, c + 15, body, f.top - 20);
    f.line("detail", [c - 15, f.top - 30], [c + 70, f.top - 50]);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    // The label round the bottle reaches the front.
    const r = Math.min((s.d - WALL_PLATE - 0.0005) / 2, W - 0.012);
    const zc = B + WALL_PLATE + r;
    const body = s.h - HEAD;
    // The wall plate with the hanging bracket, as wide as the unit.
    p.roundedBox("steelDark", -W, W, body * 0.55, body * 0.85, B, B + WALL_PLATE * 0.5, BODY_RADIUS);
    // The cylinder: a turned bottle with a foot ring and a domed shoulder.
    p.lathe("signalRed", 0, 0, zc, [
      [0, 0.004],
      [r * 0.9, 0.004],
      [r * 0.94, 0],
      [r, 0.012],
      [r, body - r * 0.5],
      ...arcPoints(r * 0.4, body - r * 0.5, r * 0.6, 0, Math.PI / 2, 4),
      [0, body + r * 0.1],
    ]);
    // A label wrapped round the front, the valve head, the lever and the hose to the nozzle.
    p.lathe("panel", 0, body * 0.3, zc, [[r + 0.0005, 0], [r + 0.0005, body * 0.35], [r - 0.001, body * 0.35], [r - 0.001, 0], [r + 0.0005, 0]], { segments: 32 });
    const yh = body + r * 0.1;
    // The valve head reaches the top of the unit, the lever beside it.
    const head = s.h - (yh - 0.005);
    p.lathe("satin", 0, yh - 0.005, zc, [[0, 0], [0.022, 0], [0.022, 0.03], [0.016, 0.04], [0.016, head - 0.006], [0.012, head], [0, head]]);
    p.tube("steelDark", [
      { x: -0.012, y: s.h - 0.03, z: zc },
      { x: -0.012, y: s.h - 0.008, z: zc },
      { x: 0.07, y: s.h - 0.03, z: zc },
    ], 0.008, { bend: 0.01 });
    p.tube("knob", [
      { x: 0.02, y: yh + 0.02, z: zc },
      { x: W - 0.012, y: yh + 0.01, z: zc },
      { x: W - 0.012, y: body * 0.45, z: zc },
    ], 0.008, { bend: 0.05 });
    p.lathe("knob", W - 0.012, body * 0.45 - 0.08, zc, [[0, 0], [0.006, 0], [0.012, 0.06], [0.01, 0.08], [0, 0.08]]);
  },
};

export const fireBlanket: KindDef = {
  kind: "fireBlanket",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.F - 15], [s.R, s.F - 15]);
  },
  elevation(f) {
    const tabs = f.z0 + 60;
    f.line("detail", [f.l, tabs], [f.r, tabs]);
    f.box("detail", f.l + 30, f.r - 30, tabs + 60, f.top - 40);
    const c = (f.l + f.r) / 2;
    for (const x of [c - 60, c + 60]) f.box("detail", x - 15, x + 15, f.z0, tabs);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const tabs = 0.06;
    // The red container, its white front with the sign, the two pull tabs hanging below.
    p.roundedBox("signalRed", -W, W, tabs, s.h, B, s.d / 2 - 0.0012, 0.012);
    label(p, 0, (tabs + s.h) / 2 + 0.02, s.w - 0.06, s.h - tabs - 0.12, s.d / 2 - 0.0012);
    for (const x of [-0.06, 0.06]) {
      p.roundedBox("knob", x - 0.015, x + 0.015, 0, tabs + 0.01, s.d / 2 - 0.03, s.d / 2 - 0.022, 0.003);
      p.lathe("knob", x, 0.012, s.d / 2 - 0.022, [[0, 0], [0.01, 0], [0.01, 0.002], [0, 0.002]], { axis: "z" });
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Emergency exit sign

export const exitSign: KindDef = {
  kind: "exitSign",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.F - 10], [s.R, s.F - 10]);
  },
  elevation(f) {
    const i = 15;
    f.box("detail", f.l + i, f.r - i, f.z0 + i, f.top - i, "item-dark");
    const c = (f.l + f.r) / 2;
    f.line("detail", [c - 60, f.z0 + 40], [c, (f.z0 + f.top) / 2], [c + 50, f.z0 + 40]);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    // The sign's face; the white pictogram stands on it up to the front of the unit.
    const zf = s.d / 2 - 0.0012;
    // The white housing with the green sign in front, lit from inside.
    p.roundedBox("panel", -W, W, 0, s.h, B, zf - 0.002, 0.008);
    const i = 0.015;
    p.plate("signalGreen", -W + i, W - i, i, s.h - i, zf - 0.003, zf, 0.006);
    const u = (s.h - 2 * i) / 10;
    const y0 = i;
    /** A white bar of the pictogram from point a to point b, `t` wide, on the sign's face. */
    const bar = (a: readonly [number, number], b: readonly [number, number], t: number) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const cx = (a[0] + b[0]) / 2;
      const cy = (a[1] + b[1]) / 2;
      // A plate lies thin along z; turning it about its own thin axis turns it in the face.
      p.plate("panel", cx - len / 2 - t / 2, cx + len / 2 + t / 2, cy - t / 2, cy + t / 2, zf - 0.0005, zf + 0.0012, t / 2).rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]);
    };
    // The door at the right.
    const dx = W - i - u * 4.5;
    bar([dx, y0 + u], [dx, y0 + u * 9], u * 0.6);
    bar([dx + u * 3, y0 + u], [dx + u * 3, y0 + u * 9], u * 0.6);
    bar([dx, y0 + u * 9], [dx + u * 3, y0 + u * 9], u * 0.6);
    // The running figure: head, body, legs and arms.
    const fx = dx - u * 2.5;
    p.lathe("panel", fx + u * 0.4, y0 + u * 8, zf - 0.0005, [[0, 0], [u * 0.8, 0], [u * 0.8, 0.0017], [0, 0.0017]], { axis: "z" });
    const t = u * 0.8;
    bar([fx, y0 + u * 7], [fx - u * 0.6, y0 + u * 4], t);
    bar([fx - u * 0.6, y0 + u * 4], [fx + u * 1.2, y0 + u * 2.4], t);
    bar([fx + u * 1.2, y0 + u * 2.4], [fx + u * 1.6, y0 + u * 0.8], t);
    bar([fx - u * 0.6, y0 + u * 4], [fx - u * 1.8, y0 + u * 2.6], t);
    bar([fx - u * 1.8, y0 + u * 2.6], [fx - u * 2.8, y0 + u * 2.4], t);
    bar([fx - u * 1.6, y0 + u * 5.4], [fx, y0 + u * 7], t * 0.8);
    bar([fx, y0 + u * 7], [fx + u * 1.4, y0 + u * 5.6], t * 0.8);
    // The arrow at the left.
    const ax = -W + i + u * 1.2;
    const arrow: Point2[] = [
      [ax, y0 + u * 5],
      [ax + u * 2, y0 + u * 7],
      [ax + u * 2, y0 + u * 5.8],
      [ax + u * 3.8, y0 + u * 5.8],
      [ax + u * 3.8, y0 + u * 4.2],
      [ax + u * 2, y0 + u * 4.2],
      [ax + u * 2, y0 + u * 3],
    ];
    p.extrude("panel", "z", zf - 0.0005, zf + 0.0012, arrow);
  },
};

// ---------------------------------------------------------------------------------------------
// Panel radiator

/** Pitch of the vertical profiling of a radiator's front panel, and its depth (m). */
const PROFILE = 0.033;
const PROFILE_D = 0.003;
/** Room beside the panels for the valve with its thermostatic head (m, its diameter). */
const VALVE = 0.05;

export const radiator: KindDef = {
  kind: "radiator",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.B + 30], [s.R, s.B + 30]);
    s.line("overhead", [s.L, s.F - 30], [s.R, s.F - 30]);
  },
  elevation(f) {
    const n = Math.floor(f.w / (PROFILE * 1000));
    for (let i = 1; i < n; i++) {
      const x = f.l + (f.w * i) / n;
      f.line("detail", [x, f.z0 + 30], [x, f.top - 30]);
    }
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const F = s.d / 2;
    const y0 = 0.03;
    const top = s.h - 0.012;
    // The panels end short of the right side, where the valve and its pipe stand.
    const xa = -W;
    const xb = W - VALVE;
    // The two water panels with the convector fins between them; the front one profiled.
    p.roundedBox("panel", xa + 0.008, xb - 0.008, y0, top, B + 0.02, B + 0.04, 0.004, "vertical");
    p.box("slot", xa + 0.01, xb - 0.01, y0 + 0.02, top - 0.006, B + 0.04, F - 0.03);
    const n = Math.max(2, Math.round((xb - xa - 0.016) / PROFILE));
    const pitch = (xb - xa - 0.016) / n;
    const front: Point2[] = [[xa + 0.008, F - 0.03]];
    for (let i = 0; i < n; i++) {
      const x = xa + 0.008 + pitch * i;
      front.push([x + pitch * 0.15, F], [x + pitch * 0.85, F], [x + pitch, F - PROFILE_D]);
    }
    front.push([xb - 0.008, F - 0.03]);
    p.extrude("panel", "y", y0, top, front);
    // Side covers and the top grille with its slots.
    for (const [a, b] of [
      [xa, xa + 0.008],
      [xb - 0.008, xb],
    ]) {
      p.roundedBox("panel", a, b, y0, top, B + 0.02, F - 0.001, 0.002);
    }
    p.roundedBox("panel", xa, xb, top, s.h - 0.001, B + 0.02, F - 0.001, 0.003);
    for (let x = xa + 0.03; x < xb - 0.03; x += 0.012) p.roundedBox("slot", x - 0.0025, x + 0.0025, s.h - 0.0015, s.h, B + 0.03, F - 0.012, 0.0025, "vertical");
    // The thermostatic head on its valve beside the panels, the pipe down, the wall brackets.
    const xv = W - VALVE / 2;
    const yv = s.h * 0.7;
    p.tube("handle", [
      { x: xb - 0.004, y: yv, z: F - 0.03 },
      { x: xv, y: yv, z: F - 0.03 },
      { x: xv, y: 0, z: F - 0.03 },
    ], 0.008, { bend: 0.02 });
    p.lathe("panel", xv, yv, F - 0.03, [[0, 0], [VALVE / 2, 0], [VALVE / 2, 0.02], [VALVE * 0.42, 0.065], [VALVE * 0.3, 0.07], [0, 0.07]]);
    for (const sx of [-1, 1]) p.roundedBox("steelDark", sx * (W - 0.15) - 0.02, sx * (W - 0.15) + 0.02, s.h * 0.3, s.h * 0.8, B, B + 0.02, BODY_RADIUS);
  },
};

// ---------------------------------------------------------------------------------------------
// Water heater

/** Height of the domed ends of the tank and of the connections below it (m). */
const DOME = 0.06;
const CONNECTIONS = 0.08;
/** Depth of the wall rails behind the tank (m). */
const RAIL = 0.012;

export const waterHeater: KindDef = {
  kind: "waterHeater",
  placement: "overhead",
  plan(s) {
    s.circle("overhead", 0, 0, Math.min(s.w, s.d) / 2 - 1);
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const r = Math.min(f.w, f.item.depth) / 2 - RAIL * 1000;
    f.box("detail", c - r, c + r, f.z0 + CONNECTIONS * 1000 + DOME * 1000, f.top - DOME * 1000);
    for (const x of [c - 50, c + 50]) f.line("detail", [x, f.z0], [x, f.z0 + CONNECTIONS * 1000]);
    f.circle("detail", c, f.z0 + (CONNECTIONS + DOME + 0.07) * 1000, 20);
  },
  mesh(p, s) {
    const r = Math.min(s.w, s.d) / 2;
    const y0 = CONNECTIONS;
    const h = s.h - y0;
    // The enamelled tank in its white casing: a turned cylinder with domed ends, standing a
    // little off the wall on its rail.
    const R = r - RAIL;
    p.lathe("panel", 0, y0, 0, [
      [0, 0],
      ...arcPoints(R - DOME, DOME, DOME, -Math.PI / 2, 0, 3),
      [R, h - DOME],
      ...arcPoints(R - DOME, h - DOME, DOME, 0, Math.PI / 2, 3),
      [0, h],
    ]);
    // The control in front: the temperature display and the thermostat knob below it.
    const yk = y0 + DOME + 0.07;
    p.plate("glassDark", -0.03, 0.03, yk + 0.04, yk + 0.065, R - 0.003, R + 0.002, 0.004);
    p.knob(0, yk, R - 0.004, r, 0.02);
    // Cold in and hot out below, with the safety valve on the cold one.
    for (const x of [-0.05, 0.05]) {
      p.tube("handle", [
        { x, y: y0 + DOME * 0.3, z: 0 },
        { x, y: 0.012, z: 0 },
      ], 0.01);
      p.lathe(x < 0 ? "signalBlue" : "signalRed", x, 0, 0, [[0, 0], [0.012, 0], [0.012, 0.012], [0, 0.012]]);
    }
    p.lathe("satin", -0.05, y0 * 0.45, 0, [[0, 0], [0.018, 0], [0.018, 0.035], [0, 0.035]]);
    // The wall rails it hangs on, as wide as the unit.
    for (const y of [y0 + h * 0.2, y0 + h * 0.8]) p.roundedBox("steelDark", -s.w / 2, s.w / 2, y, y + 0.04, -s.d / 2, -s.d / 2 + RAIL, BODY_RADIUS);
  },
};

