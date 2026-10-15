// Machine trolley (Maschinenwagen): a low stand for a table-top machine, its top a pressed tray
// with a raised rim that keeps the machine's feet in place, an undershelf for tools and bowls,
// square legs on four swivel castors.

import { LEG, LEG_RADIUS, SHEET, TOP_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, tableCastor } from "./common";

/** Depth of the top tray's rim and the shelf's height above the castors (m). */
const RIM = 0.03;
const SHELF = 0.08;

export const machineStand: KindDef = {
  kind: "machineStand",
  plan(s) {
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
  },
  elevation(f) {
    f.box("detail", f.l, f.r, f.top - RIM * 1000, f.top);
    const sy = f.z0 + (CASTOR + SHELF) * 1000;
    f.box("detail", f.l + 20, f.r - 20, sy, sy + SHEET * 2000);
    for (const a of [f.l + 30, f.r - 30 - LEG * 1000]) {
      f.box("detail", a, a + LEG * 1000, f.z0 + CASTOR * 1000, f.top - RIM * 1000);
      f.box("detail", a + 5, a + LEG * 1000 - 5, f.z0, f.z0 + CASTOR * 1000);
    }
  },
  mesh(p, s) {
    const { w, d, h } = s;
    p.pan("steel", -w / 2, w / 2, h - RIM, h, -d / 2, d / 2, { wall: 0.003, r: 0.02 });
    const lx = w / 2 - 0.03 - LEG / 2;
    const lz = d / 2 - 0.03 - LEG / 2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        p.roundedBox("steelDark", sx * lx - LEG / 2, sx * lx + LEG / 2, CASTOR, h - RIM + 0.002, sz * lz - LEG / 2, sz * lz + LEG / 2, LEG_RADIUS, "vertical");
        tableCastor(p, sx * lx, sz * lz);
      }
    }
    const sy = CASTOR + SHELF;
    p.roundedBox("steel", -lx - LEG / 2 - 0.004, lx + LEG / 2 + 0.004, sy, sy + SHEET * 2, -lz - LEG / 2 - 0.004, lz + LEG / 2 + 0.004, TOP_RADIUS);
  },
};
