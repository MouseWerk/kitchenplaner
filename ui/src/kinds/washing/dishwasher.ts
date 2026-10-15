// Hood-type dishwasher (Haubenspülmaschine, Durchschub): the wash tank at the height of the dish
// tables on an open stand with the detergent canister under it, the lifting hood over the rack
// with its handle bar standing out on arms, and the column at the back that carries the hood in
// its guides and the control panel. Racks slide through from the inlet table on one side to the
// outlet table on the other; a wide machine (double hood) takes two racks side by side.

import { INSET as FRONT_INSET, LEG as LEG_MM } from "../parts/elevation";
import { BODY_RADIUS, CONTROLS, DOOR, DOOR_RADIUS, foot, GAP, LEG, LEG_RADIUS, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { rackRails } from "./common";
import { machinePanel } from "./details";
import { HOUSING_RADIUS, ratingPlate } from "../parts/details";

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

/** Width from which the machine takes two racks side by side (mm). */
const DOUBLE_FROM = 1100;
/** Height of the feet under the stand's legs (m). */
const FEET = 0.08;

/** Racks side by side in a machine of width `w` (mm). */
const rackCount = (w: number) => (w >= DOUBLE_FROM ? 2 : 1);

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
    const n = rackCount(s.w);
    const rack = Math.min(RACK, s.w / n - 2 * INSET, s.d - col - INSET);
    const cy = (s.B + col + s.F) / 2;
    for (let i = 0; i < n; i++) {
      const cx = s.L + (s.w * (i + 0.5)) / n;
      s.rect("hidden", cx - rack / 2, cy - rack / 2, cx + rack / 2, cy + rack / 2);
    }
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
    // The open stand: four legs on feet, a cross rail at the back, the canister on the floor
    // with its suction hose up to the tank.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - LEG / 2 - GAP);
        const z = sz * (s.d / 2 - LEG / 2 - DOOR);
        p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, FEET, tank0 + 0.01, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
        foot(p, x, z, FEET, LEG * 0.55);
      }
    }
    p.roundedBox("steelDark", -s.w / 2 + LEG, s.w / 2 - LEG, 0.15, 0.18, zb + DOOR, zb + DOOR + LEG, BODY_RADIUS);
    const cw = CANISTER.w;
    p.roundedBox("panel", -cw / 2, cw / 2, 0, CANISTER.h, -CANISTER.d / 2, CANISTER.d / 2, 0.02);
    p.roundedBox("panel", -cw / 2 + 0.03, -cw / 2 + 0.07, CANISTER.h, CANISTER.h + 0.03, -0.015, 0.015, 0.008);
    p.lathe("knob", cw / 4, CANISTER.h, 0, [
      [0, 0],
      [0.026, 0],
      [0.027, 0.02],
      [0.022, 0.028],
      [0, 0.03],
    ]);
    p.tube("rubber", [
      { x: cw / 4, y: CANISTER.h + 0.03, z: 0 },
      { x: cw / 4, y: CANISTER.h + 0.1, z: 0 },
      { x: cw / 4, y: CANISTER.h + 0.1, z: zb + DOOR + LEG * 2 },
      { x: cw / 4, y: tank0 + 0.002, z: zb + DOOR + LEG * 2 },
    ], 0.005, { bend: 0.04 });
    // The tank with its service panel and rating plate, the rack guides on its top under the hood.
    p.roundedBox("steel", -s.w / 2, s.w / 2, tank0, tankTop, zb, zf - DOOR, BODY_RADIUS, "vertical");
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, tank0 + GAP, tankTop - 0.012, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
    ratingPlate(p, s.w / 2 - 0.08, tank0 + 0.05, zf - DOOR / 2);
    p.roundedBox("steelDark", -s.w / 2, s.w / 2, tankTop - 0.012, tankTop, zb + 0.01, zf - DOOR / 2 + 0.002, BODY_RADIUS, "top", "z");
    rackRails(p, -s.w / 2 + GAP * 2, s.w / 2 - GAP * 2, tankTop, column / 2);
    // Column at the back, its top with the control panel facing the front.
    p.roundedBox("steel", -s.w / 2, s.w / 2, tankTop, s.h - SHEET, zb, zb + column, HOUSING_RADIUS);
    p.roundedBox("steelDark", -s.w / 2 + 0.004, s.w / 2 - 0.004, s.h - SHEET - 0.002, s.h, zb + 0.004, zb + column - 0.004, BODY_RADIUS);
    const panelY0 = s.h - CONTROLS;
    const zp = zb + column;
    machinePanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, panelY0, s.h - GAP - SHEET, zp - 0.002, zp + DOOR / 2, 3);
    // The hood: a pressed box over the rack from the tank to below the panel with a stiffening
    // bead round its top and a seal along its lower edge, its handle bar out in front.
    const hoodTop = panelY0 - GAP;
    const hoodBottom = tankTop + GAP * 2;
    const hoodFront = zf - HANDLE_REACH;
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, hoodBottom, hoodTop - 0.03, zp + GAP, hoodFront, HOUSING_RADIUS);
    p.roundedBox("steel", -s.w / 2 + GAP + 0.01, s.w / 2 - GAP - 0.01, hoodTop - 0.034, hoodTop, zp + GAP, hoodFront - 0.01, HOUSING_RADIUS);
    p.roundedBox("rubber", -s.w / 2 + GAP + 0.002, s.w / 2 - GAP - 0.002, hoodBottom - 0.002, hoodBottom + 0.012, zp + GAP + 0.002, hoodFront + 0.002, BODY_RADIUS, "vertical");
    // Pressed beads across the hood's front.
    for (const y of [hoodBottom + 0.16, hoodTop - 0.12]) {
      if (y > hoodBottom + 0.05 && y < hoodTop - 0.06) p.roundedBox("steel", -s.w / 2 + 0.04, s.w / 2 - 0.04, y - 0.006, y + 0.006, hoodFront - 0.004, hoodFront + 0.003, 0.003, "top", "z");
    }
    const hx = s.w / 2 - s.w / 6;
    p.barHandle("x", -hx, hx, hoodBottom + 0.07, hoodFront, zf);
    // The guides on the column's sides the hood runs in.
    for (const sx of [-1, 1]) {
      const x = sx * (s.w / 2 - GAP / 2);
      p.roundedBox("steelDark", x - GAP / 2, x + GAP / 2, tankTop, panelY0, zp - 0.04, zp, 0.001, "vertical");
    }
  },
};
