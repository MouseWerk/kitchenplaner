// Blast chiller / shock freezer (Schockkühler, Schockfroster) for GN 1/1 trays: one door hinged on
// the left under a control panel with a large display, a dial and the socket of the core
// probe. The under-counter size has its machine behind a grille at the bottom, the tall one on top.

import { INSET } from "../parts/elevation";
import { BODY_RADIUS, foot, GAP, PLINTH, plinth, type Parts, type Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { BASE_MM as BASE, CABINET_RADIUS, coolDoor, doorFront, doorSwings, FRONT, grille, grilleFront, LEAF_GAP_MM, m, pushButton, STANDOFF } from "./common";

/** Height from which the machine sits on top instead of at the bottom (mm). */
const MACHINE_ON_TOP_FROM = 1200;
/** Height of the machine grille and of the control panel (mm). */
const GRILLE_MM = 120;
const PANEL_MM = 150;
/** Height of the small feet of a table-top unit (mm). */
const SMALL_FEET_MM = 30;
/** Size of the display on the control panel (mm). */
const SCREEN = { w: 170, h: 70 };

/** Heights of the parts of the front (mm above the item's elevation): grille, panel and door. */
function layout(height: number, feet = true) {
  const top = height >= MACHINE_ON_TOP_FROM;
  const BASE_MM = feet ? BASE : SMALL_FEET_MM;
  const panel1 = top ? height - GRILLE_MM : height;
  const panel0 = panel1 - PANEL_MM;
  const grille0 = top ? height - GRILLE_MM : BASE_MM;
  const grille1 = top ? height : BASE_MM + GRILLE_MM;
  const door0 = top ? BASE_MM : grille1;
  return { panel0, panel1, grille0, grille1, door0, door1: panel0 };
}

function blastKind(kind: string, feet: boolean): KindDef {
  return {
    kind,
    placement: feet ? "floor" : "tableTop",
    plan(s) {
      doorSwings(s, 1);
    },
    elevation(f) {
      const { l, r, z0 } = f;
      const k = layout(f.item.height, feet);
      grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + k.grille0 + LEAF_GAP_MM / 2, z0 + k.grille1 - LEAF_GAP_MM / 2);
      f.box("detail", l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + k.panel0, z0 + k.panel1 - LEAF_GAP_MM / 2);
      const zc = z0 + (k.panel0 + k.panel1) / 2;
      const sh = Math.min(SCREEN.h, PANEL_MM * 0.6);
      f.box("detail", l + INSET * 2, l + INSET * 2 + SCREEN.w, zc - sh / 2, zc + sh / 2, "item-dark");
      f.circle("detail", r - INSET * 3, zc, sh / 2);
      f.line("detail", [l, z0 + (feet ? BASE : SMALL_FEET_MM)], [r, z0 + (feet ? BASE : SMALL_FEET_MM)]);
      doorFront(f, l + LEAF_GAP_MM / 2, r - LEAF_GAP_MM / 2, z0 + k.door0, z0 + k.door1 - LEAF_GAP_MM / 2, true);
    },
    mesh(p, s) {
      blastChillerMesh(p, s, feet);
    },
  };
}

export const blastChiller = blastKind("blastChiller", true);
/** The table-top blast chiller for three GN 2/3 or GN 1/1 trays, on small feet. */
export const blastChillerTop = blastKind("blastChillerTop", false);

/**
 * The model of a blast chiller filling the item, on feet (`feet`) or on its own low base (a
 * table-top unit): body, grille, the control panel with the display, the dial and the core
 * probe on its cable, and the door.
 */
function blastChillerMesh(p: Parts, s: Size, feet: boolean): void {
  const k = layout(s.h * 1000, feet);
  const zBody = s.d / 2 - FRONT;
  const zLeaf = s.d / 2 - STANDOFF;
  const y0 = feet ? PLINTH : 0;
  if (feet) plinth(p, s.w, s.d);
  else for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (s.w / 2 - 0.03), sz * (s.d / 2 - FRONT - 0.03), m(SMALL_FEET_MM), 0.015);
  p.roundedBox("steel", -s.w / 2, s.w / 2, feet ? y0 : m(SMALL_FEET_MM), s.h, -s.d / 2, zBody, CABINET_RADIUS, "vertical");
  grille(p, -s.w / 2 + 0.01, s.w / 2 - 0.01, m(k.grille0) + GAP, m(k.grille1) - GAP, zBody, zLeaf);
  // Control panel: display at the left, the dial at the right and the probe socket beside it.
  const py0 = m(k.panel0);
  const py1 = m(k.panel1);
  const yc = (py0 + py1) / 2;
  const zPanel = zLeaf - 0.008;
  p.roundedBox("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, py0 + GAP, py1 - GAP, zBody, zPanel, BODY_RADIUS, "top", "z");
  const sx = -s.w / 2 + m(INSET * 2);
  const sh = Math.min(m(SCREEN.h), (py1 - py0) * 0.6);
  p.plate("glassDark", sx, sx + m(SCREEN.w), yc - sh / 2, yc + sh / 2, zPanel, zPanel + 0.002, 0.004);
  for (let i = 0; i < 3; i++) pushButton(p, sx + m(SCREEN.w) + 0.025 + i * 0.03, yc, zPanel, 0.008);
  p.knob(s.w / 2 - m(INSET * 3), yc, zPanel, zLeaf + 0.01, Math.min(0.03, sh / 2));
  // The core probe: a socket in the panel with the probe's grip hanging in it on a coiled cable.
  const px = s.w / 2 - m(INSET * 6);
  p.lathe("satin", px, yc, zPanel, [
    [0, 0],
    [0.012, 0],
    [0.012, 0.003],
    [0.009, 0.005],
    [0.009, 0.012],
    [0, 0.012],
  ], { axis: "z" });
  coolDoor(p, { x0: -s.w / 2, x1: s.w / 2, y0: m(k.door0), y1: m(k.door1), zBody, zFront: s.d / 2, hinge: "left", handle: "vertical" });
}
