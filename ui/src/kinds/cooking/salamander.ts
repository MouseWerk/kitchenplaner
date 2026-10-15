// Salamander: an overhead grill hung on the wall above the cooking line, heating from above; an
// open cavity at the front with a grid shelf on a drip tray, the controls at the right.

import { INSET, PANEL } from "../parts/elevation";
import { GAP, SHEET, SHELF_PITCH } from "../parts/mesh";
import type { KindDef } from "../types";

/** Width of the control panel at the right (mm). */
const PANEL_W = 120;
/** Depth of the wall bracket behind the housing, and the half width of its side arms (m). */
const BRACKET = 0.05;
const BRACKET_ARM = 0.02;
/** Dark lining of the cavity sides (m). */
const LINING = 0.002;
/** Vent slots in the top: width and pitch (m). */
const VENT_SLOT = 0.01;
const VENT_PITCH = 0.03;

export const salamander: KindDef = {
  kind: "salamander",
  placement: "overhead",
  plan(s) {
    // The cavity and the control panel, seen through the unit from above.
    const panel = Math.min(PANEL_W, s.w / 4);
    s.rect("overhead", s.L + INSET, s.B + INSET + BRACKET * 1000, s.R - panel - INSET / 2, s.F - INSET / 2);
    s.line("overhead", [s.R - panel, s.B + BRACKET * 1000], [s.R - panel, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const panel = Math.min(PANEL_W, f.w / 4);
    const c1 = z0 + (top - z0) * 0.6;
    // The open cavity with the grid shelf, the heater band above it.
    f.box("detail", l + INSET / 2, r - panel - INSET / 2, z0 + INSET / 2, c1, "item-dark");
    f.line("detail", [l + INSET, z0 + (c1 - z0) * 0.35], [r - panel - INSET, z0 + (c1 - z0) * 0.35]);
    f.box("detail", r - panel, r - INSET / 4, z0 + INSET / 2, top - INSET / 2);
    const kr = Math.min(PANEL / 4, panel / 4);
    for (let i = 1; i <= 2; i++) f.circle("detail", r - panel / 2, top - ((top - z0) / 3) * i, kr);
  },
  mesh(p, s) {
    const panelW = Math.min(PANEL_W / 1000, s.w / 4);
    const zb = -s.d / 2 + BRACKET;
    const zf = s.d / 2;
    const cavity = s.h * 0.6;
    // The wall bracket: a plate on the wall and an arm at each side carrying the housing, so
    // from the side the unit reads as hung on the wall.
    p.box("steelDark", -s.w / 2 + BRACKET_ARM, s.w / 2 - BRACKET_ARM, s.h * 0.15, s.h - 0.02, -s.d / 2, -s.d / 2 + SHEET);
    for (const sx of [-1, 1]) {
      const x = sx * (s.w / 2 - BRACKET_ARM);
      p.box("steelDark", x - BRACKET_ARM, x + BRACKET_ARM, s.h * 0.15, s.h - 0.02, -s.d / 2 + SHEET, zb);
    }
    p.box("steel", -s.w / 2, s.w / 2, cavity, s.h, zb, zf);
    p.box("steel", -s.w / 2, -s.w / 2 + SHEET, 0, cavity, zb, zf);
    p.box("steel", s.w / 2 - panelW - SHEET, s.w / 2, 0, cavity, zb, zf - 0.015);
    p.box("steel", -s.w / 2, s.w / 2, 0, SHEET, zb, zf);
    // The cavity is dark inside (back wall and side linings), so the opening reads from afar.
    const c0 = -s.w / 2 + SHEET;
    const c1 = s.w / 2 - panelW - SHEET;
    p.box("top", c0, c1, SHEET, cavity, zb, zb + SHEET);
    p.box("top", c0, c0 + LINING, SHEET, cavity, zb + SHEET, zf - 0.005);
    p.box("top", c1 - LINING, c1, SHEET, cavity, zb + SHEET, zf - 0.005);
    // Vent slots at the back of the top, where the heat leaves the housing.
    const slots = Math.max(3, Math.floor((s.w - panelW) / VENT_PITCH));
    for (let i = 0; i < slots; i++) {
      const x = -s.w / 2 + VENT_PITCH * (i + 0.5);
      p.box("slot", x - VENT_SLOT / 2, x + VENT_SLOT / 2, s.h - 0.004, s.h, zb + 0.03, zb + 0.09);
    }
    // The heater under the top of the cavity.
    p.box("zone", -s.w / 2 + SHEET * 2, s.w / 2 - panelW - SHEET * 2, cavity - 0.015, cavity - 0.002, zb + SHEET, zf - 0.03);
    // Drip tray and the grid shelf with its handle.
    p.tub("steelDark", -s.w / 2 + SHEET, s.w / 2 - panelW - SHEET, SHEET, SHEET + 0.025, zb + SHEET, zf - 0.01, SHEET / 2);
    const gy = cavity * 0.35;
    p.grid(-s.w / 2 + SHEET * 2, s.w / 2 - panelW - SHEET * 2, gy - 0.008, gy, zb + SHEET * 2, zf - 0.03, SHELF_PITCH);
    p.rod("handle", "x", -panelW / 2, gy - 0.004, zf - 0.015, s.w - panelW - 0.12, 0.006);
    // Control panel with two knobs and a pilot light.
    const px = s.w / 2 - panelW / 2;
    const zFace = zf - 0.015;
    p.box("panelDark", s.w / 2 - panelW + GAP, s.w / 2 - GAP, GAP, cavity - GAP, zFace, zFace + 0.002);
    p.knob(px, cavity * 0.75, zFace + 0.002, zf);
    p.knob(px, cavity * 0.45, zFace + 0.002, zf);
    p.rod("zone", "z", px, cavity * 0.2, zFace + 0.006, 0.008, 0.006);
  },
};
