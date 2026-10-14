// Blast chiller / shock freezer (Schockkühler, Schockfroster) for GN 1/1 trays: one door hinged on
// the left under a control panel with a large display, a dial and the socket of the core
// probe. The under-counter size has its machine behind a grille at the bottom, the tall one on top.

import { INSET } from "../parts/elevation";
import { GAP, PLINTH, plinth } from "../parts/mesh";
import type { KindDef } from "../types";
import { BASE_MM, coolDoor, doorFront, doorSwings, FRONT, grille, grilleFront, LEAF_GAP_MM, m, STANDOFF } from "./common";

/** Height from which the machine sits on top instead of at the bottom (mm). */
const MACHINE_ON_TOP_FROM = 1200;
/** Height of the machine grille and of the control panel (mm). */
const GRILLE_MM = 120;
const PANEL_MM = 150;
/** Size of the display on the control panel (mm). */
const SCREEN = { w: 170, h: 70 };

/** Heights of the parts of the front (mm above the item's elevation): grille, panel and door. */
function layout(height: number) {
  const top = height >= MACHINE_ON_TOP_FROM;
  const panel1 = top ? height - GRILLE_MM : height;
  const panel0 = panel1 - PANEL_MM;
  const grille0 = top ? height - GRILLE_MM : BASE_MM;
  const grille1 = top ? height : BASE_MM + GRILLE_MM;
  const door0 = top ? BASE_MM : grille1;
  return { panel0, panel1, grille0, grille1, door0, door1: panel0 };
}

export const blastChiller: KindDef = {
  kind: "blastChiller",
  plan(s) {
    doorSwings(s, 1);
  },
  elevation(f) {
    const { l, r, z0 } = f;
    const k = layout(f.item.height);
    grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + k.grille0 + LEAF_GAP_MM / 2, z0 + k.grille1 - LEAF_GAP_MM / 2);
    f.box("detail", l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + k.panel0, z0 + k.panel1 - LEAF_GAP_MM / 2);
    const zc = z0 + (k.panel0 + k.panel1) / 2;
    f.box("detail", l + INSET * 2, l + INSET * 2 + SCREEN.w, zc - SCREEN.h / 2, zc + SCREEN.h / 2, "item-dark");
    f.circle("detail", r - INSET * 3, zc, SCREEN.h / 2);
    f.line("detail", [l, z0 + BASE_MM], [r, z0 + BASE_MM]);
    doorFront(f, l + LEAF_GAP_MM / 2, r - LEAF_GAP_MM / 2, z0 + k.door0, z0 + k.door1 - LEAF_GAP_MM / 2, true);
  },
  mesh(p, s) {
    const k = layout(s.h * 1000);
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    plinth(p, s.w, s.d);
    p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, zBody);
    grille(p, -s.w / 2 + 0.01, s.w / 2 - 0.01, m(k.grille0) + GAP, m(k.grille1) - GAP, zBody, zLeaf);
    // Control panel: display at the left, the dial at the right and the core probe beside it.
    const y0 = m(k.panel0);
    const y1 = m(k.panel1);
    const yc = (y0 + y1) / 2;
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, y0 + GAP, y1 - GAP, zBody, zLeaf - 0.008);
    const sx = -s.w / 2 + m(INSET * 2);
    p.box("glassDark", sx, sx + m(SCREEN.w), yc - m(SCREEN.h) / 2, yc + m(SCREEN.h) / 2, zLeaf - 0.008, zLeaf - 0.005);
    p.knob(s.w / 2 - m(INSET * 3), yc, zLeaf - 0.008, zLeaf + 0.01, 0.03);
    p.cyl("knob", s.w / 2 - m(INSET * 6), zLeaf - 0.002, yc - 0.015, yc + 0.015, 0.012);
    coolDoor(p, { x0: -s.w / 2, x1: s.w / 2, y0: m(k.door0), y1: m(k.door1), zBody, zFront: s.d / 2, hinge: "left", handle: "vertical" });
  },
};
