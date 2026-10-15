// Cleaning (Reinigung): the wall-mounted cleaning station with a hose reel, the injector that
// mixes the cleaning agent into the water and the spray gun on its hook; the dosing station for
// the detergent and rinse aid of the dishwashers (peristaltic pumps and their controller on a
// wall plate); and the cleaning trolley with two mop buckets, a wringer and a bag holder.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, castor, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { button, buttons } from "./details";
import { display } from "../parts/details";

/** Wall plate of the wall units (m). */
const PLATE = 0.012;

/** A turned quarter-turn valve handle along z at (x, y) on a face at `zFace` (m). */
function valve(p: Parts, x: number, y: number, zFace: number): void {
  p.lathe("satin", x, y, zFace, [
    [0, 0],
    [0.014, 0],
    [0.014, 0.025],
    [0, 0.025],
  ], { axis: "z" });
  p.roundedBox("knob", x - 0.008, x + 0.008, y - 0.04, y + 0.008, zFace + 0.025, zFace + 0.04, 0.004);
}

// ---------------------------------------------------------------------------------------------
// Cleaning station with hose reel (Reinigungsstation mit Schlauchtrommel)

/** The hose reel: radius of its flanges and of the wound hose (m). */
const REEL = 0.2;
const WOUND = 0.13;
/** Width of the injector box at the right (m). */
const INJECTOR = 0.15;

/** The reel's centre on the wall plate of a unit w × h (m). */
function reelOf(w: number, h: number) {
  const r = Math.min(REEL, (w - INJECTOR - 0.04) / 2, h * 0.32);
  return { x: -w / 2 + 0.02 + r, y: h - 0.03 - r, r };
}

export const cleaningStation: KindDef = {
  kind: "cleaningStation",
  placement: "overhead",
  plan(s) {
    const reel = reelOf(s.w / 1000, s.item.height / 1000);
    const rx = reel.x * 1000;
    const rr = reel.r * 1000;
    s.rect("detail", rx - rr, s.B + PLATE * 1000, rx + rr, s.F - INSET);
    s.rect("detail", s.R - INJECTOR * 1000, s.B + PLATE * 1000, s.R - INSET / 4, s.B + 120);
  },
  elevation(f) {
    const { r, z0, top } = f;
    const c = (f.l + f.r) / 2;
    const reel = reelOf(f.w / 1000, f.item.height / 1000);
    const z = (v: number) => z0 + v * 1000;
    f.circle("detail", c + reel.x * 1000, z(reel.y), reel.r * 1000);
    f.circle("detail", c + reel.x * 1000, z(reel.y), WOUND * Math.min(1, reel.r / REEL) * 1000);
    f.box("detail", r - INJECTOR * 1000, r - FRONT_INSET / 4, top - 280, top - 40);
    // The spray gun hanging on its hook under the injector.
    const gx = r - INJECTOR * 500;
    f.box("detail", gx - 20, gx + 20, z0, top - 330);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    const reel = reelOf(s.w, s.h);
    p.roundedBox("steel", -s.w / 2, s.w / 2, s.h * 0.3, s.h, zb, zb + PLATE, BODY_RADIUS, "top", "z");
    // The reel: a bracket from the wall, the drum with the hose wound on it between two
    // flanges, turned round the axis out of the wall.
    const z0 = zb + PLATE;
    // The axle's cap is the frontmost part of the station.
    const depth = s.d - PLATE - 0.02;
    p.lathe("steelDark", reel.x, reel.y, z0, [
      [0, 0],
      [0.05, 0],
      [0.05, 0.02],
      [0.02, 0.03],
      [0.02, depth + 0.02],
      [0, depth + 0.02],
    ], { axis: "z" });
    const wound = WOUND * Math.min(1, reel.r / REEL);
    for (const z of [z0 + 0.03, z0 + depth - 0.002]) {
      p.lathe("paintGray", reel.x, reel.y, z, [
        [0, 0],
        [reel.r, 0],
        [reel.r, 0.006],
        [reel.r - 0.004, 0.012],
        [0, 0.012],
      ], { axis: "z" });
    }
    const span = depth - 0.044;
    p.lathe("rubber", reel.x, reel.y, z0 + 0.042, [
      [0, 0],
      [wound, 0],
      [wound + 0.006, 0.02],
      [wound + 0.006, span - 0.02],
      [wound, span],
      [0, span],
    ], { axis: "z" });
    // The injector box with its two valves, the hose down from the reel to the spray gun.
    const ix1 = s.w / 2 - 0.01;
    const ix0 = ix1 - INJECTOR;
    const iy1 = s.h - 0.04;
    const iy0 = iy1 - 0.24;
    const iz = zb + PLATE + 0.1;
    p.roundedBox("panel", ix0, ix1, iy0, iy1, zb + PLATE, iz, 0.01);
    display(p, (ix0 + ix1) / 2, iy1 - 0.04, 0.08, 0.025, iz);
    valve(p, ix0 + 0.04, iy0 + 0.08, iz);
    valve(p, ix1 - 0.04, iy0 + 0.08, iz);
    const gx = (ix0 + ix1) / 2;
    const gy = iy0 - 0.07;
    p.roundedBox("handle", gx - 0.012, gx + 0.012, gy, iy0, zb + PLATE, zb + PLATE + 0.05, 0.004);
    // The spray gun hangs from its hook: a grip and trigger, the lance down from it.
    const gz = zb + PLATE + 0.045;
    p.lathe("knob", gx, gy - 0.15, gz, [
      [0, 0],
      [0.016, 0],
      [0.02, 0.03],
      [0.018, 0.13],
      [0.012, 0.15],
      [0, 0.15],
    ]);
    p.tube("handle", [
      { x: gx, y: gy - 0.15, z: gz },
      { x: gx, y: 0.03, z: gz },
    ], 0.007);
    p.lathe("satin", gx, 0, gz, [
      [0, 0],
      [0.012, 0],
      [0.014, 0.02],
      [0.008, 0.035],
      [0, 0.035],
    ]);
    p.tube("rubber", [
      { x: reel.x + wound, y: reel.y, z: zf - 0.02 },
      { x: gx - 0.06, y: reel.y, z: zf - 0.02 },
      { x: gx - 0.06, y: gy - 0.14, z: zf - 0.02 },
      { x: gx, y: gy - 0.14, z: gz + 0.02 },
    ], 0.008, { bend: 0.05 });
  },
};

// ---------------------------------------------------------------------------------------------
// Dosing station (Dosierstation)

/** Peristaltic pumps side by side under the controller, their size (m). */
const PUMP = { w: 0.1, h: 0.12, d: 0.09 };

/** Pumps on a dosing station `w` wide (m). */
const pumpCount = (w: number) => Math.max(1, Math.min(4, Math.floor((w - 0.04) / (PUMP.w + 0.02))));

export const dosingStation: KindDef = {
  kind: "dosingStation",
  placement: "overhead",
  plan(s) {
    s.rect("detail", s.L + INSET / 2, s.B + PLATE * 1000, s.R - INSET / 2, s.B + (PLATE + PUMP.d) * 1000);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const n = pumpCount(f.w / 1000);
    const pitch = (r - l) / n;
    f.box("detail", l + 30, r - 30, top - 160, top - 20);
    f.box("detail", l + 50, l + 160, top - 120, top - 70);
    for (let i = 0; i < n; i++) {
      const c = l + pitch * (i + 0.5);
      f.box("detail", c - 50, c + 50, top - 330, top - 200);
      f.circle("detail", c, top - 265, 40);
      f.line("detail", [c, top - 330], [c, z0]);
    }
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    const z0 = zb + PLATE;
    p.roundedBox("panel", -s.w / 2, s.w / 2, 0, s.h, zb, z0, BODY_RADIUS, "top", "z");
    // The controller at the top: a white box with the display and the keys.
    const c1 = s.h - 0.02;
    const c0 = c1 - 0.14;
    const cz = zf - 0.015;
    p.roundedBox("panel", -s.w / 2 + 0.03, s.w / 2 - 0.03, c0, c1, z0, cz, 0.01);
    display(p, -s.w / 2 + 0.105, c1 - 0.045, 0.11, 0.05, cz);
    buttons(p, s.w / 2 - 0.03 - 0.14, s.w / 2 - 0.04, c1 - 0.045, cz, 4, 0.007);
    button(p, s.w / 2 - 0.07, c0 + 0.03, cz, 0.008, "panelDark");
    // The pumps: a body with the round see-through cover of the pump head, the rotor dark
    // behind it, and the suction and pressure tubes down from each.
    const n = pumpCount(s.w);
    const pitch = s.w / n;
    const p1 = c0 - 0.04;
    const p0 = p1 - PUMP.h;
    // The pump heads' covers are the frontmost parts.
    const pz = zf;
    for (let i = 0; i < n; i++) {
      const x = -s.w / 2 + pitch * (i + 0.5);
      p.roundedBox("paintGray", x - PUMP.w / 2, x + PUMP.w / 2, p0, p1, z0, pz - 0.012, 0.008);
      p.lathe("knob", x, (p0 + p1) / 2, pz - 0.012, [
        [0, 0],
        [0.034, 0],
        [0.034, 0.004],
        [0, 0.004],
      ], { axis: "z" });
      p.lathe("glass", x, (p0 + p1) / 2, pz - 0.008, [
        [0, 0],
        [0.04, 0],
        [0.04, 0.004],
        [0.034, 0.008],
        [0, 0.008],
      ], { axis: "z" });
      for (const dx of [-0.025, 0.025]) {
        p.tube("rubber", [
          { x: x + dx, y: p0 + 0.002, z: z0 + 0.04 },
          { x: x + dx, y: 0, z: z0 + 0.04 },
        ], 0.004);
      }
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Cleaning trolley (Reinigungswagen)

/** Bucket radius at the rim and height, the wheel radius (m). */
const BUCKET = { r: 0.15, h: 0.27 };
const WHEEL = 0.04;
/** Height of the chassis tray's top (m). */
const CHASSIS = 0.13;

/** A plastic mop bucket at (x, z) on the chassis: turned, narrowing to the bottom, with a rim. */
function bucket(p: Parts, x: number, z: number, y0: number, r: number, h: number, mat: "panel" | "panelDark"): void {
  p.lathe(mat, x, y0, z, [
    [0, 0],
    [r * 0.8, 0],
    [r * 0.82, 0.01],
    [r * 0.97, h - 0.02],
    [r, h - 0.015],
    [r, h],
    [r - 0.008, h],
    [r * 0.95 - 0.008, h - 0.02],
    [r * 0.8 - 0.008, 0.02],
    [0, 0.02],
  ]);
  // Water in the bucket, lower than its rim.
  p.lathe("water", x, y0 + 0.02, z, [
    [0, 0],
    [r * 0.9 - 0.009, 0],
    [r * 0.9 - 0.009, h * 0.5],
    [0, h * 0.5],
  ]);
}

export const cleaningTrolley: KindDef = {
  kind: "cleaningTrolley",
  plan(s) {
    const r = Math.min(BUCKET.r * 1000, s.d / 2 - INSET / 2);
    s.circle("detail", s.L + INSET / 2 + r, 0, r);
    s.circle("detail", s.L + INSET + r * 3, 0, r);
    const bx = s.L + INSET * 1.5 + r * 4;
    if (s.R - INSET - bx > 100) s.rect("detail", bx, s.B + INSET, s.R - INSET, s.F - INSET);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const z = (v: number) => z0 + v * 1000;
    const br = BUCKET.r * 1000;
    f.box("detail", l, r, z(WHEEL * 2), z(CHASSIS));
    // The buckets side by side as in 3D, the wringer on the first one.
    f.box("detail", l + 25, l + 25 + br * 2, z(CHASSIS), z(CHASSIS + BUCKET.h));
    f.box("detail", l + 45 + br * 2, l + 45 + br * 4, z(CHASSIS), z(CHASSIS + BUCKET.h));
    f.box("detail", l + 25 + br * 0.3, l + 25 + br * 1.7, z(CHASSIS + BUCKET.h - 0.01), z(CHASSIS + BUCKET.h + 0.12));
    // The push handle's upright at the end and the bag in its holder beside it.
    f.box("detail", r - 55, r - 25, z(CHASSIS), top);
    const bx0 = l + 105 + br * 4;
    if (r - 70 - bx0 > 100) f.box("detail", bx0, r - 70, z(CHASSIS), top - 150);
    for (const x of [l + WHEEL * 1000, r - WHEEL * 1000]) f.circle("detail", x, z(WHEEL), WHEEL * 1000);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    const r = Math.min(BUCKET.r, s.d / 2 - 0.025);
    // The chassis: a moulded tray on four castors.
    for (const x of [-s.w / 2 + WHEEL + 0.01, s.w / 2 - WHEEL - 0.01]) for (const z of [zb + WHEEL + 0.01, zf - WHEEL - 0.01]) castor(p, x, z, WHEEL, WHEEL * 2 + 0.01);
    p.roundedBox("paintGray", -s.w / 2, s.w / 2, WHEEL * 2 + 0.01, CHASSIS, zb, zf, 0.02);
    // Two buckets, the wringer on the first one with its lever.
    const b1 = -s.w / 2 + 0.025 + r;
    const b2 = b1 + r * 2 + 0.02;
    bucket(p, b1, 0, CHASSIS, r, BUCKET.h, "panel");
    bucket(p, b2, 0, CHASSIS, r, BUCKET.h, "panelDark");
    const wy = CHASSIS + BUCKET.h;
    p.roundedBox("paintGray", b1 - r * 0.7, b1 + r * 0.7, wy - 0.01, wy + 0.12, -r * 0.6, r * 0.6, 0.02);
    p.roundedBox("slot", b1 - r * 0.5, b1 + r * 0.5, wy + 0.119, wy + 0.122, -r * 0.4, r * 0.4, 0.01, "vertical");
    p.tube("steelDark", [
      { x: b1 + r * 0.7 - 0.01, y: wy + 0.09, z: 0 },
      { x: b1 + r * 0.7 + 0.04, y: wy + 0.09, z: 0 },
      { x: b1 + r * 0.7 + 0.04, y: Math.min(s.h - 0.05, wy + 0.45), z: 0 },
    ], 0.01, { bend: 0.03 });
    // The frame at the other end: a push handle, a bag holder ring and the bag in it.
    const fx = s.w / 2 - 0.04;
    const bx0 = b2 + r + 0.04;
    if (fx - bx0 > 0.15) {
      const ring = s.h - 0.15;
      p.roundedBox("panelDark", bx0 + 0.02, fx - 0.03, CHASSIS, ring, zb + 0.06, zf - 0.06, 0.04);
      p.tube("steelDark", [
        { x: fx, y: ring, z: zb + 0.05 },
        { x: bx0, y: ring, z: zb + 0.05 },
        { x: bx0, y: ring, z: zf - 0.05 },
        { x: fx, y: ring, z: zf - 0.05 },
      ], 0.008, { bend: 0.04 });
    }
    // The push handle: two uprights at the end and the bar across.
    p.tube("steelDark", [
      { x: fx, y: CHASSIS, z: zb + 0.05 },
      { x: fx, y: s.h - 0.015, z: zb + 0.05 },
      { x: fx, y: s.h - 0.015, z: zf - 0.05 },
      { x: fx, y: CHASSIS, z: zf - 0.05 },
    ], 0.015, { bend: 0.06 });
  },
};
