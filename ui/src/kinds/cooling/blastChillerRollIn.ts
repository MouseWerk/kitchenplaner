// Roll-in blast chiller (Durchfahr- or Einfahr-Schockkühler): a tall insulated cabinet that takes
// a GN trolley at floor level, so it stands without feet. The door takes the front beside a
// control column at the right; the machine sits on top behind a grille.

import { INSET } from "../parts/plan";
import { GAP } from "../parts/mesh";
import type { KindDef } from "../types";
import { coolDoor, display, displayFront, doorFront, doorSwings, FRONT, grille, grilleFront, LEAF_GAP_MM, m, STANDOFF } from "./common";

/** Width of the control column beside the door (mm). */
const COLUMN_MM = 250;
/** Height of the machine grille on top (mm). */
const GRILLE_MM = 150;
/** Height of the controls on the column above the floor (mm). */
const CONTROLS_MM = 1450;
/** Size of a GN 1/1 trolley (mm): drawn dashed inside the cabinet in the plan. */
const TROLLEY = { w: 450, d: 650 };
/** Height of the kick plate on the door (m). */
const KICK = 0.3;

const columnWidth = (width: number) => Math.min(COLUMN_MM, width * 0.25);

export const blastChillerRollIn: KindDef = {
  kind: "blastChillerRollIn",
  plan(s) {
    const col = columnWidth(s.w);
    doorSwings(s, 1, s.L, s.R - col);
    s.line("detail", [s.R - col, s.F - INSET / 2], [s.R - col, s.F]);
    const cx = (s.L + s.R - col) / 2;
    const tw = Math.min(TROLLEY.w, s.w - col - 2 * INSET);
    const td = Math.min(TROLLEY.d, s.d - 3 * INSET);
    s.rect("hidden", cx - tw / 2, -td / 2, cx + tw / 2, td / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const col = columnWidth(f.w);
    grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, top - GRILLE_MM + LEAF_GAP_MM / 2, top - LEAF_GAP_MM);
    doorFront(f, l + LEAF_GAP_MM / 2, r - col, z0 + LEAF_GAP_MM, top - GRILLE_MM - LEAF_GAP_MM / 2, true);
    f.line("detail", [l + LEAF_GAP_MM, z0 + KICK * 1000], [r - col, z0 + KICK * 1000]);
    const zc = Math.min(z0 + CONTROLS_MM, top - GRILLE_MM - 100);
    displayFront(f, r - col / 2, zc);
  },
  mesh(p, s) {
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    const col = m(columnWidth(s.w * 1000));
    const gy = s.h - m(GRILLE_MM);
    p.box("steel", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, zBody);
    grille(p, -s.w / 2 + 0.01, s.w / 2 - 0.01, gy + GAP, s.h - 0.01, zBody, zLeaf);
    // The control column stands in the door plane beside the door.
    p.box("steel", s.w / 2 - col + GAP, s.w / 2, 0, gy - GAP, zBody, zLeaf - 0.008);
    const yc = Math.min(m(CONTROLS_MM), gy - 0.1);
    p.box("panelDark", s.w / 2 - col + 0.03, s.w / 2 - 0.03, yc - 0.12, yc + 0.08, zLeaf - 0.008, zLeaf - 0.006);
    display(p, s.w / 2 - col / 2 - 0.03, yc + 0.03, zLeaf - 0.006);
    p.knob(s.w / 2 - col / 2, yc - 0.06, zLeaf - 0.006, zLeaf + 0.012, 0.028);
    coolDoor(p, { x0: -s.w / 2, x1: s.w / 2 - col, y0: 0, y1: gy, zBody, zFront: s.d / 2, hinge: "left", handle: "vertical", gripY: 1.1 });
    // Kick plate on the lower door, where the trolley bumps it.
    p.box("steelDark", -s.w / 2 + 0.02, s.w / 2 - col - 0.02, 0.01, KICK, zLeaf, zLeaf + 0.003);
  },
};
