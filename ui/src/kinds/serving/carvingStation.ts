// Carving station (Tranchierstation): a heated counter with a cutting board and a heat lamp
// gantry over it, the gantry's posts at the back (guest side), the carver at the front.

import { doorCount, FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR_WIDTH, doors, PLINTH, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody } from "./common";

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
    f.doors(doorCount(f.w), f.z0 + FEET, top - FRONT_TOP - I);
    f.box("detail", l + BOARD_MARGIN, r - BOARD_MARGIN, top, top + BOARD);
    // Gantry: two posts and the lamp housing across the top.
    f.box("detail", l + I / 2, l + I / 2 + POST * 1000, top, top + GANTRY_RISE - LAMP_H * 1000);
    f.box("detail", r - I / 2 - POST * 1000, r - I / 2, top, top + GANTRY_RISE - LAMP_H * 1000);
    f.box("detail", l + I / 2, r - I / 2, top + GANTRY_RISE - LAMP_H * 1000, top + GANTRY_RISE);
  },
  mesh(p, s) {
    counterBody(p, s);
    doors(p, -s.w / 2, s.w / 2, PLINTH, s.h - TOP, s.d, Math.max(1, Math.round(s.w / DOOR_WIDTH)), "vertical");
    // Cutting board with a juice groove round it.
    const m = BOARD_MARGIN / 1000;
    const b = BOARD / 1000;
    p.box("panel", -s.w / 2 + m, s.w / 2 - m, s.h, s.h + b, -s.d / 2 + m, s.d / 2 - m);
    p.box("steelDark", -s.w / 2 + m + 0.02, s.w / 2 - m - 0.02, s.h + b, s.h + b + 0.001, -s.d / 2 + m + 0.02, -s.d / 2 + m + 0.026);
    // Gantry with the lamp housing; the heating rods in its underside.
    const rise = GANTRY_RISE / 1000;
    const zb = -s.d / 2 + 0.025;
    for (const x of [-s.w / 2 + 0.025, s.w / 2 - 0.025 - POST]) p.box("steel", x, x + POST, s.h, s.h + rise - LAMP_H, zb, zb + POST);
    const z1 = zb + LAMP_DEPTH;
    p.box("steel", -s.w / 2 + 0.025, s.w / 2 - 0.025, s.h + rise - LAMP_H, s.h + rise, zb, z1);
    p.box("steelDark", -s.w / 2 + 0.04, s.w / 2 - 0.04, s.h + rise - LAMP_H - 0.004, s.h + rise - LAMP_H, zb + 0.02, z1 - 0.02);
    for (const f of [0.35, 0.65]) p.rod("ceramic", "x", 0, s.h + rise - LAMP_H - 0.012, zb + LAMP_DEPTH * f, s.w - 0.14, 0.008);
  },
};
