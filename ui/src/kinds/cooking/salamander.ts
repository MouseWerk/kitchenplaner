// Salamander: an overhead grill hung on the wall above the cooking line, heating from above; an
// open cavity at the front with a grid shelf on a drip tray, the controls at the right.

import { INSET, PANEL } from "../parts/elevation";
import { BODY_RADIUS, GAP, SHEET, SHELF_PITCH, type Parts, type Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { pilot, topSlots } from "./details";
import { controlPanel, housing } from "../parts/details";

/** Width of the control panel at the right (mm). */
const PANEL_W = 120;
/** Depth of the wall bracket behind the housing, and the half width of its side arms (m). */
const BRACKET = 0.05;
const BRACKET_ARM = 0.02;
/** Dark lining of the cavity sides (m). */
const LINING = 0.002;
/** Pitch of the vent slots in the top (m). */
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
    salamanderBody(p, s, Math.min(PANEL_W / 1000, s.w / 4));
  },
};

/**
 * The housing of a wall salamander with its open cavity, the wall bracket and the control panel
 * at the right (`panelW` wide), the heater under the top and the grid shelf on its drip tray.
 */
function salamanderBody(p: Parts, s: Size, panelW: number): void {
  const zb = -s.d / 2 + BRACKET;
  const zf = s.d / 2;
  const cavity = s.h * 0.6;
  // The wall bracket: a plate on the wall and an arm at each side carrying the housing, so from
  // the side the unit reads as hung on the wall.
  p.roundedBox("steelDark", -s.w / 2 + BRACKET_ARM, s.w / 2 - BRACKET_ARM, s.h * 0.15, s.h - 0.02, -s.d / 2, -s.d / 2 + SHEET, BODY_RADIUS);
  for (const sx of [-1, 1]) {
    const x = sx * (s.w / 2 - BRACKET_ARM);
    p.roundedBox("steelDark", x - BRACKET_ARM, x + BRACKET_ARM, s.h * 0.15, s.h - 0.02, -s.d / 2 + SHEET, zb + 0.004, BODY_RADIUS);
  }
  // The pressed hood over the cavity, the side cheeks and the bottom with the drip tray.
  housing(p, "steel", -s.w / 2, s.w / 2, cavity, s.h, zb, zf);
  p.roundedBox("steel", -s.w / 2, -s.w / 2 + SHEET, 0, cavity + 0.01, zb, zf, BODY_RADIUS, "vertical");
  p.roundedBox("steel", s.w / 2 - panelW - SHEET, s.w / 2, 0, cavity + 0.01, zb, zf - 0.015, BODY_RADIUS, "vertical");
  p.roundedBox("steel", -s.w / 2, s.w / 2, 0, SHEET, zb, zf, BODY_RADIUS);
  // The cavity is dark inside (back wall and side linings), so the opening reads from afar.
  const c0 = -s.w / 2 + SHEET;
  const c1 = s.w / 2 - panelW - SHEET;
  p.box("top", c0, c1, SHEET, cavity, zb, zb + SHEET);
  p.box("top", c0, c0 + LINING, SHEET, cavity, zb + SHEET, zf - 0.005);
  p.box("top", c1 - LINING, c1, SHEET, cavity, zb + SHEET, zf - 0.005);
  // Vent slots at the back of the top, where the heat leaves the housing.
  const slots = Math.max(3, Math.floor((s.w - panelW) / VENT_PITCH));
  topSlots(p, -s.w / 2 + 0.02, -s.w / 2 + 0.02 + slots * VENT_PITCH * 0.9, zb + 0.03, zb + 0.09, s.h - 0.001, slots);
  // The heater under the top: a dark reflector with the glowing quartz tubes in front of it.
  p.box("top", c0 + SHEET, c1 - SHEET, cavity - 0.012, cavity - 0.002, zb + SHEET, zf - 0.03);
  const tubes = 4;
  for (let i = 0; i < tubes; i++) {
    const z = zb + SHEET + 0.03 + ((zf - 0.06 - zb - SHEET) / (tubes - 1)) * i;
    p.rod("satin", "x", (c0 + c1) / 2, cavity - 0.022, z, c1 - c0 - 0.04, 0.006);
  }
  // Drip tray and the grid shelf with its handle.
  p.tub("steelDark", c0, c1, SHEET, SHEET + 0.025, zb + SHEET, zf - 0.01, SHEET / 2);
  const gy = cavity * 0.35;
  p.grid(c0 + SHEET, c1 - SHEET, gy - 0.008, gy, zb + SHEET * 2, zf - 0.03, SHELF_PITCH);
  const hl = (c1 - c0) * 0.5;
  p.barHandle("x", (c0 + c1) / 2 - hl / 2, (c0 + c1) / 2 + hl / 2, gy - 0.004, zf - 0.03, zf - 0.008);
  // Control panel with two knobs and a pilot light.
  const px = s.w / 2 - panelW / 2;
  const zFace = zf - 0.013;
  controlPanel(p, s.w / 2 - panelW + GAP, s.w / 2 - GAP, GAP, cavity - GAP, zf - 0.015, zFace);
  p.knob(px, cavity * 0.75, zFace, zf);
  p.knob(px, cavity * 0.45, zFace, zf);
  pilot(p, px, cavity * 0.2, zFace);
}

/** The lift-up salamander: width of the column at the back, height of the head (m). */
const LIFT_COLUMN = 0.16;
const LIFT_HEAD = 0.16;

/**
 * Salamander with a lifting head (Salamander mit Hubdecke): the infrared heaters sit in a head
 * that slides up and down a column at the back, over an open base with the grid and the drip
 * tray; the controls on the head's front at the right. Open at the sides, so it reads apart from
 * the closed salamander.
 */
export const salamanderLift: KindDef = {
  kind: "salamanderLift",
  placement: "overhead",
  plan(s) {
    s.rect("overhead", s.L + INSET / 2, s.B + INSET / 2 + BRACKET * 1000, s.R - INSET / 2, s.F - INSET / 2);
    s.line("overhead", [-LIFT_COLUMN * 500, s.B], [-LIFT_COLUMN * 500, s.B + BRACKET * 1000 + 60], [LIFT_COLUMN * 500, s.B + BRACKET * 1000 + 60], [LIFT_COLUMN * 500, s.B]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const c = (l + r) / 2;
    f.box("detail", l, r, top - LIFT_HEAD * 1000, top);
    f.box("detail", r - PANEL_W, r - INSET / 2, top - LIFT_HEAD * 1000 + INSET / 2, top - INSET / 2, "item-dark");
    f.box("detail", c - LIFT_COLUMN * 500, c + LIFT_COLUMN * 500, z0, top - LIFT_HEAD * 1000);
    f.box("detail", l, r, z0, z0 + 40);
    f.line("detail", [l + INSET, z0 + 90], [r - INSET, z0 + 90]);
  },
  mesh(p, s) {
    const zb = -s.d / 2 + BRACKET;
    const zf = s.d / 2;
    const head0 = s.h - LIFT_HEAD;
    // The wall plate and the column the head runs on.
    p.roundedBox("steelDark", -LIFT_COLUMN / 2 - 0.02, LIFT_COLUMN / 2 + 0.02, 0.05, s.h - 0.03, -s.d / 2, -s.d / 2 + SHEET, BODY_RADIUS);
    housing(p, "steel", -LIFT_COLUMN / 2, LIFT_COLUMN / 2, 0, head0 + 0.02, -s.d / 2 + SHEET, zb + 0.06, 0.006);
    p.roundedBox("slot", -0.004, 0.004, 0.08, head0 - 0.02, zb + 0.06, zb + 0.0605, 0.002, "vertical");
    // The base: a shallow tray carrying the grid, on an arm from the column.
    p.roundedBox("steel", -s.w / 2, s.w / 2, 0, 0.03, zb, zf - 0.01, 0.006);
    p.tub("steelDark", -s.w / 2 + 0.02, s.w / 2 - 0.02, 0.012, 0.032, zb + 0.07, zf - 0.03, SHEET / 2);
    p.grid(-s.w / 2 + 0.03, s.w / 2 - 0.03, 0.07, 0.078, zb + 0.08, zf - 0.04, SHELF_PITCH);
    for (const sx of [-1, 1]) p.roundedBox("steel", sx * (s.w / 2 - 0.025) - 0.006, sx * (s.w / 2 - 0.025) + 0.006, 0.03, 0.074, zb + 0.08, zf - 0.04, BODY_RADIUS, "top");
    // The head: a pressed hood with the infrared plates under it and a handle bar at the front.
    housing(p, "steel", -s.w / 2, s.w / 2, head0, s.h, zb, zf - 0.015);
    const nPlates = Math.max(2, Math.round((s.w - PANEL_W / 1000) / 0.2));
    const pw = (s.w - PANEL_W / 1000 - 0.04) / nPlates;
    for (let i = 0; i < nPlates; i++) {
      const x0 = -s.w / 2 + 0.02 + i * pw;
      p.roundedBox("ceramic", x0 + 0.005, x0 + pw - 0.005, head0 - 0.01, head0 + 0.002, zb + 0.03, zf - 0.05, 0.004);
    }
    topSlots(p, -s.w / 2 + 0.05, s.w / 2 - 0.05, zb + 0.02, zb + 0.08, s.h - 0.001, Math.max(6, Math.round(s.w / 0.04)));
    p.barHandle("x", -s.w / 2 + 0.06, s.w / 2 - PANEL_W / 1000 - 0.04, head0 + 0.03, zf - 0.015, zf);
    const px = s.w / 2 - PANEL_W / 2000;
    const zFace = zf - 0.012;
    controlPanel(p, s.w / 2 - PANEL_W / 1000 + 0.01, s.w / 2 - 0.01, head0 + 0.012, s.h - 0.012, zf - 0.015, zFace);
    p.knob(px - 0.025, head0 + LIFT_HEAD / 2, zFace, zf, 0.018);
    pilot(p, px + 0.03, head0 + LIFT_HEAD / 2, zFace);
  },
};
