// Pastry table (Konditoreitisch): a cabinet base on adjustable feet with tilting flour bins
// (Mehlkippschübe) at the left and a drawer block at the right, under a granite top for rolling
// out dough.

import { DOOR, DOOR_RADIUS, GAP } from "../parts/mesh";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, drawerFronts, drawersFront, frontsPlan } from "./common";
import { stoneTop, stoneTopFront } from "./stoneTable";

/** Width of the drawer block at the right (mm) and its drawers. */
const BLOCK = 500;
const DRAWERS = 3;
/** Usual width of one flour bin (mm). */
const BIN = 550;

/** The drawer block's width and the number of flour bins beside it (mm). */
function split(w: number): { block: number; bins: number } {
  const block = Math.min(BLOCK, w / 3);
  return { block, bins: Math.max(1, Math.round((w - block) / BIN)) };
}

export const pastryTable: KindDef = {
  kind: "pastryTable",
  plan(s) {
    const { block, bins } = split(s.w);
    frontsPlan(s, s.L, s.R - block, bins);
    frontsPlan(s, s.R - block, s.R, 1);
  },
  elevation(f) {
    const { z0, z1 } = cabinetFront(f, false);
    stoneTopFront(f);
    const { block, bins } = split(f.w);
    const bw = (f.w - block) / bins;
    for (let i = 0; i < bins; i++) {
      const a = f.l + i * bw;
      f.box("detail", a + 10, a + bw - 10, z0 + 10, z1 - 10);
      // The grip recess across the top of the bin's front.
      f.box("detail", a + bw / 2 - 120, a + bw / 2 + 120, z1 - 90, z1 - 50);
    }
    drawersFront(f, f.r - block, f.r, z0, z1, DRAWERS);
  },
  mesh(p, s, item) {
    const { y0, y1, zf } = cabinetBody(p, s);
    const { block, bins } = split(item.width);
    const xb = s.w / 2 - block / 1000;
    const bw = (xb + s.w / 2) / bins;
    for (let i = 0; i < bins; i++) {
      const a = -s.w / 2 + i * bw + GAP;
      const b = -s.w / 2 + (i + 1) * bw - GAP;
      // The bin's front: a leaf with a pressed grip recess across its top.
      p.roundedBox("steel", a, b, y0 + GAP, y1 - GAP, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
      const gx = (a + b) / 2;
      const gw = Math.min(0.12, (b - a) * 0.3);
      p.plate("satin", gx - gw, gx + gw, y1 - 0.095, y1 - 0.045, zf - DOOR / 2, zf - DOOR / 2 + 0.0015, 0.012, true);
      p.plate("slot", gx - gw + 0.008, gx + gw - 0.008, y1 - 0.087, y1 - 0.053, zf - DOOR / 2 + 0.0015, zf - DOOR / 2 + 0.002, 0.008);
    }
    drawerFronts(p, xb, s.w / 2, y0, y1, zf, DRAWERS);
    stoneTop(p, s);
  },
};
