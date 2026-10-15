// Pot and utensil washer (Topf- und Utensilienspülmaschine): a tall front loader for pots, GN
// containers, trays and baking sheets. The wash tank behind a fixed panel at the bottom, a large
// drop-down door with a long grip bar along its top, the control panel above the door and the
// steam condenser behind the grille at the top. In the plan the dropped door lies in front.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { CONTROLS, DOOR, DOOR_RADIUS, GAP, PLINTH } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { machineFeet, machinePanel } from "./details";
import { housing, ratingPlate } from "../parts/details";

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
    const zLeaf = zFace - DOOR / 2;
    machineFeet(p, s.w, s.d, zFace - DOOR);
    housing(p, "steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, zFace - DOOR);
    // The fixed panel in front of the tank with the rating plate.
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, PLINTH + GAP, sill - GAP, zFace - DOOR, zLeaf, DOOR_RADIUS, "top", "z");
    ratingPlate(p, s.w / 2 - 0.08, PLINTH + 0.06, zLeaf);
    // The door: hinged at the bottom (the hinge barrels show at its lower corners), its gasket
    // dark in the gap round it and the grip bar on two arms along its top.
    p.plate("rubber", -s.w / 2 + GAP / 2, s.w / 2 - GAP / 2, sill - GAP / 2, panel - GAP / 2, zFace - DOOR - 0.001, zFace - DOOR + 0.002, 0.004);
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, sill + GAP, panel - GAP, zFace - DOOR, zFace, DOOR_RADIUS * 2, "top", "z");
    for (const sx of [-1, 1]) {
      p.lathe("satin", sx * (s.w / 2 - 0.05) - 0.02, sill + 0.02, zFace - DOOR / 2, [
        [0, 0],
        [0.009, 0],
        [0.012, 0.004],
        [0.012, 0.036],
        [0.009, 0.04],
        [0, 0.04],
      ], { axis: "x" });
    }
    p.barHandle("x", -s.w / 2 + 0.08, s.w / 2 - 0.08, panel - GRIP_DROP, zFace, zf);
    // Control panel: display and buttons.
    machinePanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, panel + GAP, grille - GAP, zFace - DOOR, zFace, 4);
    // Condenser grille: slats over a dark opening.
    p.plate("slot", -s.w / 2 + 0.03, s.w / 2 - 0.03, grille + 0.02, s.h - 0.02, zFace - DOOR - 0.0005, zFace - DOOR + 0.001, 0.006);
    for (let i = 1; i <= SLATS; i++) {
      const y = grille + ((s.h - grille) * i) / (SLATS + 1);
      p.roundedBox("steel", -s.w / 2 + 0.03, s.w / 2 - 0.03, y - 0.006, y + 0.006, zFace - DOOR, zLeaf, 0.003, "top", "z");
    }
  },
};
