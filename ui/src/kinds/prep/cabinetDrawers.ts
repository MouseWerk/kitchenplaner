// Work cabinet with a drawer block: three drawers at the left end, hinged doors on the rest.

import { DOOR_MODULE } from "../parts/elevation";
import { doors } from "../parts/mesh";
import { upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { cabinetBody, cabinetFront, doorsFront, drawerFronts, drawersFront, frontsPlan, tableTop, UPSTAND_RISE } from "./common";

/** Width of the drawer block (mm) and its number of drawers. */
const BLOCK = 500;
const DRAWERS = 3;

/** The drawer block's width and the number of doors beside it (mm). */
function split(w: number): { block: number; doors: number } {
  const block = Math.min(BLOCK, w / 2);
  return { block, doors: Math.max(1, Math.round((w - block) / DOOR_MODULE)) };
}

export const cabinetDrawers: KindDef = {
  kind: "cabinetDrawers",
  rise: UPSTAND_RISE,
  plan(s) {
    upstandLine(s);
    const { block, doors: n } = split(s.w);
    frontsPlan(s, s.L, s.L + block, 1);
    frontsPlan(s, s.L + block, s.R, n);
  },
  elevation(f) {
    const { z0, z1 } = cabinetFront(f, true);
    const { block, doors: n } = split(f.w);
    drawersFront(f, f.l, f.l + block, z0, z1, DRAWERS);
    doorsFront(f, f.l + block, f.r, z0, z1, n);
  },
  mesh(p, s, item) {
    const { y0, y1, zf } = cabinetBody(p, s);
    const { block, doors: n } = split(item.width);
    const xb = -s.w / 2 + block / 1000;
    drawerFronts(p, -s.w / 2, xb, y0, y1, zf, DRAWERS);
    doors(p, xb, s.w / 2, y0, y1, 2 * zf, n, "vertical");
    tableTop(p, s, { back: true });
  },
};
