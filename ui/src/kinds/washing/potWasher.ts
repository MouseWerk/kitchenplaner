// Pot and utensil washer (Topf- und Utensilienspülmaschine): a tall front loader for pots, GN
// containers, trays and baking sheets. A large hinged door with a vertical handle, the control
// panel above it and the steam condenser behind the grille at the top.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { CONTROLS, DOOR, doors, GAP, HANDLE, PLINTH, plinth, SHEET } from "../parts/mesh";
import { frontDoorSwing } from "../parts/plan";
import type { KindDef } from "../types";

/** Height of the condenser section with its grille at the top (m). */
const CONDENSER = 0.14;
/** Slats of the grille. */
const SLATS = 5;

export const potWasher: KindDef = {
  kind: "potWasher",
  plan(s) {
    frontDoorSwing(s);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const grille = top - CONDENSER * 1000;
    const panel = grille - CONTROLS * 1000;
    f.box("detail", l + I / 4, r - I / 4, z0 + FEET * 0.7, panel - I / 4);
    f.line("detail", [r - I * 2, panel - I * 6], [r - I * 2, panel - I * 6 - 500]);
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
    const panel = grille - CONTROLS;
    plinth(p, s.w, s.d);
    p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h - SHEET, -s.d / 2, zf - DOOR);
    p.box("steelDark", -s.w / 2, s.w / 2, s.h - SHEET, s.h, -s.d / 2, zf - DOOR);
    doors(p, -s.w / 2, s.w / 2, PLINTH, panel, s.d, 1, "vertical");
    // A gasket line around the door shows its seal.
    p.box("rubber", -s.w / 2 + GAP, s.w / 2 - GAP, PLINTH, PLINTH + GAP, zf - DOOR, zf - DOOR / 2 + 0.001);
    // Control panel: display and two buttons.
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, panel + GAP, grille - GAP, zf - DOOR, zf - HANDLE / 2);
    const yc = (panel + grille) / 2;
    p.box("glassDark", -s.w / 2 + 0.05, -s.w / 2 + 0.25, yc - 0.025, yc + 0.025, zf - HANDLE / 2, zf - HANDLE / 2 + 0.003);
    for (let i = 0; i < 2; i++) p.rod("knob", "z", s.w / 2 - 0.06 - i * 0.07, yc, zf - HANDLE / 2 + 0.005, 0.01, 0.018);
    // Condenser grille: slats over a dark opening.
    p.box("panelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, grille + 0.02, s.h - 0.02, zf - DOOR, zf - DOOR + 0.002);
    for (let i = 1; i <= SLATS; i++) {
      const y = grille + ((s.h - grille) * i) / (SLATS + 1);
      p.box("steel", -s.w / 2 + 0.03, s.w / 2 - 0.03, y - 0.005, y + 0.005, zf - DOOR, zf - DOOR / 2);
    }
  },
};
