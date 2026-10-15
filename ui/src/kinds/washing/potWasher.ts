// Pot and utensil washer (Topf- und Utensilienspülmaschine): a tall front loader for pots, GN
// containers, trays and baking sheets. The wash tank behind a fixed panel at the bottom, a large
// drop-down door with a long grip bar along its top, the control panel above the door and the
// steam condenser behind the grille at the top. In the plan the dropped door lies in front.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { CONTROLS, DOOR, GAP, PLINTH, plinth, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Height of the condenser section with its grille at the top (m). */
const CONDENSER = 0.14;
/** Height of the door's lower edge (the loading level) above the floor (m). */
const SILL = 0.5;
/** Slats of the grille. */
const SLATS = 5;
/** How far the grip bar stands out of the door, and its distance below the door's top (m). */
const GRIP_REACH = 0.04;
const GRIP_DROP = 0.07;

/** Loading level and door top of a unit of height `h` (m), kept apart on a low resized unit. */
function doorSpan(h: number): { sill: number; top: number } {
  const top = h - CONDENSER - CONTROLS;
  return { sill: Math.min(SILL, top * 0.35), top };
}

export const potWasher: KindDef = {
  kind: "potWasher",
  plan(s) {
    // The basket inside (hidden) and the dropped door in front of the unit.
    const basket = Math.min(650, s.w - 2 * INSET, s.d - 2 * INSET);
    s.rect("hidden", -basket / 2, -basket / 2, basket / 2, basket / 2);
    const d = doorSpan(s.item.height / 1000);
    const open = Math.min(s.w, (d.top - d.sill) * 1000);
    s.rect("opening", s.L + INSET / 2, s.F, s.R - INSET / 2, s.F + open);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const d = doorSpan(f.item.height / 1000);
    const sill = z0 + d.sill * 1000;
    const panel = z0 + d.top * 1000;
    const grille = top - CONDENSER * 1000;
    // The fixed panel in front of the tank, the door with its grip bar, the panel, the grille.
    f.box("detail", l + I / 4, r - I / 4, z0 + FEET * 0.7, sill - I / 4);
    f.box("detail", l + I / 4, r - I / 4, sill, panel - I / 4);
    f.line("detail", [l + I * 2, panel - GRIP_DROP * 1000], [r - I * 2, panel - GRIP_DROP * 1000]);
    f.box("detail", l + I / 4, r - I / 4, panel, grille - I / 4);
    f.box("detail", l + I, l + I * 6, panel + I / 2, grille - I);
    for (let i = 1; i <= SLATS; i++) {
      const z = grille + ((top - grille) * i) / (SLATS + 1);
      f.line("detail", [l + I, z], [r - I, z]);
    }
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const grille = s.h - CONDENSER;
    const { sill, top: panel } = doorSpan(s.h);
    const zFace = zf - GRIP_REACH;
    plinth(p, s.w, s.d);
    p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h - SHEET, -s.d / 2, zFace - DOOR);
    p.box("steelDark", -s.w / 2, s.w / 2, s.h - SHEET, s.h, -s.d / 2, zFace - DOOR);
    // The fixed panel in front of the tank.
    p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, PLINTH + GAP, sill - GAP, zFace - DOOR, zFace - DOOR / 2);
    // The door: hinged at the bottom (the hinge pins show at its lower corners), a gasket line
    // round it and the grip bar on two arms along its top.
    p.box("rubber", -s.w / 2 + GAP / 2, s.w / 2 - GAP / 2, sill, panel, zFace - DOOR, zFace - DOOR + 0.002);
    p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, sill + GAP, panel - GAP, zFace - DOOR, zFace);
    for (const sx of [-1, 1]) p.rod("steelDark", "x", sx * (s.w / 2 - 0.03), sill + 0.025, zFace - DOOR / 2, 0.04, 0.012);
    const gy = panel - GRIP_DROP;
    const gx = s.w / 2 - 0.08;
    p.rod("handle", "x", 0, gy, zf - 0.012, 2 * gx, 0.012);
    for (const sx of [-1, 1]) p.rod("handle", "z", sx * gx, gy, (zFace + zf - 0.012) / 2, zf - 0.012 - zFace, 0.01);
    // Control panel: display and two buttons.
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, panel + GAP, grille - GAP, zFace - DOOR, zFace);
    const yc = (panel + grille) / 2;
    p.box("glassDark", -s.w / 2 + 0.05, -s.w / 2 + 0.25, yc - 0.025, yc + 0.025, zFace, zFace + 0.003);
    for (let i = 0; i < 2; i++) p.rod("knob", "z", s.w / 2 - 0.06 - i * 0.07, yc, zFace + 0.005, 0.01, 0.018);
    // Condenser grille: slats over a dark opening.
    p.box("panelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, grille + 0.02, s.h - 0.02, zFace - DOOR, zFace - DOOR + 0.002);
    for (let i = 1; i <= SLATS; i++) {
      const y = grille + ((s.h - grille) * i) / (SLATS + 1);
      p.box("steel", -s.w / 2 + 0.03, s.w / 2 - 0.03, y - 0.005, y + 0.005, zFace - DOOR, zFace - DOOR / 2);
    }
  },
};
