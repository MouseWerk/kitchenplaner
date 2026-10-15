// Butcher block (Hackklotz): an end-grain beech block held in a stainless band, on a stainless
// stand with legs on adjustable feet and an undershelf.

import { LEG, LEG_RADIUS, SHEET, TOP_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { foot } from "./common";

/** Height of the wooden block (mm). */
const BLOCK_MM = 250;
/** The steel band round the block: its height and where it sits below the block's top (m). */
const BAND = 0.05;
const BAND_DROP = 0.06;
/** Set-in of the block from the outline, so the band round it fills the footprint (m). */
const BAND_T = 0.006;
/** Height of the stand's feet and undershelf (m). */
const FEET = 0.05;
const SHELF = 0.23;

export const butcherBlock: KindDef = {
  kind: "butcherBlock",
  plan(s) {
    // The block's end grain: its outline inside the band and the growth rings as a circle.
    s.rect("detail", s.L + INSET / 4, s.B + INSET / 4, s.R - INSET / 4, s.F - INSET / 4);
    s.circle("detail", 0, 0, Math.min(s.w, s.d) * 0.3);
  },
  elevation(f) {
    f.box("detail", f.l, f.r, f.top - BLOCK_MM, f.top);
    f.box("detail", f.l, f.r, f.top - (BAND_DROP + BAND) * 1000, f.top - BAND_DROP * 1000);
    f.legsAndUndershelf(f.top - BLOCK_MM);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const blockY = h - BLOCK_MM / 1000;
    // The block with eased edges, its band a turned ring round its middle.
    p.roundedBox("wood", -w / 2 + BAND_T, w / 2 - BAND_T, blockY, h, -d / 2 + BAND_T, d / 2 - BAND_T, 0.008);
    const hx = w / 2 - BAND_T - 0.003;
    const hz = d / 2 - BAND_T - 0.003;
    const t = BAND_T + 0.003;
    p.lathe(
      "steel",
      0,
      h - BAND_DROP - BAND,
      0,
      [
        [0, 0],
        [t, 0],
        [t, BAND],
        [0, BAND],
        [0, 0],
      ],
      { rect: [hx, hz] },
    );
    // The stand: square legs under the block's corners, a frame under the block, the undershelf.
    const lx = w / 2 - BAND_T - LEG / 2 - 0.01;
    const lz = d / 2 - BAND_T - LEG / 2 - 0.01;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        p.roundedBox("steelDark", sx * lx - LEG / 2, sx * lx + LEG / 2, FEET, blockY + 0.002, sz * lz - LEG / 2, sz * lz + LEG / 2, LEG_RADIUS, "vertical");
        foot(p, sx * lx, sz * lz, FEET);
      }
    }
    p.roundedBox("steelDark", -lx - LEG / 2, lx + LEG / 2, blockY - 0.04, blockY, -lz - LEG / 2, lz + LEG / 2, TOP_RADIUS, "vertical");
    p.roundedBox("steel", -lx - LEG / 2 - 0.004, lx + LEG / 2 + 0.004, SHELF, SHELF + SHEET * 2, -lz - LEG / 2 - 0.004, lz + LEG / 2 + 0.004, TOP_RADIUS);
  },
};
