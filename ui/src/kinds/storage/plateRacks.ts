// Racks for plates and pots: the plate stacking trolley (Tellerstapelwagen) with plate stacks
// between guide rods, the wall plate rack (Tellerregal) with plates standing in a wire rack, and
// the wall pot rack (Topfregal) with a wire shelf on top and pots hanging from a rail in front.

import type { Front } from "../parts/elevation";
import { BODY_RADIUS, castor, SHELF_PITCH, type Parts } from "../parts/mesh";
import type { KindDef } from "../types";
import { plateStack, pot, strut } from "./helpers";

// ---------------------------------------------------------------------------------------------
// Plate stacking trolley

/** Castor radius and the top of its plate (m). */
const WHEEL = 0.05;
const CASTOR_TOP = 0.13;
/** Height of the base frame and of the push handle's tube radius (m). */
const BASE = 0.05;
const HANDLE_R = 0.012;
/** Plates: radius (a 300 mm dinner plate), height of one in the stack (m). */
const PLATE_R = 0.15;
const PLATE_T = 0.022;
/** Guide rods round a stack (left, back, right: open to the front) and their radius (m). */
const RODS = [
  [-1, 0],
  [0, -1],
  [1, 0],
] as const;
const ROD_R = 0.006;

/** Centres of the plate stacks: two by two in the footprint (m). */
function stacks(w: number, d: number): [number, number][] {
  const qx = w / 4;
  const qz = d / 4;
  return [
    [-qx, -qz],
    [qx, -qz],
    [-qx, qz],
    [qx, qz],
  ];
}

export const plateTrolley: KindDef = {
  kind: "plateTrolley",
  plan(s) {
    const r = Math.min(PLATE_R * 1000, s.w / 4 - 10, s.d / 4 - 10);
    for (const [x, y] of stacks(s.w, s.d)) s.circle("detail", x, y, r);
  },
  elevation(f: Front) {
    const z = (y: number) => f.z0 + y * 1000;
    f.box("detail", f.l, f.r, z(CASTOR_TOP), z(CASTOR_TOP + BASE));
    const c = (f.l + f.r) / 2;
    const r = Math.min(PLATE_R * 1000, f.w / 4 - 10);
    for (const x of [c - f.w / 4, c + f.w / 4]) f.box("detail", x - r, x + r, z(CASTOR_TOP + BASE), f.top - 120);
    const wr = WHEEL * 1000;
    for (const x of [f.l + wr, f.r - wr]) f.circle("detail", x, z(WHEEL), wr);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(p, sx * (W - WHEEL - 0.01), sz * (D - WHEEL - 0.01), WHEEL, CASTOR_TOP);
    // The base: a pressed platform with a rubber bumper ring round it.
    p.roundedBox("steel", -W + 0.012, W - 0.012, CASTOR_TOP, CASTOR_TOP + BASE, -D + 0.012, D - 0.012, 0.006);
    p.lathe("rubber", 0, CASTOR_TOP + BASE * 0.2, 0, [
      [0, 0],
      [0.012, 0],
      [0.012, BASE * 0.6],
      [0, BASE * 0.6],
      [0, 0],
    ], { rect: [W - 0.012, D - 0.012] });
    const y0 = CASTOR_TOP + BASE;
    const top = s.h - HANDLE_R;
    const r = Math.min(PLATE_R, W / 2 - ROD_R * 3, D / 2 - ROD_R * 3);
    for (const [x, z] of stacks(s.w, s.d)) {
      // The stack and the guide rods round it, open towards the front for taking plates.
      // Stacks partly used, each to its own height.
      const full = Math.floor((top - 0.12 - y0) / PLATE_T);
      const n = Math.max(1, Math.round(full * (0.45 + 0.15 * ((x > 0 ? 1 : 0) + (z > 0 ? 2 : 0)))));
      // One rim per pair of plates: the stack still reads as plates, at half the triangles.
      plateStack(p, x, y0, z, r, Math.ceil(n / 2), PLATE_T * 2);
      for (const [dx, dz] of RODS) {
        p.rod("steel", "y", x + dx * (r + ROD_R * 1.5), (y0 + top - 0.06) / 2, z + dz * (r + ROD_R * 1.5), top - 0.06 - y0, ROD_R);
      }
    }
    // The push handle over the back: a bent tube from the base up and across.
    const hx = W - HANDLE_R - 0.02;
    const hz = -D + HANDLE_R + 0.02;
    p.tube("steel", [
      { x: -hx, y: y0, z: hz },
      { x: -hx, y: top, z: hz },
      { x: hx, y: top, z: hz },
      { x: hx, y: y0, z: hz },
    ], HANDLE_R, { bend: 0.05 });
  },
};

// ---------------------------------------------------------------------------------------------
// Wall plate rack

/** Pitch of the plates standing in the rack, and their radius (m). */
const RACK_PITCH = 0.05;
const RACK_PLATE = 0.13;

/** Positions of the plates along the width (m), centred. */
function rackPlates(w: number): number[] {
  const n = Math.max(1, Math.floor((w - 0.08) / RACK_PITCH));
  return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * RACK_PITCH);
}

/** One plate standing on its edge at x, its centre at (y, z), turned about the x axis. */
function standingPlate(p: Parts, x: number, y: number, z: number, r: number) {
  p.lathe("panel", x - 0.011, y, z, [
    [0, 0],
    [r * 0.62, 0],
    [r * 0.96, 0.009],
    [r, 0.016],
    [r * 0.93, 0.02],
    [r * 0.62, 0.008],
    [0, 0.008],
  ], { axis: "x" });
}

export const plateRackWall: KindDef = {
  kind: "plateRackWall",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L, s.B + 20], [s.R, s.B + 20]);
    for (const x of rackPlates(s.w / 1000)) s.line("overhead", [x * 1000, s.B + 40], [x * 1000, s.F - 20]);
  },
  elevation(f: Front) {
    const c = (f.l + f.r) / 2;
    const r = Math.min(RACK_PLATE * 1000, f.item.height / 2 - 30);
    const zc = f.z0 + 30 + r;
    for (const x of rackPlates(f.w / 1000)) f.line("detail", [c + x * 1000, zc - r * 0.95], [c + x * 1000, zc + r * 0.95]);
    f.box("detail", f.l, f.r, f.z0, f.z0 + 30);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const F = s.d / 2;
    const r = Math.min(RACK_PLATE, s.h / 2 - 0.03, (s.d - 0.06) / 2);
    // The wire rack: a grid as the floor, upright end frames and a front rail at half height.
    p.grid(-W, W, 0, 0.006, B, F, SHELF_PITCH, "x");
    for (const sx of [-1, 1]) {
      const x = sx * (W - 0.004);
      p.tube("wire", [
        { x, y: 0.004, z: B + 0.004 },
        { x, y: s.h - 0.004, z: B + 0.004 },
        { x, y: s.h - 0.004, z: B + 0.06 },
        { x, y: 0.004, z: F - 0.004 },
      ], 0.004, { bend: 0.02 });
    }
    p.rod("wire", "x", 0, s.h - 0.004, B + 0.004, s.w - 0.008, 0.004);
    p.rod("wire", "x", 0, r * 0.9, F - 0.006, s.w - 0.008, 0.004);
    // Wall plates holding the rack.
    for (const sx of [-1, 1]) p.roundedBox("steelDark", sx * (W - 0.012) - 0.01, sx * (W - 0.012) + 0.01, s.h * 0.55, s.h * 0.9, B, B + 0.004, BODY_RADIUS);
    for (const x of rackPlates(s.w)) {
      standingPlate(p, x, 0.006 + r, (B + F) / 2 + 0.01, r);
      // A divider wire between the plates.
      p.bar("wire", { x: x + RACK_PITCH / 2, y: 0.012, z: B + 0.03 }, { x: x + RACK_PITCH / 2, y: r * 0.8, z: B + 0.03 }, 0.002);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Wall pot rack

/** Depth of the wire shelf, the drop of the hook rail below it (m). */
const POT_SHELF = 0.03;
const HOOK_DROP = 0.06;
/** Length of a pot hook under the rail (m). */
const HOOK = 0.07;

/** Pots along the rail: their x and radius (m), centred. */
function hangingPots(w: number): { x: number; r: number }[] {
  const sizes = [0.12, 0.09, 0.14, 0.1, 0.11];
  const out: { x: number; r: number }[] = [];
  let x = -w / 2 + 0.06;
  for (let i = 0; ; i++) {
    const r = sizes[i % sizes.length];
    if (x + 2 * r > w / 2 - 0.06) break;
    out.push({ x: x + r, r });
    x += 2 * r + 0.04;
  }
  const shift = (w / 2 - 0.06 - x + 0.04) / 2;
  return out.map((p) => ({ x: p.x + shift, r: p.r }));
}

export const potRackWall: KindDef = {
  kind: "potRackWall",
  placement: "overhead",
  plan(s) {
    s.rect("overhead", s.L, s.B, s.R, s.B + 60);
    for (const { x, r } of hangingPots(s.w / 1000)) s.circle("overhead", x * 1000, s.F - Math.min(r * 1000, s.d / 2), Math.min(r * 1000, s.d / 2 - 1));
  },
  elevation(f: Front) {
    const c = (f.l + f.r) / 2;
    f.box("detail", f.l, f.r, f.top - POT_SHELF * 1000, f.top);
    const yr = f.top - (POT_SHELF + HOOK_DROP) * 1000;
    f.line("detail", [f.l, yr], [f.r, yr]);
    const pots = hangingPots(f.w / 1000);
    const rMax = Math.max(...pots.map((q) => q.r));
    const rim = yr - HOOK * 1000;
    for (const { x, r } of pots) {
      const hgt = ((rim - f.z0) * r) / rMax;
      f.box("detail", c + (x - r) * 1000, c + (x + r) * 1000, rim - hgt, rim);
      f.line("detail", [c + x * 1000, rim], [c + x * 1000, yr]);
    }
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const F = s.d / 2;
    const ys = s.h - 0.006;
    // The wire shelf on two wall brackets, the hook rail hanging from them in front.
    p.grid(-W, W, ys, s.h, B, F, SHELF_PITCH, "z");
    for (const sx of [-1, 1]) {
      const x = sx * (W - 0.03);
      p.roundedBox("steelDark", x - 0.004, x + 0.004, ys - 0.2, ys, B, B + 0.03, BODY_RADIUS);
      strut(p, "steelDark", [x, ys - 0.19, B + 0.03], [x, ys - 0.004, F - 0.04], 0.005);
    }
    const yr = ys - HOOK_DROP;
    const zr = F - Math.min(0.14, s.d / 2);
    p.rod("handle", "x", 0, yr, zr, s.w - 0.02, 0.008);
    for (const sx of [-1, 1]) p.rod("steel", "y", sx * (W - 0.03), (yr + ys) / 2, zr, ys - yr, 0.005);
    const pots = hangingPots(s.w);
    const rMax = Math.max(...pots.map((q) => q.r));
    const rim = yr - HOOK;
    for (const { x, r } of pots) {
      // The rim flares 3 % past the pot's radius; it stays inside the depth. The pots hang by
      // their rims a hook's length under the rail; the largest reaches the unit's lower edge.
      const pr = Math.min(r, (F - zr) / 1.04, (zr - B) / 1.04);
      const ph = (rim * r) / rMax;
      // An S hook and the pot hanging on it by a loop on its rim.
      p.tube("steelDark", [
        { x, y: yr + 0.012, z: zr - 0.01 },
        { x, y: yr + 0.012, z: zr + 0.01 },
        { x, y: rim + 0.01, z: zr - pr + 0.01 },
      ], 0.003, { bend: 0.006 });
      pot(p, x, rim - ph, zr, pr, ph);
    }
  },
};
