// Goods handling in stores and at the delivery door: the Euro pallet, stacked plastic crates
// (E2 meat crates) on the floor or on a crate dolly, and the sack truck.

import type { Front } from "../parts/elevation";
import { castor, TOP_RADIUS, type Parts } from "../parts/mesh";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";

// ---------------------------------------------------------------------------------------------
// Euro pallet

/** Board thickness, block height and board widths of a Euro pallet (m). */
const BOARD = 0.022;
const BLOCK = 0.078;
const WIDE = 0.145;
const NARROW = 0.1;
/** The pallet's own height (boards and blocks), the rest of the item's height above is free. */
const PALLET = 2 * BOARD + BLOCK + BOARD;

/** Centres of `n` boards of the given widths spread over `span` (m), centred. */
function spread(span: number, widths: readonly number[]): number[] {
  const gap = (span - widths.reduce((a, b) => a + b, 0)) / (widths.length - 1);
  const out: number[] = [];
  let at = -span / 2;
  for (const w of widths) {
    out.push(at + w / 2);
    at += w + gap;
  }
  return out;
}

export const euroPallet: KindDef = {
  kind: "euroPallet",
  plan(s) {
    const tops = spread(s.d, [WIDE * 1000, NARROW * 1000, WIDE * 1000, NARROW * 1000, WIDE * 1000]);
    const ws = [WIDE, NARROW, WIDE, NARROW, WIDE];
    tops.forEach((y, i) => s.rect("detail", s.L, y - (ws[i] * 1000) / 2, s.R, y + (ws[i] * 1000) / 2));
  },
  elevation(f: Front) {
    const z = (y: number) => f.z0 + y * 1000;
    f.box("detail", f.l, f.r, z(0), z(BOARD));
    f.box("detail", f.l, f.r, z(BOARD + BLOCK), z(PALLET));
    const xs = spread(f.w, [WIDE * 1000, WIDE * 1000, WIDE * 1000]).map((x) => (f.l + f.r) / 2 + x);
    for (const x of xs) f.box("detail", x - (WIDE * 1000) / 2, x + (WIDE * 1000) / 2, z(BOARD), z(BOARD + BLOCK));
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    const h = (y: number) => (y / PALLET) * s.h;
    const xs = spread(s.w, [WIDE, WIDE, WIDE]);
    // Bottom boards along the width, blocks, stringer boards across, top boards along the width.
    spread(s.d, [NARROW, WIDE, NARROW]).forEach((z, i) => {
      const half = (i === 1 ? WIDE : NARROW) / 2;
      p.roundedBox("wood", -W, W, 0, h(BOARD), z - half, z + half, TOP_RADIUS);
    });
    const zs = spread(s.d, [NARROW, WIDE, NARROW]);
    for (const x of xs) {
      zs.forEach((z, i) => {
        const half = (i === 1 ? WIDE : NARROW) / 2;
        p.roundedBox("wood", x - WIDE / 2 + 0.002, x + WIDE / 2 - 0.002, h(BOARD), h(BOARD + BLOCK), z - half + 0.002, z + half - 0.002, TOP_RADIUS * 2, "vertical");
      });
      p.roundedBox("wood", x - WIDE / 2, x + WIDE / 2, h(BOARD + BLOCK), h(2 * BOARD + BLOCK), -D, D, TOP_RADIUS);
    }
    const ws = [WIDE, NARROW, WIDE, NARROW, WIDE];
    spread(s.d, ws).forEach((z, i) => p.roundedBox("wood", -W, W, h(2 * BOARD + BLOCK) + 0.0005, s.h, z - ws[i] / 2, z + ws[i] / 2, TOP_RADIUS));
  },
};

// ---------------------------------------------------------------------------------------------
// Stacked crates

/** Height of one E2 crate (m) and the wall, corner radius and stacking rim of the moulding. */
const CRATE_H = 0.2;
const CRATE_WALL = 0.008;
const CRATE_R = 0.03;
const CRATE_RIM = 0.006;
/** Crate dolly: castor radius, top of the castor plates, frame thickness (m). */
const DOLLY_WHEEL = 0.04;
const DOLLY_CASTOR = 0.1;
const DOLLY_FRAME = 0.05;

/** One crate filling the box: the moulded tub, a stacking rim round its top, handle holes at the ends. */
function crate(p: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const rim = CRATE_RIM;
  p.pan("panel", x0 + rim, x1 - rim, y0, y1 - 0.0005, z0 + rim, z1 - rim, { wall: CRATE_WALL, r: CRATE_R });
  // The band stands out of the tub's wall (radius `CRATE_R` round its centre rectangle).
  p.lathe("panel", (x0 + x1) / 2, y1 - 0.025, (z0 + z1) / 2, [
    [CRATE_R - 0.001, 0],
    [CRATE_R + rim, 0.004],
    [CRATE_R + rim, 0.025],
    [CRATE_R - 0.001, 0.025],
    [CRATE_R - 0.001, 0],
  ], { rect: [(x1 - x0) / 2 - rim - CRATE_R, (z1 - z0) / 2 - rim - CRATE_R] });
  // Handle holes in both ends: dark slots with round ends in the end walls.
  const hy = y1 - 0.05;
  for (const sx of [-1, 1]) {
    const x = sx > 0 ? x1 - rim : x0 + rim;
    p.roundedBox("slot", x - 0.0015, x + 0.0015, hy - 0.018, hy + 0.018, -0.06 + (z0 + z1) / 2, 0.06 + (z0 + z1) / 2, 0.017, "vertical", "x");
  }
}

/** A stack of crates from `y0` up to `y1` over the box, as many as fit at `CRATE_H` each. */
function crateStack(p: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const n = Math.max(1, Math.round((y1 - y0) / CRATE_H));
  const ch = (y1 - y0) / n;
  for (let i = 0; i < n; i++) crate(p, x0, x1, y0 + i * ch, y0 + (i + 1) * ch, z0, z1);
}

function crateFront(f: Front, base: number) {
  const n = Math.max(1, Math.round((f.item.height / 1000 - base) / CRATE_H));
  const z0 = f.z0 + base * 1000;
  const ch = (f.top - z0) / n;
  const c = (f.l + f.r) / 2;
  for (let i = 0; i < n; i++) {
    const zb = z0 + i * ch;
    f.line("detail", [f.l, zb + ch - 25], [f.r, zb + ch - 25]);
    f.box("detail", c - 60, c + 60, zb + ch - 68, zb + ch - 32);
  }
  if (base > 0) {
    f.line("detail", [f.l, z0], [f.r, z0]);
    const wr = DOLLY_WHEEL * 1000;
    for (const x of [f.l + wr + 10, f.r - wr - 10]) f.circle("detail", x, f.z0 + wr, wr);
  }
}

export const crates: KindDef = {
  kind: "crates",
  plan(s) {
    s.rect("detail", s.L + CRATE_RIM * 1000, s.B + CRATE_RIM * 1000, s.R - CRATE_RIM * 1000, s.F - CRATE_RIM * 1000);
  },
  elevation(f) {
    crateFront(f, 0);
  },
  elevationSide(f) {
    crateFront(f, 0);
  },
  mesh(p, s) {
    crateStack(p, -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, s.d / 2);
  },
};

export const crateDolly: KindDef = {
  kind: "crateDolly",
  plan(s) {
    s.rect("detail", s.L + CRATE_RIM * 1000, s.B + CRATE_RIM * 1000, s.R - CRATE_RIM * 1000, s.F - CRATE_RIM * 1000);
    const wr = DOLLY_WHEEL * 1000;
    for (const x of [s.L + wr + 10, s.R - wr - 10]) for (const y of [s.B + wr + 10, s.F - wr - 10]) s.circle("hidden", x, y, wr * 0.6);
  },
  elevation(f) {
    crateFront(f, DOLLY_CASTOR + DOLLY_FRAME);
  },
  elevationSide(f) {
    crateFront(f, DOLLY_CASTOR + DOLLY_FRAME);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(p, sx * (W - DOLLY_WHEEL - 0.01), sz * (D - DOLLY_WHEEL - 0.01), DOLLY_WHEEL, DOLLY_CASTOR);
    // The dolly: a moulded frame with a raised edge that keeps the bottom crate in place.
    const top = DOLLY_CASTOR + DOLLY_FRAME;
    p.roundedBox("knob", -W, W, DOLLY_CASTOR, top - 0.015, -D, D, 0.008);
    p.lathe("knob", 0, top - 0.015, 0, [
      [0, 0],
      [0.012, 0],
      [0.012, 0.015],
      [0, 0.015],
      [0, 0],
    ], { rect: [W - 0.012, D - 0.012] });
    crateStack(p, -W + 0.006, W - 0.006, top - 0.012, s.h, -D + 0.006, D - 0.006);
  },
};

// ---------------------------------------------------------------------------------------------
// Sack truck

/** Wheel radius and width; frame tube radius; toe plate depth and thickness (m). */
const TRUCK_WHEEL = 0.13;
const TRUCK_TYRE = 0.07;
const FRAME_R = 0.013;
const TOE = 0.25;
const TOE_T = 0.008;

export const sackTruck: KindDef = {
  kind: "sackTruck",
  plan(s) {
    // The toe plate at the front, the wheels at the back.
    const toe = Math.min(TOE * 1000, s.d * 0.5);
    s.rect("detail", -200, s.F - toe, 200, s.F);
    const t = TRUCK_TYRE * 1000;
    for (const sx of [-1, 1]) s.rect("detail", sx > 0 ? s.R - t : s.L, s.B, sx > 0 ? s.R : s.L + t, s.B + TRUCK_WHEEL * 2000);
    cross(s, "detail", false);
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const fx = Math.min(170, f.w / 2 - 80);
    for (const x of [c - fx, c + fx]) f.line("detail", [x, f.z0], [x, f.top - 40]);
    f.line("detail", [c - fx, f.top - 40], [c + fx, f.top - 40]);
    f.box("detail", c - 200, c + 200, f.z0, f.z0 + TOE_T * 1000);
    const t = TRUCK_TYRE * 1000;
    for (const x of [f.l, f.r - t]) f.box("detail", x, x + t, f.z0, f.z0 + TRUCK_WHEEL * 2000);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    const r = Math.min(TRUCK_WHEEL, s.d / 3);
    const zw = -D + r;
    const fz = zw + r * 0.6;
    const fx = Math.min(0.17, W - TRUCK_TYRE - 0.02);
    // The frame: two tubes up from the toe plate, bent back and up into the grips at the top.
    const zg = fz - 0.1;
    for (const sx of [-1, 1]) {
      p.tube("satin", [
        { x: sx * fx, y: TOE_T, z: fz },
        { x: sx * fx, y: s.h - 0.2, z: fz },
        { x: sx * fx, y: s.h - 0.12, z: zg },
        { x: sx * fx, y: s.h, z: zg },
      ], FRAME_R, { bend: 0.05 });
      p.lathe("knob", sx * fx, s.h - 0.1, zg, [[0, 0], [FRAME_R * 1.3, 0], [FRAME_R * 1.35, 0.05], [FRAME_R * 1.2, 0.098], [FRAME_R, 0.1], [0, 0.1]]);
    }
    // Cross bars, the toe plate, and the axle with its two wheels behind the frame.
    for (const y of [0.35, 0.65, 0.95].filter((v) => v < s.h - 0.2)) p.rod("satin", "x", 0, y, fz, 2 * fx, FRAME_R * 0.7);
    p.roundedBox("satin", -0.2, 0.2, 0, TOE_T, fz - FRAME_R, D, 0.002, "top");
    p.rod("steelDark", "x", 0, r, zw, s.w - 0.01, 0.01);
    for (const sx of [-1, 1]) {
      p.bar("satin", { x: sx * fx, y: r, z: zw }, { x: sx * fx, y: 0.3, z: fz }, FRAME_R * 0.7);
      const x0 = sx > 0 ? W - TRUCK_TYRE : -W;
      // The tyre as a ring, the rim and its hub cap inside it.
      p.lathe("rubber", x0, r, zw, [
        [r * 0.6, 0],
        [r * 0.92, TRUCK_TYRE * 0.04],
        [r, TRUCK_TYRE * 0.25],
        [r, TRUCK_TYRE * 0.75],
        [r * 0.92, TRUCK_TYRE * 0.96],
        [r * 0.6, TRUCK_TYRE],
        [r * 0.6, 0],
      ], { axis: "x" });
      p.lathe("satin", x0 + 0.008, r, zw, [[0, 0], [r * 0.62, 0], [r * 0.62, TRUCK_TYRE - 0.016], [0, TRUCK_TYRE - 0.016]], { axis: "x" });
      p.lathe("steelDark", x0 + 0.004, r, zw, [[0, 0], [r * 0.2, 0], [r * 0.2, TRUCK_TYRE - 0.008], [0, TRUCK_TYRE - 0.008]], { axis: "x" });
    }
  },
};
