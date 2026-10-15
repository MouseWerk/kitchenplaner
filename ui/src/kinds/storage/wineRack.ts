// Wine rack (Weinregal): a wooden case on a plinth with a grid of square bins, one bottle lying
// in each, its neck towards the front, so the labels stay dark and the corks wet. Part of the
// bins is filled.

import type { Front } from "../parts/elevation";
import { BODY_RADIUS, TOP_RADIUS } from "../parts/mesh";
import type { KindDef } from "../types";
import { bottle } from "./helpers";

// Construction sizes (m).
/** Thickness of the sides, top and dividers. */
const SIDE = 0.02;
const DIVIDER = 0.01;
/** Height of the plinth. */
const PLINTH = 0.08;
/** Pitch of the bins. */
const BIN = 0.105;
/** Radius and length of a bottle. */
const BOTTLE_R = 0.037;
const BOTTLE_L = 0.3;
/** Most bottles drawn, so a wide rack stays within the budget. */
const MAX_BOTTLES = 50;

/** The grid of bins: columns and rows and their pitch inside the case (m). */
function grid(w: number, h: number) {
  const iw = w - 2 * SIDE;
  const ih = h - PLINTH - 2 * SIDE;
  const cols = Math.max(1, Math.round(iw / BIN));
  const rows = Math.max(1, Math.round(ih / BIN));
  return { cols, rows, cw: iw / cols, rh: ih / rows, x0: -w / 2 + SIDE, y0: PLINTH + SIDE };
}

/** Whether bin (row, column) holds a bottle: a filled store with a few gaps. */
function filled(r: number, c: number, rows: number): boolean {
  return r >= rows * 0.25 && (r * 7 + c * 3) % 5 !== 0;
}

export const wineRack: KindDef = {
  kind: "wineRack",
  plan(s) {
    const g = grid(s.w / 1000, s.item.height / 1000);
    for (let c = 1; c < g.cols; c++) {
      const x = (g.x0 + g.cw * c) * 1000;
      s.line("detail", [x, s.B], [x, s.F]);
    }
    s.line("detail", [s.L + SIDE * 1000, s.F - 20], [s.R - SIDE * 1000, s.F - 20]);
  },
  elevation(f: Front) {
    const g = grid(f.w / 1000, f.item.height / 1000);
    const x = (v: number) => f.l + (v + f.w / 2000) * 1000;
    const z = (v: number) => f.z0 + v * 1000;
    f.box("detail", f.l, f.r, f.z0, z(PLINTH));
    for (let c = 1; c < g.cols; c++) f.line("detail", [x(g.x0 + g.cw * c), z(g.y0)], [x(g.x0 + g.cw * c), z(g.y0 + g.rh * g.rows)]);
    for (let r = 1; r < g.rows; r++) f.line("detail", [x(g.x0), z(g.y0 + g.rh * r)], [x(g.x0 + g.cw * g.cols), z(g.y0 + g.rh * r)]);
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) if (filled(r, c, g.rows)) f.circle("detail", x(g.x0 + g.cw * (c + 0.5)), z(g.y0 + g.rh * (r + 0.5)), BOTTLE_R * 1000 * 0.4);
    }
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const F = s.d / 2;
    const g = grid(s.w, s.h);
    // The case: plinth set back, sides and top with softened edges, a back panel.
    p.roundedBox("wood", -W + 0.01, W - 0.01, 0, PLINTH, B, F - 0.03, BODY_RADIUS);
    for (const sx of [-1, 1]) p.roundedBox("wood", sx > 0 ? W - SIDE : -W, sx > 0 ? W : -W + SIDE, 0, s.h, B, F, TOP_RADIUS);
    p.roundedBox("wood", -W + SIDE, W - SIDE, s.h - SIDE, s.h, B, F, TOP_RADIUS);
    p.roundedBox("wood", -W + SIDE, W - SIDE, PLINTH, PLINTH + SIDE, B, F, TOP_RADIUS);
    p.box("wood", -W + SIDE, W - SIDE, PLINTH + SIDE, s.h - SIDE, B, B + 0.006);
    // The bins: dividers and shelves of thin boards.
    for (let c = 1; c < g.cols; c++) {
      const x = g.x0 + g.cw * c;
      p.roundedBox("wood", x - DIVIDER / 2, x + DIVIDER / 2, g.y0, g.y0 + g.rh * g.rows, B + 0.006, F - 0.005, 0.002, "vertical");
    }
    for (let r = 1; r < g.rows; r++) {
      const y = g.y0 + g.rh * r;
      p.roundedBox("wood", g.x0, g.x0 + g.cw * g.cols, y - DIVIDER / 2, y + DIVIDER / 2, B + 0.006, F - 0.005, 0.002, "all", "x");
    }
    // Bottles lying in the bins, necks to the front.
    const len = Math.min(BOTTLE_L, s.d - 0.02);
    const br = Math.min(BOTTLE_R, g.cw / 2 - DIVIDER, g.rh / 2 - DIVIDER);
    let n = 0;
    for (let r = g.rows - 1; r >= 0 && n < MAX_BOTTLES; r--) {
      for (let c = 0; c < g.cols && n < MAX_BOTTLES; c++) {
        if (!filled(r, c, g.rows)) continue;
        bottle(p, g.x0 + g.cw * (c + 0.5), g.y0 + g.rh * r + DIVIDER / 2 + br, F - 0.012 - len, br, len);
        n++;
      }
    }
  },
};
