// Closed storage cabinets: the cutlery cabinet with drawers (Besteckschrank), the lockable
// cleaning agent cabinet (Reinigungsmittelschrank), staff lockers with a sloping roof (Spind)
// and the linen cabinet with a laundry flap (Wäscheschrank).

import { doorCount, FEET, INSET } from "../parts/elevation";
import { BODY_RADIUS, DOOR, DOOR_RADIUS, doors, GAP, plinth, PLINTH, TOP_RADIUS, worktop, type MaterialId, type Parts, type Point2 } from "../parts/mesh";
import { INSET as PLAN_INSET, type PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { hingeBarrel, hinges, labelPlate, lock, louvres } from "./cabinet";

/** Height of the top cover of tall cabinets (m). */
const COVER = 0.02;

/** A cabinet body on the plinth from `PLINTH` to `y1`, set back for the doors, in `mat`. */
function carcass(p: Parts, w: number, d: number, y1: number, mat: MaterialId = "steel") {
  plinth(p, w, d);
  p.roundedBox(mat, -w / 2, w / 2, PLINTH, y1, -d / 2, d / 2 - DOOR, BODY_RADIUS, "vertical");
}

/** Plan: closed doors at the front with their swings, `n` leaves, hinged as `doors` hangs them. */
function planDoors(s: PlanSketch, n: number) {
  const leaf = s.w / n;
  s.line("detail", [s.L, s.F - PLAN_INSET / 2], [s.R, s.F - PLAN_INSET / 2]);
  for (let i = 0; i < n; i++) {
    const left = n === 1 || i % 2 === 0;
    if (left) s.quarter("hidden", s.L + i * leaf, s.F, leaf, 0);
    else s.quarter("hidden", s.L + (i + 1) * leaf, s.F, leaf, 90);
  }
}

// ---------------------------------------------------------------------------------------------
// Cutlery cabinet

/** Drawers per column of the cutlery cabinet, and the width of one column (m). */
const DRAWERS = 6;
const DRAWER_COL = 0.6;

function drawerCols(w: number): number {
  return Math.max(1, Math.round(w / DRAWER_COL));
}

export const cutleryCabinet: KindDef = {
  kind: "cutleryCabinet",
  plan(s) {
    s.line("detail", [s.L, s.F - PLAN_INSET / 2], [s.R, s.F - PLAN_INSET / 2]);
    for (let c = 1; c < drawerCols(s.w / 1000); c++) {
      const x = s.L + (s.w * c) / drawerCols(s.w / 1000);
      s.line("detail", [x, s.F - PLAN_INSET / 2], [x, s.F]);
    }
  },
  elevation(f) {
    f.worktop();
    const n = drawerCols(f.w / 1000);
    const cw = f.w / n;
    const z0 = f.z0 + FEET;
    const z1 = f.top - 40 - INSET / 2;
    const dh = (z1 - z0) / DRAWERS;
    for (let c = 0; c < n; c++) {
      const a = f.l + c * cw + INSET / 2;
      const b = a + cw - INSET;
      for (let i = 0; i < DRAWERS; i++) {
        const zb = z0 + i * dh + 4;
        f.box("detail", a, b, zb, zb + dh - 8);
        const m = (a + b) / 2;
        f.line("detail", [m - 80, zb + dh - 35], [m + 80, zb + dh - 35]);
      }
    }
  },
  mesh(p, s) {
    const top = s.h - 0.04;
    carcass(p, s.w, s.d, top);
    worktop(p, "steel", -s.w / 2, s.w / 2, top, s.h, -s.d / 2, s.d / 2);
    const n = drawerCols(s.w);
    const cw = s.w / n;
    const dh = (top - PLINTH) / DRAWERS;
    const zf = s.d / 2;
    for (let c = 0; c < n; c++) {
      const a = -s.w / 2 + c * cw + GAP;
      const b = a + cw - 2 * GAP;
      for (let i = 0; i < DRAWERS; i++) {
        const y0 = PLINTH + i * dh + GAP;
        const y1 = y0 + dh - 2 * GAP;
        p.roundedBox("steel", a, b, y0, y1, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
        const cx = (a + b) / 2;
        const len = Math.min(0.3, (b - a) * 0.55);
        p.barHandle("x", cx - len / 2, cx + len / 2, y1 - 0.03, zf - DOOR / 2, zf);
        // A label holder under the handle for the cutlery in the drawer.
        labelPlate(p, cx, y1 - 0.065, 0.07, 0.025, zf - DOOR / 2, "satin");
      }
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Cleaning agent cabinet

/** Size of the hazard label on the door (m, the side of the turned square). */
const HAZARD = 0.07;

export const cleaningCabinet: KindDef = {
  kind: "cleaningCabinet",
  plan(s) {
    planDoors(s, doorCount(s.w));
  },
  elevation(f) {
    const n = doorCount(f.w);
    f.doors(n, f.z0 + FEET, f.top - INSET / 2);
    const dw = (f.w - INSET * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const a = f.l + INSET + i * (dw + INSET);
      const m = a + dw / 2;
      const zt = f.top - 250;
      // The hazard label: a turned square.
      f.line("detail", [m, zt + 50], [m + 50, zt], [m, zt - 50], [m - 50, zt], [m, zt + 50]);
      for (const z of [f.top - INSET * 2.5, f.z0 + FEET + INSET * 1.5]) f.line("detail", [a + dw * 0.25, z], [a + dw * 0.75, z]);
    }
  },
  mesh(p, s) {
    const y1 = s.h - COVER;
    carcass(p, s.w, s.d, y1, "panel");
    p.roundedBox("panel", -s.w / 2, s.w / 2, y1, s.h, -s.d / 2, s.d / 2 - DOOR / 2 - 0.001, TOP_RADIUS);
    const n = Math.max(1, Math.round(s.w / 0.6));
    doorLeaves(p, -s.w / 2, s.w / 2, PLINTH, y1, s.d, n, "panel");
    hinges(p, -s.w / 2, s.w / 2, PLINTH, y1, s.d / 2 - DOOR, n);
    const zFace = s.d / 2 - DOOR / 2;
    const dw = s.w / n;
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + i * dw;
      const cx = x0 + dw / 2;
      louvres(p, cx - dw * 0.25, cx + dw * 0.25, y1 - 0.12, y1 - 0.04, zFace);
      louvres(p, cx - dw * 0.25, cx + dw * 0.25, PLINTH + 0.04, PLINTH + 0.12, zFace);
      // The hazard label: a red square turned on its corner with a white one inside.
      const yl = y1 - 0.25;
      for (const [mat, k, dz] of [
        ["signalRed", 1, 0],
        ["panel", 0.78, 0.0006],
      ] as const) {
        const side = (HAZARD * k) / (2 * Math.SQRT2);
        // Turned about its own thin axis, which lies along z.
        p.plate(mat, cx - side, cx + side, yl - side, yl + side, zFace - 0.0005 + dz, zFace + 0.0012 + dz, 0.002).rotation.y = Math.PI / 4;
      }
      // The lock above the handle at the free edge.
      const left = n === 1 || i % 2 === 0;
      lock(p, left ? x0 + dw - 0.045 : x0 + 0.045, (PLINTH + y1) / 2 + 0.25, zFace);
    }
  },
};

/** Door leaves with vertical bar handles at the free edges, in `mat` (as `doors`, painted). */
function doorLeaves(p: Parts, x0: number, x1: number, y0: number, y1: number, d: number, n: number, mat: MaterialId) {
  if (mat === "steel") {
    doors(p, x0, x1, y0, y1, d, n, "vertical");
    return;
  }
  const zf = d / 2;
  const dw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * dw + GAP;
    const b = x0 + (i + 1) * dw - GAP;
    p.roundedBox(mat, a, b, y0 + GAP, y1 - GAP, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
    const left = n === 1 || i % 2 === 0;
    const hx = left ? b - 0.03 : a + 0.03;
    const mid = (y0 + y1) / 2;
    p.barHandle("y", mid - 0.15, mid + 0.15, hx, zf - DOOR / 2, zf);
  }
}

// ---------------------------------------------------------------------------------------------
// Lockers

/** Width of one locker compartment, the height of the stand and of the sloping roof (m). */
const COMPARTMENT = 0.3;
const STAND = 0.1;
const ROOF = 0.15;

function compartments(w: number): number {
  return Math.max(1, Math.round(w / COMPARTMENT));
}

export const locker: KindDef = {
  kind: "locker",
  plan(s) {
    const n = compartments(s.w / 1000);
    const leaf = s.w / n;
    s.line("detail", [s.L, s.F - PLAN_INSET / 2], [s.R, s.F - PLAN_INSET / 2]);
    for (let i = 0; i < n; i++) s.quarter("hidden", s.L + i * leaf, s.F, leaf, 0);
  },
  elevation(f) {
    const n = compartments(f.w / 1000);
    const cw = f.w / n;
    const z0 = f.z0 + STAND * 1000;
    const z1 = f.top - ROOF * 1000;
    // The front edge of the sloping roof.
    f.line("detail", [f.l, z1], [f.r, z1]);
    f.line("detail", [f.l, z0], [f.r, z0]);
    for (let i = 0; i < n; i++) {
      const a = f.l + i * cw + 6;
      const b = a + cw - 12;
      f.box("detail", a, b, z0 + 6, z1 - 6);
      for (const z of [z1 - 80, z0 + 80]) f.line("detail", [a + cw * 0.25, z], [b - cw * 0.25, z]);
      f.circle("detail", b - 40, (z0 + z1) / 2 + 100, 11);
      f.box("detail", (a + b) / 2 - 30, (a + b) / 2 + 30, z1 - 160, z1 - 130);
    }
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const zb = s.d / 2 - 0.022;
    const y1 = s.h - ROOF;
    // The stand: a recessed plinth on feet; the body and the roof sloping to the front, so
    // nothing is put on top.
    p.roundedBox("paintGray", -W + 0.02, W - 0.02, 0.012, STAND, B + 0.02, zb - 0.04, BODY_RADIUS, "vertical");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.lathe("rubber", sx * (W - 0.03), 0, sz > 0 ? zb - 0.05 : B + 0.03, [[0, 0], [0.018, 0], [0.018, 0.012], [0, 0.012]]);
    p.roundedBox("paintGray", -W, W, STAND, y1, B, zb, BODY_RADIUS, "vertical");
    const roof: Point2[] = [
      [B, y1 - 0.001],
      [s.d / 2, y1 - 0.001],
      [s.d / 2, y1 + 0.01],
      [B, s.h],
    ];
    p.extrude("paintGray", "x", -W, W, roof);
    const n = compartments(s.w);
    const cw = s.w / n;
    // The leaf's face, with room in front for the lock.
    const zLeaf = s.d / 2 - 0.006;
    for (let i = 0; i < n; i++) {
      const a = -W + i * cw + GAP;
      const b = a + cw - 2 * GAP;
      const cx = (a + b) / 2;
      p.roundedBox("paintGray", a, b, STAND + GAP, y1 - GAP, zb, zLeaf, DOOR_RADIUS, "top", "z");
      louvres(p, a + cw * 0.25, b - cw * 0.25, y1 - 0.12, y1 - 0.04, zLeaf);
      louvres(p, a + cw * 0.25, b - cw * 0.25, STAND + 0.04, STAND + 0.12, zLeaf);
      // Number plate, the lock with a recessed grip beside it, the hinges at the left.
      labelPlate(p, cx, y1 - 0.145, 0.06, 0.03, zLeaf);
      const yl = (STAND + y1) / 2 + 0.1;
      lock(p, b - 0.04, yl, zLeaf, 0.012);
      p.plate("slot", b - 0.05, b - 0.03, yl - 0.08, yl - 0.03, zLeaf - 0.001, zLeaf + 0.0006, 0.008);
      for (const y of [STAND + 0.15, y1 - 0.2]) hingeBarrel(p, a + 0.004, y, zLeaf - 0.004);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Linen cabinet

/** Share of the height (above the plinth) taken by the laundry flap at the bottom. */
const FLAP = 0.32;

export const linenCabinet: KindDef = {
  kind: "linenCabinet",
  plan(s) {
    planDoors(s, 2);
  },
  elevation(f) {
    const z0 = f.z0 + FEET;
    const zf = z0 + (f.top - INSET / 2 - z0) * FLAP;
    f.doors(2, zf + INSET / 2, f.top - INSET / 2);
    f.box("detail", f.l + INSET, f.r - INSET, z0, zf - INSET / 2);
    const c = (f.l + f.r) / 2;
    f.line("detail", [c - 150, zf - INSET * 2], [c + 150, zf - INSET * 2]);
  },
  mesh(p, s) {
    const y1 = s.h - COVER;
    carcass(p, s.w, s.d, y1);
    p.roundedBox("steel", -s.w / 2, s.w / 2, y1, s.h, -s.d / 2, s.d / 2 - DOOR / 2 - 0.001, TOP_RADIUS);
    const yf = PLINTH + (y1 - PLINTH) * FLAP;
    doors(p, -s.w / 2, s.w / 2, yf, y1, s.d, 2, "vertical");
    hinges(p, -s.w / 2, s.w / 2, yf, y1, s.d / 2 - DOOR, 2);
    // The laundry flap tips out at the top into the bag behind it: a leaf with a bar at its top
    // edge and a slot showing the opening above it.
    const zf = s.d / 2;
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, PLINTH + GAP, yf - GAP, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
    const len = Math.min(0.4, s.w * 0.5);
    p.barHandle("x", -len / 2, len / 2, yf - 0.05, zf - DOOR / 2, zf);
    p.plate("slot", -s.w / 2 + 0.06, s.w / 2 - 0.06, yf - 0.018, yf - 0.008, zf - DOOR / 2 - 0.001, zf - DOOR / 2 + 0.0006, 0.004);
    labelPlate(p, 0, PLINTH + (yf - PLINTH) * 0.45, 0.1, 0.04, zf - DOOR / 2, "satin");
    // A lock above the handle of each door.
    const hl = Math.min(0.4, (y1 - yf) * 0.5);
    for (const sx of [-1, 1]) lock(p, sx * 0.034, (yf + y1) / 2 + hl / 2 + 0.05, zf - DOOR / 2);
  },
};
