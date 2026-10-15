// Hood-type dishwasher (Haubenspülmaschine, Durchschub): the wash tank at the height of the dish
// tables on an open stand with the detergent canister under it, the lifting hood over the rack
// with its handle bar standing out on arms, and the column at the back that carries the hood in
// its guides and the control panel. Racks slide through from the inlet table on one side to the
// outlet table on the other.

import { INSET as FRONT_INSET, LEG as LEG_MM } from "../parts/elevation";
import { CONTROLS, DOOR, GAP, LEG, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { rackRails } from "./common";

/** Height of the tank's top: the working height of the dish line (mm). */
const BASE = 850;
/** Height of the wash tank under its top (mm). */
const TANK = 330;
/** Depth of the column at the back that carries the hood (m), at most this share of the depth. */
const COLUMN = 0.15;
const COLUMN_SHARE = 0.2;
/** How far the hood's handle bar stands out in front of the hood (m). */
const HANDLE_REACH = 0.05;
/** Detergent canister under the tank (m): width, height, depth. */
const CANISTER = { w: 0.2, h: 0.3, d: 0.2 };
/** Size of a dish rack (mm). */
const RACK = 500;

/** Height of the tank's top in mm, shrunk on a low resized unit. */
const baseHeight = (h: number) => Math.min(BASE, h * 0.6);
/** Height of the tank in mm, at most half the base. */
const tankHeight = (h: number) => Math.min(TANK, baseHeight(h) / 2);

export const dishwasher: KindDef = {
  kind: "dishwasher",
  plan(s) {
    const col = Math.min(COLUMN * 1000, s.d * COLUMN_SHARE);
    // The hood over the tank, the column behind it and the rack inside (hidden by the hood).
    s.rect("detail", s.L + INSET / 2, s.B + col, s.R - INSET / 2, s.F - HANDLE_REACH * 1000);
    s.line("detail", [s.L, s.B + col], [s.R, s.B + col]);
    // The handle bar in front of the hood.
    s.line("detail", [s.L + s.w / 6, s.F - INSET / 4], [s.R - s.w / 6, s.F - INSET / 4]);
    const rack = Math.min(RACK, s.w - 2 * INSET, s.d - col - INSET);
    const cy = (s.B + col + s.F) / 2;
    s.rect("hidden", -rack / 2, cy - rack / 2, rack / 2, cy + rack / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const base = z0 + baseHeight(f.item.height);
    const tank = base - tankHeight(f.item.height);
    const c = (l + r) / 2;
    // The open stand: legs at the ends, the canister between them, the tank above.
    f.box("detail", l + I / 4, l + I / 4 + LEG_MM, z0, tank);
    f.box("detail", r - I / 4 - LEG_MM, r - I / 4, z0, tank);
    f.box("detail", c - CANISTER.w * 500, c + CANISTER.w * 500, z0, z0 + CANISTER.h * 1000);
    f.box("detail", l, r, tank, base);
    // The hood with its handle bar, the panel on the column above it.
    const panel = top - CONTROLS * 1000;
    f.box("detail", l + I / 4, r - I / 4, base, panel - I / 4);
    f.line("detail", [l + f.w / 6, base + I * 2.5], [r - f.w / 6, base + I * 2.5]);
    f.line("detail", [l + I / 4, panel - I * 1.5], [r - I / 4, panel - I * 1.5]);
    f.box("detail", c - I * 3, c + I * 3, panel + I / 2, top - I / 2);
  },
  mesh(p, s) {
    const tankTop = baseHeight(s.h * 1000) / 1000;
    const tank0 = tankTop - tankHeight(s.h * 1000) / 1000;
    const column = Math.min(COLUMN, s.d * COLUMN_SHARE);
    const zb = -s.d / 2;
    const zf = s.d / 2;
    // The open stand: four legs with feet, a cross rail at the back, the canister on the floor.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - LEG / 2 - GAP);
        const z = sz * (s.d / 2 - LEG / 2 - DOOR);
        p.box("steelDark", x - LEG / 2, x + LEG / 2, 0.012, tank0, z - LEG / 2, z + LEG / 2);
        p.cyl("rubber", x, z, 0, 0.012, LEG * 0.6);
      }
    }
    p.box("steelDark", -s.w / 2 + LEG, s.w / 2 - LEG, 0.15, 0.18, zb + DOOR, zb + DOOR + LEG);
    p.box("panel", -CANISTER.w / 2, CANISTER.w / 2, 0, CANISTER.h, -CANISTER.d / 2, CANISTER.d / 2);
    p.cyl("knob", 0, 0, CANISTER.h, CANISTER.h + 0.03, 0.03);
    // The tank with its service panel, the rack guides on its top under the hood.
    p.box("steel", -s.w / 2, s.w / 2, tank0, tankTop, zb, zf - DOOR);
    p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, tank0 + GAP, tankTop - GAP, zf - DOOR, zf - DOOR / 2);
    p.box("steelDark", -s.w / 2, s.w / 2, tankTop - 0.006, tankTop, zf - DOOR / 2, zf - DOOR / 2 + 0.002);
    rackRails(p, -s.w / 2 + GAP * 2, s.w / 2 - GAP * 2, tankTop, column / 2);
    // Column at the back, its top with the control panel facing the front.
    p.box("steel", -s.w / 2, s.w / 2, tankTop, s.h - SHEET, zb, zb + column);
    p.box("steelDark", -s.w / 2, s.w / 2, s.h - SHEET, s.h, zb, zb + column);
    const panelY0 = s.h - CONTROLS;
    const zp = zb + column;
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, panelY0, s.h - GAP, zp, zp + DOOR / 2);
    p.box("glassDark", -s.w / 2 + 0.06, -s.w / 2 + 0.2, panelY0 + 0.03, s.h - 0.03, zp + DOOR / 2, zp + DOOR / 2 + 0.003);
    for (let i = 0; i < 3; i++) p.rod("knob", "z", s.w / 2 - 0.08 - i * 0.06, panelY0 + CONTROLS / 2, zp + DOOR / 2 + 0.005, 0.01, 0.016);
    // The hood: a box over the rack from the tank to below the panel with a stiffening bead
    // round its top, its handle bar out in front on two arms.
    const hoodTop = panelY0 - GAP;
    const hoodBottom = tankTop + GAP * 2;
    const hoodFront = zf - HANDLE_REACH;
    p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, hoodBottom, hoodTop - 0.03, zp + GAP, hoodFront);
    p.box("steel", -s.w / 2 + GAP + 0.01, s.w / 2 - GAP - 0.01, hoodTop - 0.03, hoodTop, zp + GAP, hoodFront - 0.01);
    p.box("steelDark", -s.w / 2 + GAP, s.w / 2 - GAP, hoodTop - 0.035, hoodTop - 0.03, zp + GAP, hoodFront + 0.002);
    p.box("steelDark", -s.w / 2 + GAP, s.w / 2 - GAP, hoodBottom, hoodBottom + 0.03, hoodFront - 0.002, hoodFront + 0.002);
    const hy = hoodBottom + 0.1;
    const hx = s.w / 2 - s.w / 6;
    p.rod("handle", "x", 0, hy, zf - 0.012, 2 * hx, 0.012);
    for (const sx of [-1, 1]) p.rod("handle", "z", sx * hx, hy, (hoodFront + zf - 0.012) / 2, zf - 0.012 - hoodFront, 0.01);
    // The guides on the column's sides the hood runs in.
    for (const sx of [-1, 1]) {
      const x = sx * (s.w / 2 - GAP / 2);
      p.box("steelDark", x - GAP / 2, x + GAP / 2, tankTop, panelY0, zp - 0.04, zp);
    }
  },
};
