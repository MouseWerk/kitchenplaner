// Carving station (Tranchierstation): a heated counter with a cutting board and a heat lamp
// gantry over it, the gantry's posts at the back (guest side), the carver at the front.

import { doorCount, FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, DOOR_WIDTH, GAP, LEG_RADIUS, PLINTH, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { controlPanel, counterBody, leafDoors } from "./common";

/** Height of the control panel under the top (mm). */
const PANEL_MM = 130;
/** Height of the heat lamp gantry over the top (mm). */
const GANTRY_RISE = 650;
/** Cutting board: margin from the edges and thickness (mm). */
const BOARD_MARGIN = 100;
const BOARD = 20;
/** Depth of the lamp housing and its height (m), the gantry post (m). */
const LAMP_DEPTH = 0.32;
const LAMP_H = 0.08;
const POST = 0.04;

export const carvingStation: KindDef = {
  kind: "carvingStation",
  rise: GANTRY_RISE,
  plan(s) {
    s.rect("detail", s.L + BOARD_MARGIN, s.B + BOARD_MARGIN, s.R - BOARD_MARGIN, s.F - BOARD_MARGIN);
    // Gantry posts at the back corners, the lamp housing over the board (above: dashed).
    for (const x of [s.L + INSET / 2, s.R - INSET / 2 - POST * 1000]) s.rect("detail", x, s.B + INSET / 2, x + POST * 1000, s.B + INSET / 2 + POST * 1000);
    s.rect("hidden", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.B + INSET / 2 + LAMP_DEPTH * 1000);
  },
  elevation(f) {
    const { l, r, top } = f;
    const I = FRONT_INSET;
    f.worktop();
    f.panel(top - FRONT_TOP - PANEL_MM, top - FRONT_TOP, 2);
    f.doors(doorCount(f.w), f.z0 + FEET, top - FRONT_TOP - PANEL_MM - I / 2);
    f.box("detail", l + BOARD_MARGIN, r - BOARD_MARGIN, top, top + BOARD);
    // Gantry: two posts and the lamp housing across the top.
    f.box("detail", l + I / 2, l + I / 2 + POST * 1000, top, top + GANTRY_RISE - LAMP_H * 1000);
    f.box("detail", r - I / 2 - POST * 1000, r - I / 2, top, top + GANTRY_RISE - LAMP_H * 1000);
    f.box("detail", l + I / 2, r - I / 2, top + GANTRY_RISE - LAMP_H * 1000, top + GANTRY_RISE);
  },
  mesh(p, s) {
    const zBody = s.d / 2 - DOOR;
    counterBody(p, s, [], "steel", zBody);
    leafDoors(p, -s.w / 2, s.w / 2, PLINTH, s.h - TOP - PANEL_MM / 1000, zBody, s.d / 2 - DOOR / 2, s.d / 2, Math.max(1, Math.round(s.w / DOOR_WIDTH)));
    controlPanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, s.h - TOP - PANEL_MM / 1000 + GAP, s.h - TOP - GAP, zBody, s.d / 2, { knobs: 2, pilots: true, rocker: true });
    // Cutting board with a juice groove round it, a roast on it, the carving knife and fork.
    const m = BOARD_MARGIN / 1000;
    const b = BOARD / 1000;
    const x0 = -s.w / 2 + m;
    const x1 = s.w / 2 - m;
    const z0 = -s.d / 2 + m;
    const z1 = s.d / 2 - m;
    p.roundedBox("wood", x0, x1, s.h - 0.001, s.h + b, z0, z1, 0.008);
    p.lathe(
      "slot",
      (x0 + x1) / 2,
      s.h + b,
      (z0 + z1) / 2,
      [
        [0, 0],
        [0.006, 0],
        [0.006, 0.0006],
        [0, 0.0006],
        [0, 0],
      ],
      { rect: [(x1 - x0) / 2 - 0.035, (z1 - z0) / 2 - 0.035] },
    );
    const rx = (x0 + x1) / 2 - Math.min(0.1, (x1 - x0) / 6);
    const rz = (z0 + z1) / 2;
    p.lathe(
      "foodBrown",
      rx - 0.09,
      s.h + b + 0.05,
      rz,
      [
        [0, 0],
        [0.045, 0.002],
        [0.06, 0.03],
        [0.065, 0.09],
        [0.06, 0.15],
        [0.045, 0.178],
        [0, 0.18],
      ],
      { axis: "x" },
    );
    const kx = rx + 0.16;
    if (kx + 0.03 < x1) {
      p.roundedBox("handle", kx - 0.012, kx + 0.012, s.h + b, s.h + b + 0.003, rz - 0.15, rz + 0.06, 0.0015, "all", "z");
      p.roundedBox("knob", kx - 0.011, kx + 0.011, s.h + b, s.h + b + 0.018, rz + 0.06, rz + 0.17, 0.006, "all", "z");
    }
    // Gantry: two square posts at the back and the lamp housing across them, its heating
    // elements and a light in the underside.
    const rise = GANTRY_RISE / 1000;
    const zb = -s.d / 2 + 0.025;
    const yl = s.h + rise - LAMP_H;
    for (const x of [-s.w / 2 + 0.025, s.w / 2 - 0.025 - POST]) {
      p.roundedBox("steel", x, x + POST, s.h, yl, zb, zb + POST, LEG_RADIUS, "vertical");
      p.roundedBox("steelDark", x - 0.008, x + POST + 0.008, s.h, s.h + 0.006, zb - 0.008, zb + POST + 0.008, 0.002);
    }
    const z1l = zb + LAMP_DEPTH;
    p.roundedBox("steel", -s.w / 2 + 0.025, s.w / 2 - 0.025, yl, s.h + rise, zb - 0.02, z1l, 0.015, "all", "x");
    p.box("satin", -s.w / 2 + 0.05, s.w / 2 - 0.05, yl - 0.002, yl + 0.002, zb, z1l - 0.02);
    for (const f of [0.3, 0.7]) p.rod("ceramic", "x", 0, yl - 0.012, zb - 0.02 + (LAMP_DEPTH + 0.02) * f, s.w - 0.14, 0.008);
    p.roundedBox("panel", -s.w / 2 + 0.1, s.w / 2 - 0.1, yl - 0.004, yl - 0.002, zb + LAMP_DEPTH / 2 - 0.012, zb + LAMP_DEPTH / 2 + 0.012, 0.006, "vertical");
  },
};
