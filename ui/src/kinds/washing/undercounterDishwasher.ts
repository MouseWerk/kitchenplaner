// Front-loading dishwasher under a counter (Untertischspülmaschine) and glass washer
// (Gläserspülmaschine): a closed body with a drop-down door, the control panel above the door.
// In the plan the open door lies in front of the unit (it needs that room to load the rack).

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { CONTROLS, DOOR, GAP, HANDLE, PLINTH, plinth, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Height of the control panel above the door (m). */
const PANEL = 0.08;

export const undercounterDishwasher: KindDef = {
  kind: "undercounterDishwasher",
  plan(s) {
    // The rack inside (hidden) and the dropped door in front of the unit.
    const rack = Math.min(500, s.w - 2 * INSET, s.d - 2 * INSET);
    s.rect("hidden", -rack / 2, -rack / 2, rack / 2, rack / 2);
    const open = Math.min(s.w, s.item.height - (PLINTH + PANEL) * 1000);
    s.rect("opening", s.L + INSET / 2, s.F, s.R - INSET / 2, s.F + open);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const c = (l + r) / 2;
    const panel = top - PANEL * 1000;
    f.box("detail", l + I / 4, r - I / 4, z0 + FEET * 0.6, panel - I / 4);
    f.line("detail", [c - I * 3, panel - I * 1.5], [c + I * 3, panel - I * 1.5]);
    f.box("detail", l + I / 4, r - I / 4, panel, top - I / 4);
    f.box("detail", l + I, l + I * 4, panel + I / 2, top - I / 2);
    f.circle("detail", r - I * 1.5, (panel + top) / 2, I / 3);
  },
  mesh(p, s) {
    const zf = s.d / 2;
    plinth(p, s.w, s.d);
    p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h - SHEET, -s.d / 2, zf - DOOR);
    p.box("steelDark", -s.w / 2, s.w / 2, s.h - SHEET, s.h, -s.d / 2, zf - DOOR);
    // Drop-down door with a recessed grip along its top, the control panel above.
    const panelY = s.h - Math.min(PANEL, CONTROLS);
    p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, PLINTH + GAP, panelY - GAP, zf - DOOR, zf - DOOR / 2);
    p.box("steelDark", -s.w / 2 + 0.04, s.w / 2 - 0.04, panelY - 0.06, panelY - 0.04, zf - DOOR / 2, zf - DOOR / 2 + 0.002);
    p.barHandle("x", -s.w / 2 + 0.06, s.w / 2 - 0.06, panelY - 0.035, zf - DOOR / 2, zf);
    p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, panelY, s.h - GAP, zf - DOOR, zf - HANDLE / 2);
    const yc = (panelY + s.h) / 2;
    p.box("glassDark", -s.w / 2 + 0.04, -s.w / 2 + 0.16, yc - 0.015, yc + 0.015, zf - HANDLE / 2, zf - HANDLE / 2 + 0.003);
    p.rod("knob", "z", s.w / 2 - 0.05, yc, zf - HANDLE / 2 + 0.005, 0.01, 0.014);
    p.rod("knob", "z", s.w / 2 - 0.1, yc, zf - HANDLE / 2 + 0.005, 0.01, 0.01);
  },
};
