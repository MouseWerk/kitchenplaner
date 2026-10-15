// Cutting board rack (Schneidbrettständer) on a work table: a stainless drip tray with two wire
// frames whose bars hold six boards upright in the HACCP colours (red meat, yellow poultry, green
// vegetables, brown cooked food, blue fish and white bread and dairy; the blue one shows dark).

import type { MaterialId } from "../parts/mesh";
import type { KindDef } from "../types";
import { mBox, metres } from "./common";

/** The boards' colours from left to right. */
const BOARDS: readonly MaterialId[] = ["foodRed", "foodCream", "foodGreen", "foodBrown", "panelDark", "panel"];
/** Thickness of a board and of the tray (m). */
const BOARD_T = 0.012;
const TRAY = 0.025;
/** Wire radius of the frames (m, 6 mm). */
const WIRE_R = 0.003;

/** Centres of the boards along the width (m). */
function boardXs(w: number): number[] {
  const pitch = (w - 0.06) / BOARDS.length;
  return BOARDS.map((_, i) => -w / 2 + 0.03 + pitch * (i + 0.5));
}

export const boardRack: KindDef = {
  kind: "boardRack",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    for (const x of boardXs(m.w)) s.rect("detail", (x - BOARD_T / 2) * 1000, s.B + 20, (x + BOARD_T / 2) * 1000, s.F - 20);
  },
  elevation(f) {
    const m = metres(f.item);
    mBox(f, "detail", -m.w / 2, m.w / 2, 0, TRAY);
    for (const x of boardXs(m.w)) mBox(f, "detail", x - BOARD_T / 2, x + BOARD_T / 2, TRAY, m.h);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    p.pan("steel", -w / 2, w / 2, 0, TRAY, -d / 2, d / 2, { wall: 0.002, r: 0.015 });
    // The boards stand in the tray, their edges rounded.
    boardXs(w).forEach((x, i) => {
      p.roundedBox(BOARDS[i], x - BOARD_T / 2, x + BOARD_T / 2, 0.004, h, -d / 2 + 0.02, d / 2 - 0.02, 0.005);
    });
    // Two wire frames across the boards, front and back: bars along x at two heights between
    // uprights at the ends.
    for (const sz of [-1, 1]) {
      const z = sz * (d / 2 - 0.05);
      for (const y of [TRAY + 0.02, h * 0.62]) p.rod("wire", "x", 0, y, z, w - 0.01, WIRE_R);
      for (const sx of [-1, 1]) p.rod("wire", "y", sx * (w / 2 - 0.008), (TRAY + h * 0.62) / 2, z, h * 0.62 - TRAY + 0.006, WIRE_R);
    }
  },
};
