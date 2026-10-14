// Hood-type dishwasher (Haubenspülmaschine, Durchschub): a base with the wash tank at the height
// of the dish tables, the lifting hood over the rack and the column at the back that carries the
// hood and the control panel. Racks slide through from the inlet table on one side to the
// outlet table on the other, so both sides stay open below the hood.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { body, CONTROLS, DOOR, doors, GAP, HANDLE, PLINTH, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { rackRails } from "./common";

/** Height of the base below the hood: the working height of the dish line (mm). */
const BASE = 850;
/** Depth of the column at the back that carries the hood (m), at most this share of the depth. */
const COLUMN = 0.15;
const COLUMN_SHARE = 0.2;
/** Size of a dish rack (mm). */
const RACK = 500;

/** Height of the base in mm, shrunk on a low resized unit. */
const baseHeight = (h: number) => Math.min(BASE, h * 0.6);

export const dishwasher: KindDef = {
  kind: "dishwasher",
  plan(s) {
    const col = Math.min(COLUMN * 1000, s.d * COLUMN_SHARE);
    // The hood over the tank, the column behind it and the rack inside (hidden by the hood).
    s.rect("detail", s.L + INSET / 2, s.B + col, s.R - INSET / 2, s.F - INSET / 2);
    s.line("detail", [s.L, s.B + col], [s.R, s.B + col]);
    const rack = Math.min(RACK, s.w - 2 * INSET, s.d - col - INSET);
    const cy = (s.B + col + s.F) / 2;
    s.rect("hidden", -rack / 2, cy - rack / 2, rack / 2, cy + rack / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const base = z0 + baseHeight(f.item.height);
    const c = (l + r) / 2;
    // Service door of the base, the hood above it with its handle, the panel on the column.
    f.box("detail", l + I / 2, r - I / 2, z0 + FEET, base - I / 2);
    f.line("detail", [c - I * 3, base - I * 2], [c + I * 3, base - I * 2]);
    const panel = top - CONTROLS * 1000;
    f.box("detail", l + I / 4, r - I / 4, base + I / 2, panel - I / 4);
    f.line("detail", [l + I * 3, base + I * 3], [r - I * 3, base + I * 3]);
    f.box("detail", c - I * 3, c + I * 3, panel + I / 2, top - I / 2);
  },
  mesh(p, s) {
    const tankTop = baseHeight(s.h * 1000) / 1000;
    const column = Math.min(COLUMN, s.d * COLUMN_SHARE);
    const zb = -s.d / 2;
    const zf = s.d / 2;
    // Base with the wash tank and its service door.
    body(p, { ...s, h: tankTop }, "steel", SHEET * 2);
    doors(p, -s.w / 2, s.w / 2, PLINTH, tankTop - SHEET * 2, s.d, 1, "top");
    // The rack guides on the tank, showing at the open sides under the hood.
    rackRails(p, -s.w / 2 + GAP * 2, s.w / 2 - GAP * 2, tankTop, column / 2);
    // Column at the back, its top with the control panel facing the front.
    p.box("steel", -s.w / 2, s.w / 2, tankTop, s.h - SHEET, zb, zb + column);
    p.box("steelDark", -s.w / 2, s.w / 2, s.h - SHEET, s.h, zb, zb + column);
    const panelY0 = s.h - CONTROLS;
    const zp = zb + column;
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, panelY0, s.h - GAP, zp, zp + DOOR / 2);
    p.box("glassDark", -s.w / 2 + 0.06, -s.w / 2 + 0.2, panelY0 + 0.03, s.h - 0.03, zp + DOOR / 2, zp + DOOR / 2 + 0.003);
    for (let i = 0; i < 3; i++) p.rod("knob", "z", s.w / 2 - 0.08 - i * 0.06, panelY0 + CONTROLS / 2, zp + DOOR / 2 + 0.005, 0.01, 0.016);
    // The hood: a box over the rack from the tank to below the panel, a stiffening bead around
    // its top, and the handle bar across its front.
    const hoodTop = panelY0 - GAP;
    const hoodBottom = tankTop + GAP * 2;
    const hoodFront = zf - HANDLE;
    p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, hoodBottom, hoodTop - 0.03, zp + GAP, hoodFront);
    p.box("steel", -s.w / 2 + GAP + 0.01, s.w / 2 - GAP - 0.01, hoodTop - 0.03, hoodTop, zp + GAP, hoodFront - 0.01);
    p.box("steelDark", -s.w / 2 + GAP, s.w / 2 - GAP, hoodTop - 0.035, hoodTop - 0.03, zp + GAP, hoodFront + 0.002);
    p.box("steelDark", -s.w / 2 + GAP, s.w / 2 - GAP, hoodBottom, hoodBottom + 0.03, hoodFront - 0.002, hoodFront + 0.002);
    p.barHandle("x", -s.w / 3, s.w / 3, hoodBottom + 0.09, hoodFront, zf);
    // Lifting arms from the column to the hood's sides.
    for (const sx of [-1, 1]) {
      const x = sx * (s.w / 2 - GAP / 2);
      p.box("steelDark", x - GAP / 2, x + GAP / 2, hoodTop - 0.15, hoodTop - 0.1, zp - 0.05, zp + 0.12);
    }
  },
};
