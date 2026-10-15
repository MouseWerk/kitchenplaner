// Cutting table (Zerlegetisch): a wall work table with a thick white polyethylene cutting board
// laid on its top inside the upstand, for cutting meat and fish; legs on feet and an undershelf.

import { TOP } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableLegsFront, tableTop, UPSTAND_RISE } from "./common";

/** Thickness of the cutting board on the steel top (mm). */
const BOARD_MM = 20;
const BOARD = BOARD_MM / 1000;
/** Gap round the board inside the steel top's edges (m). */
const BOARD_SET = 0.03;

export const cuttingTable: KindDef = {
  kind: "cuttingTable",
  // The steel top lies a board's thickness below the working height, its upstand rising from there.
  rise: UPSTAND_RISE - BOARD_MM,
  plan(s) {
    upstandLine(s);
    const set = BOARD_SET * 1000;
    s.rect("detail", s.L + set, s.B + 20 + set, s.R - set, s.F - set);
  },
  elevation(f) {
    const steel = f.top - BOARD_MM;
    f.box("detail", f.l, f.r, steel - TOP * 1000, steel);
    f.box("detail", f.l + BOARD_SET * 1000, f.r - BOARD_SET * 1000, steel, f.top);
    f.box("detail", f.l, f.r, steel, f.top + UPSTAND_RISE - BOARD_MM);
    tableLegsFront(f, { shelf: true });
  },
  mesh(p, s) {
    const steel = s.h - BOARD;
    tableFrame(p, s, steel - TOP, { shelf: true });
    tableTop(p, { ...s, h: steel }, { back: true });
    p.roundedBox("panel", -s.w / 2 + BOARD_SET, s.w / 2 - BOARD_SET, steel - 0.001, s.h, -s.d / 2 + 0.02 + BOARD_SET, s.d / 2 - BOARD_SET, 0.006);
  },
};
