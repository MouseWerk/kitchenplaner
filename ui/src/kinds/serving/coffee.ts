// The coffee bar: the espresso machine with its group heads (Siebträgermaschine), the coffee
// grinder, the filter coffee brewer with its jugs, the hot water dispenser, the milk cooler, the
// cup warmer (all on the counter) and the counter module with the knock box drawer (Abschlag-
// schublade) under its top.

import { doorCount, FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, DOOR_RADIUS, foot, GAP, PLINTH, TOP, type Hole, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, cup, dripTray, GLASS, leafDoors, pilotLamp, rocker } from "./common";

/** Pressed housings of coffee machines (m). */
const PRESSED = 0.008;
/** Height of the feet under a coffee machine (m). */
const FEET_M = 0.03;

/** Short feet at the corners of a counter-top machine, inside the footprint (m). */
function machineFeet(p: Parts, x0: number, x1: number, z0: number, z1: number): void {
  for (const x of [x0 + 0.03, x1 - 0.03]) for (const z of [z0 + 0.03, z1 - 0.03]) foot(p, x, z, FEET_M, 0.014);
}

// ---------------------------------------------------------------------------------------------
// Espresso machine

/** Group heads of an espresso machine of the given width (mm). */
export function groupCount(width: number): number {
  return width < 650 ? 1 : width < 900 ? 2 : 3;
}

function groupXs(width: number): number[] {
  const n = groupCount(width);
  const span = width - 260;
  return Array.from({ length: n }, (_, i) => -span / 2 + (span / n) * (i + 0.5));
}

/** Height of the drip tray area (m) and of the cup gallery on top (m). */
const TRAY = 0.06;
const GALLERY = 0.06;

export const espressoMachine: KindDef = {
  kind: "espressoMachine",
  placement: "tableTop",
  plan(s) {
    s.rect("detail", s.L + INSET, s.F - 130, s.R - INSET, s.F - INSET / 2);
    for (const x of groupXs(s.w)) s.circle("detail", x, s.F - 170, 40);
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, s.B + s.d * 0.6);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const scale = f.w / f.item.width;
    const yb = z0 + (FEET_M + TRAY) * 1000;
    f.line("detail", [l, yb], [r, yb]);
    f.line("detail", [l, top - GALLERY * 1000], [r, top - GALLERY * 1000]);
    for (const x0 of groupXs(f.item.width)) {
      const x = (l + r) / 2 + x0 * scale;
      const gy = z0 + (top - z0) * 0.5;
      f.box("detail", x - 40, x + 40, gy - 30, gy + 20);
      f.line("detail", [x, gy - 30], [x, gy - 50]);
      f.box("detail", x - 45, x + 45, top - GALLERY * 1000 - 90, top - GALLERY * 1000 - 40, "item-dark");
    }
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    const zb = d / 2 - 0.13;
    const yt = h - GALLERY;
    machineFeet(p, -w / 2, w / 2, -d / 2, zb);
    // The body: pressed side panels and a recessed front above the drip tray, the top with its
    // cup gallery (a rail round the cup warmer) and cups on it.
    p.roundedBox("steel", -w / 2, w / 2, FEET_M, yt, -d / 2, zb, PRESSED, "vertical");
    p.roundedBox("steel", -w / 2, w / 2, yt - 0.03, yt, -d / 2, zb + 0.02, PRESSED, "all", "x");
    p.roundedBox("satin", -w / 2 + 0.02, w / 2 - 0.02, yt, yt + 0.004, -d / 2 + 0.03, zb - 0.01, 0.004, "vertical");
    p.tube(
      "handle",
      [
        { x: -w / 2 + 0.03, y: yt + 0.004, z: zb - 0.02 },
        { x: -w / 2 + 0.03, y: h - 0.006, z: zb - 0.02 },
        { x: w / 2 - 0.03, y: h - 0.006, z: zb - 0.02 },
        { x: w / 2 - 0.03, y: yt + 0.004, z: zb - 0.02 },
      ],
      0.006,
      { bend: 0.02 },
    );
    const nc = Math.max(2, Math.floor((w - 0.1) / 0.09));
    for (let i = 0; i < nc; i++) cup(p, -w / 2 + 0.05 + ((w - 0.1) / nc) * (i + 0.5), yt + 0.004, -d / 2 + 0.12 + (i % 2) * 0.1, 0.035, 0.05);
    // The drip tray with its grid across the front.
    dripTray(p, -w / 2 + 0.02, w / 2 - 0.02, FEET_M, FEET_M + 0.03, zb - 0.02, d / 2);
    p.roundedBox("steelDark", -w / 2 + 0.02, w / 2 - 0.02, FEET_M + 0.03, FEET_M + TRAY, zb - 0.02, zb, 0.004, "top", "z");
    // Group heads: a turned head under the front with its portafilter (a basket and a black
    // grip reaching forward), the key pad above, a pressure gauge in the middle.
    const gy = FEET_M + TRAY + (yt - FEET_M - TRAY) * 0.45;
    for (const xm of groupXs(item.width)) {
      const x = xm / 1000;
      const gz = zb + 0.05;
      p.roundedBox("steel", x - 0.06, x + 0.06, gy + 0.02, yt - 0.03, zb - 0.01, gz + 0.02, 0.01, "vertical");
      p.lathe("satin", x, gy, gz, [
        [0, 0],
        [0.045, 0],
        [0.05, 0.01],
        [0.05, 0.03],
        [0.04, 0.04],
        [0, 0.04],
      ]);
      p.lathe("satin", x, gy - 0.035, gz, [
        [0, 0],
        [0.03, 0],
        [0.038, 0.015],
        [0.042, 0.035],
        [0, 0.035],
      ]);
      p.tube(
        "knob",
        [
          { x, y: gy - 0.02, z: gz + 0.04 },
          { x, y: gy - 0.035, z: d / 2 - 0.012 },
        ],
        0.012,
      );
      // Two spouts under the portafilter, and a cup standing on the tray under them.
      for (const dx of [-0.015, 0.015]) p.rod("satin", "y", x + dx, gy - 0.045, gz, 0.02, 0.004);
      p.lathe("panel", x, FEET_M + 0.03, gz, [
        [0, 0],
        [0.025, 0],
        [0.032, 0.05],
        [0.028, 0.05],
        [0.02, 0.006],
        [0, 0.006],
      ]);
      p.plate("panelDark", x - 0.05, x + 0.05, yt - 0.1, yt - 0.04, gz + 0.02, gz + 0.022, 0.006);
      for (let k = 0; k < 4; k++) p.roundedBox("satin", x - 0.04 + k * 0.027 - 0.008, x - 0.04 + k * 0.027 + 0.008, yt - 0.075, yt - 0.06, gz + 0.022, gz + 0.026, 0.003, "top", "z");
    }
    // Steam wands at both ends and the hot water outlet at the right, each with its turned knob.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.06);
      p.lathe("knob", x, yt - 0.06, zb, [[0, 0], [0.018, 0], [0.018, 0.02], [0.014, 0.028], [0, 0.028]], { axis: "z" });
      p.tube(
        "satin",
        [
          { x, y: gy + 0.02, z: zb },
          { x, y: gy + 0.02, z: zb + 0.05 },
          { x: x - sx * 0.02, y: FEET_M + TRAY + 0.03, z: zb + 0.08 },
        ],
        0.005,
        { bend: 0.03 },
      );
    }
    // Pressure gauges in the middle of the front.
    const gs = groupXs(item.width).map((x) => x / 1000);
    const gx = gs.length === 2 ? 0 : gs.length === 1 ? (gs[0] + w / 2 - 0.06) / 2 : (gs[0] + gs[1]) / 2;
    p.lathe("satin", gx, yt - 0.065, zb, [[0, 0], [0.03, 0], [0.03, 0.01], [0.027, 0.012], [0, 0.012]], { axis: "z" });
    p.plate("panel", gx - 0.024, gx + 0.024, yt - 0.089, yt - 0.041, zb + 0.008, zb + 0.0115, 0.024);
    rocker(p, -w / 2 + 0.06, FEET_M + TRAY + 0.04, zb, zb + 0.008);
  },
};

// ---------------------------------------------------------------------------------------------
// Coffee grinder

export const coffeeGrinder: KindDef = {
  kind: "coffeeGrinder",
  placement: "tableTop",
  plan(s) {
    const r = Math.min(s.w / 2, s.d / 3) - INSET / 4;
    s.circle("detail", 0, -s.d / 6, r);
    s.circle("detail", 0, -s.d / 6, r * 0.4);
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const cx = (l + r) / 2;
    const hb = z0 + f.item.height * 0.55;
    f.line("detail", [l, hb], [r, hb]);
    f.line("detail", [cx - (r - l) * 0.45, hb], [cx - (r - l) * 0.3, top], [cx + (r - l) * 0.3, top], [cx + (r - l) * 0.45, hb]);
    f.box("detail", cx - 30, cx + 30, z0 + f.item.height * 0.25, z0 + f.item.height * 0.4, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const hb = h * 0.55;
    // Body: a pressed column on a foot plate, the display and the dosing spout with its fork.
    p.roundedBox("paintGray", -w / 2, w / 2, 0, 0.03, -d / 2, d / 2, 0.01);
    p.roundedBox("panelDark", -w / 2 + 0.01, w / 2 - 0.01, 0.03, hb, -d / 2 + 0.01, d / 2 - 0.08, PRESSED * 2, "vertical");
    p.plate("glassDark", -0.035, 0.035, hb - 0.08, hb - 0.03, d / 2 - 0.08, d / 2 - 0.078, 0.004);
    p.roundedBox("satin", -0.03, 0.03, hb * 0.48, hb * 0.6, d / 2 - 0.08, d / 2 - 0.03, 0.01, "top", "z");
    for (const sx of [-1, 1]) p.roundedBox("panelDark", sx * 0.04 - 0.006, sx * 0.04 + 0.006, hb * 0.3, hb * 0.34, d / 2 - 0.08, d / 2, 0.003, "top", "z");
    p.roundedBox("steelDark", -0.06, 0.06, 0.03, 0.036, d / 2 - 0.08, d / 2 - 0.02, 0.004, "vertical");
    // The bean hopper: a clear cone with the beans in it and a black lid.
    const r0 = Math.min(w / 2 - 0.01, d / 3) * 0.7;
    const r1 = Math.min(w / 2, d / 3);
    const zc = -d / 6 + 0.01;
    const hh = h - hb - 0.03;
    p.lathe("satin", 0, hb, zc, [[0, 0], [r0 * 0.8, 0], [r0 * 0.8, 0.02], [0, 0.02]]);
    p.lathe("glass", 0, hb + 0.02, zc, [
      [0, 0],
      [r0 * 0.6, 0],
      [r1, hh - 0.01],
      [r1 * 0.96, hh - 0.01],
      [r0 * 0.56, 0.004],
      [0, 0.004],
    ]);
    p.lathe("foodBrown", 0, hb + 0.024, zc, [
      [0, 0],
      [r0 * 0.56, 0],
      [r1 * 0.85, hh * 0.6],
      [r1 * 0.4, hh * 0.66],
      [0, hh * 0.66],
    ]);
    p.lathe("knob", 0, h - 0.012, zc, [
      [0, 0],
      [r1 * 1.0, 0],
      [r1 * 0.98, 0.006],
      [r1 * 0.3, 0.01],
      [0, 0.012],
    ]);
  },
};

// ---------------------------------------------------------------------------------------------
// Filter coffee brewer

/** Height of the brewer's base with its warming plates (m) and of the head (share of the height). */
const BREW_BASE = 0.06;
const HEAD = 0.28;

export const filterCoffee: KindDef = {
  kind: "filterCoffee",
  placement: "tableTop",
  plan(s) {
    for (const x of [-s.w / 4, s.w / 4]) s.circle("detail", x, s.d / 6, Math.min(s.w / 4, s.d / 3) - INSET / 2);
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.B + s.d * 0.3);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const hh = f.item.height * HEAD;
    f.line("detail", [l, z0 + BREW_BASE * 1000], [r, z0 + BREW_BASE * 1000]);
    f.line("detail", [l, top - hh], [r, top - hh]);
    for (const k of [0.25, 0.75]) {
      const x = l + (r - l) * k;
      f.box("detail", x - 60, x + 60, z0 + BREW_BASE * 1000, z0 + BREW_BASE * 1000 + 170, "glass");
    }
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const hh = h * HEAD;
    // The base with two warming plates and their switches, the column at the back, the head with
    // the filter basket's handle at the front.
    p.roundedBox("steel", -w / 2, w / 2, 0, BREW_BASE, -d / 2, d / 2 - 0.01, PRESSED);
    p.roundedBox("steel", -w / 2, w / 2, BREW_BASE - 0.002, h - hh, -d / 2, -d / 2 + d * 0.3, PRESSED, "vertical");
    p.roundedBox("steel", -w / 2, w / 2, h - hh, h, -d / 2, d / 2 - 0.03, PRESSED);
    for (const sx of [-1, 1]) {
      const x = (sx * w) / 4;
      rocker(p, x, BREW_BASE / 2, d / 2 - 0.01, d / 2);
      const zc = d / 6;
      const rr = Math.min(w / 4, d / 3) - 0.03;
      p.lathe("plate", x, BREW_BASE, zc, [[0, 0], [rr, 0], [rr, 0.004], [0, 0.004]]);
      // The jug: glass with the coffee in it, a black collar and handle.
      p.lathe("glass", x, BREW_BASE + 0.004, zc, [
        [0, 0],
        [rr * 0.85, 0],
        [rr * 0.95, 0.08],
        [rr * 0.7, 0.15],
        [rr * 0.62, 0.17],
        [rr * 0.58, 0.17],
        [rr * 0.66, 0.15],
        [rr * 0.9, 0.08],
        [rr * 0.8, 0.004],
        [0, 0.004],
      ]);
      p.lathe("foodBrown", x, BREW_BASE + 0.008, zc, [[0, 0], [rr * 0.82, 0], [rr * 0.9, 0.07], [0, 0.07]]);
      p.lathe("knob", x, BREW_BASE + 0.15, zc, [[rr * 0.6, 0], [rr * 0.72, 0], [rr * 0.68, 0.03], [rr * 0.6, 0.03], [rr * 0.6, 0]]);
      p.tube(
        "knob",
        [
          { x: x + rr * 0.68, y: BREW_BASE + 0.16, z: zc },
          { x: x + rr * 1.05, y: BREW_BASE + 0.15, z: zc },
          { x: x + rr * 1.05, y: BREW_BASE + 0.07, z: zc },
          { x: x + rr * 0.92, y: BREW_BASE + 0.06, z: zc },
        ],
        0.008,
        { bend: 0.02 },
      );
    }
    // The filter basket in the head with its black handle, the keys and display.
    p.roundedBox("knob", -0.06, 0.06, h - hh - 0.05, h - hh + 0.01, d / 6 - 0.07, d / 6 + 0.07, 0.02, "vertical");
    p.roundedBox("knob", -0.012, 0.012, h - hh - 0.03, h - hh, d / 6 + 0.07, d / 2 - 0.035, 0.008, "all", "z");
    p.plate("glassDark", -w / 2 + 0.04, -w / 2 + 0.14, h - hh / 2 - 0.02, h - hh / 2 + 0.02, d / 2 - 0.03, d / 2 - 0.028, 0.004);
    pilotLamp(p, w / 2 - 0.05, h - hh / 2, d / 2 - 0.03, "oil", 0.005);
    // A plate on top keeps a third jug warm.
    p.lathe("plate", 0, h - 0.004, -d / 6, [[0, 0], [0.06, 0], [0.06, 0.004], [0, 0.004]]);
  },
};

// ---------------------------------------------------------------------------------------------
// Hot water dispenser and milk cooler

export const hotWaterDispenser: KindDef = {
  kind: "hotWaterDispenser",
  placement: "tableTop",
  plan(s) {
    s.rect("detail", s.L + INSET / 2, s.F - 120, s.R - INSET / 2, s.F - INSET / 4);
    s.circle("detail", 0, s.F - 80, 20);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const cx = (l + r) / 2;
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, z0, z0 + 25);
    f.box("detail", cx - 40, cx + 40, top - 140, top - 80, "item-dark");
    f.line("detail", [cx, z0 + f.item.height * 0.45], [cx, z0 + f.item.height * 0.35]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const zb = d / 2 - 0.12;
    machineFeet(p, -w / 2, w / 2, -d / 2, zb);
    p.roundedBox("steel", -w / 2, w / 2, FEET_M, h, -d / 2, zb, PRESSED * 2, "vertical");
    p.roundedBox("steel", -w / 2, w / 2, h * 0.5, h, zb - 0.01, zb + 0.06, PRESSED * 2, "all", "x");
    dripTray(p, -w / 2 + 0.02, w / 2 - 0.02, FEET_M, FEET_M + 0.025, zb, d / 2);
    // The outlet under the head, its button and the temperature display.
    p.lathe("satin", 0, h * 0.5 - 0.04, zb + 0.035, [[0, 0], [0.008, 0], [0.012, 0.04], [0, 0.04]]);
    p.plate("glassDark", -0.04, 0.04, h - 0.14, h - 0.08, zb + 0.06, zb + 0.062, 0.006);
    p.roundedBox("signalRed", -0.02, 0.02, h - 0.06, h - 0.035, zb + 0.06, zb + 0.066, 0.005, "top", "z");
    for (let k = 0; k < 3; k++) p.plate("slot", -w / 2 + 0.04, w / 2 - 0.04, h * 0.2 + k * 0.03, h * 0.2 + k * 0.03 + 0.008, zb - 0.0005, zb + 0.0005, 0.004);
  },
};

export const milkCooler: KindDef = {
  kind: "milkCooler",
  placement: "tableTop",
  plan(s) {
    s.line("detail", [s.L + INSET / 2, s.F - INSET / 2], [s.R - INSET / 2, s.F - INSET / 2]);
    s.quarter("hidden", s.L, s.F, s.w, 0);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, z0 + 40, top - 70, "glass");
    f.box("detail", (l + r) / 2 - 30, (l + r) / 2 + 30, top - 55, top - 25, "item-dark");
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const zb = d / 2 - 0.025;
    machineFeet(p, -w / 2, w / 2, -d / 2, zb);
    p.roundedBox("paintGray", -w / 2, w / 2, FEET_M, h, -d / 2, zb, PRESSED * 2, "vertical");
    p.box("panel", -w / 2 + 0.02, w / 2 - 0.02, FEET_M + 0.03, h - 0.08, zb - 0.002, zb);
    // The milk container inside, seen through the glass door, with its hose to the machine.
    p.roundedBox("panel", -w / 2 + 0.05, w / 2 - 0.05, FEET_M + 0.04, h - 0.12, -d / 2 + 0.06, zb - 0.03, 0.02, "vertical");
    p.tube(
      "glass",
      [
        { x: 0, y: h - 0.12, z: -d / 4 },
        { x: 0, y: h + 0.0, z: -d / 4 },
      ],
      0.006,
      { caps: false },
    );
    // The glass door in its frame, the display above it.
    const fw = 0.02;
    p.lathe(
      "satin",
      0,
      (FEET_M + 0.02 + h - 0.07) / 2,
      zb,
      [
        [0, 0],
        [fw, 0],
        [fw, 0.012],
        [0, 0.012],
        [0, 0],
      ],
      { axis: "z", rect: [w / 2 - 0.01 - fw, (h - 0.07 - FEET_M - 0.02) / 2 - fw] },
    );
    p.box("glass", -w / 2 + 0.01 + fw, w / 2 - 0.01 - fw, FEET_M + 0.02 + fw, h - 0.07 - fw, zb + 0.004, zb + 0.004 + GLASS);
    p.roundedBox("handle", w / 2 - 0.03, w / 2 - 0.018, h * 0.4, h * 0.6, zb + 0.012, d / 2, 0.005, "top", "z");
    p.plate("glassDark", -0.03, 0.03, h - 0.055, h - 0.025, zb, zb + 0.002, 0.004);
  },
};

// ---------------------------------------------------------------------------------------------
// Cup warmer

/** Heated shelves of the cup warmer. */
const CUP_SHELVES = 3;

export const cupWarmer: KindDef = {
  kind: "cupWarmer",
  placement: "tableTop",
  plan(s) {
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
    for (let i = 1; i < 3; i++) s.circle("detail", s.L + (s.w * i) / 3, 0, 35);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    for (let k = 1; k <= CUP_SHELVES; k++) {
      const z = z0 + ((top - z0) * k) / (CUP_SHELVES + 1);
      f.line("detail", [l, z], [r, z]);
    }
    f.box("detail", l, r, z0, z0 + 60);
    f.circle("detail", r - 40, z0 + 30, 12);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    // A base with its switch, side walls and back, and heated drawers as shelves with cups on
    // them upside down.
    const t = 0.012;
    p.roundedBox("steel", -w / 2, w / 2, 0, 0.06, -d / 2, d / 2 - 0.012, PRESSED);
    rocker(p, w / 2 - 0.05, 0.03, d / 2 - 0.012, d / 2);
    pilotLamp(p, w / 2 - 0.09, 0.03, d / 2 - 0.012);
    for (const x of [-w / 2, w / 2 - t]) p.roundedBox("steel", x, x + t, 0.06, h - 0.02, -d / 2, d / 2 - 0.012, 0.004);
    p.box("steelDark", -w / 2 + t, w / 2 - t, 0.06, h - 0.02, -d / 2, -d / 2 + t);
    p.roundedBox("steel", -w / 2, w / 2, h - 0.02, h, -d / 2, d / 2 - 0.012, PRESSED / 2);
    const levels = [0.06, ...Array.from({ length: CUP_SHELVES - 1 }, (_, k) => 0.06 + ((h - 0.08) * (k + 1)) / CUP_SHELVES), h];
    for (let k = 0; k < levels.length - 1; k++) {
      const y = levels[k];
      if (k > 0) {
        // A heated shelf with its grip at the front.
        p.roundedBox("satin", -w / 2 + t, w / 2 - t, y - 0.01, y, -d / 2 + t, d / 2 - 0.02, 0.003);
        p.roundedBox("knob", -0.04, 0.04, y - 0.009, y - 0.001, d / 2 - 0.02, d / 2 - 0.008, 0.004, "top", "z");
      }
      if (levels[k + 1] - 0.01 - y < 0.07) continue;
      const n = Math.max(1, Math.floor((w - 0.06) / 0.09));
      for (let i = 0; i < n; i++) for (const z of [-d / 4, d / 8]) cup(p, -w / 2 + 0.03 + ((w - 0.06) / n) * (i + 0.5), y, z, 0.035, 0.06);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Knock box module

/** The knock box's round opening in the top: its radius and centre from the front (mm). */
const KNOCK_R = 75;
const KNOCK_Y = 180;

export const knockBoxModule: KindDef = {
  kind: "knockBoxModule",
  plan(s) {
    const y = s.F - KNOCK_Y;
    s.circle("detail", 0, y, KNOCK_R);
    s.line("detail", [-KNOCK_R, y], [KNOCK_R, y]);
    s.line("detail", [s.L + INSET, s.F - INSET / 2], [s.R - INSET, s.F - INSET / 2]);
  },
  elevation(f) {
    const { top, z0 } = f;
    f.worktop();
    f.drawers(1, top - FRONT_TOP - 200, top - FRONT_TOP - FRONT_INSET / 4);
    f.doors(doorCount(f.w), z0 + FEET, top - FRONT_TOP - 200 - FRONT_INSET);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const zBody = d / 2 - DOOR;
    const r = KNOCK_R / 1000;
    const zc = d / 2 - KNOCK_Y / 1000;
    const hole: Hole = { x0: -r, x1: r, z0: zc - r, z1: zc + r, r };
    counterBody(p, s, [hole], "steel", zBody);
    // The knock box under the opening: a dark bin with grounds in it, the rubber knock bar
    // across the opening and the rubber ring round its edge.
    p.tub("knob", -r, r, h - 0.2, h - 0.001, zc - r, zc + r, 0.004, r);
    p.lathe("foodBrown", 0, h - 0.2, zc, [[0, 0], [r - 0.006, 0], [r - 0.006, 0.09], [r * 0.4, 0.1], [0, 0.1]]);
    p.ring("rubber", 0, zc, h - 0.004, r + 0.003, 0.004);
    p.rod("rubber", "x", 0, h - 0.012, zc, r * 2 - 0.004, 0.012);
    // The grounds drawer under the top with its handle, the doors below.
    const yd = h - TOP - 0.2;
    p.roundedBox("steel", -w / 2 + GAP, w / 2 - GAP, yd, h - TOP - GAP, zBody, d / 2 - DOOR / 2, DOOR_RADIUS, "top", "z");
    p.barHandle("x", -0.1, 0.1, h - TOP - 0.05, d / 2 - DOOR / 2, d / 2);
    leafDoors(p, -w / 2, w / 2, PLINTH, yd, zBody, d / 2 - DOOR / 2, d / 2, doorCount(w * 1000));
  },
};
