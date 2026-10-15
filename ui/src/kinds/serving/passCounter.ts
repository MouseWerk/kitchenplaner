// Pass (Ausgabepass): an open table, served from both sides, with a heated glass ceramic plate in
// its top, divided into heat zones with a switch each, and plate stacks on the undershelf. The
// heat lamps above it are their own unit.

import { INSET as FRONT_INSET, TOP as FRONT_TOP, UNDERSHELF as FRONT_UNDERSHELF } from "../parts/elevation";
import { BODY_RADIUS, HANDLE, openFrame, SHEET, TOP, UNDERSHELF, type Hole } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { PANEL_SHEET, pilotLamp, plateStack } from "./common";

/** Margin of the heated plate from the edges of the top (mm). */
const PLATE_MARGIN = 80;
/** Plate stacks on the undershelf: pitch, plate radius and stack height (m). */
const STACK_PITCH = 0.32;
/** Most plate stacks on the undershelf, for the budget (a wide pass spaces them out). */
const MAX_STACKS = 4;
const PLATE_R = 0.135;
const STACK_H = 0.16;
/** One heat zone per this much of the plate's width (mm), the steel strip between two zones (m). */
const ZONE = 600;
const DIVIDER = 0.02;
/** Pitch of the zone switches in the control box (m). */
const SWITCH_PITCH = 0.06;

/** Number of heat zones of a plate of the given width (mm). */
function zones(width: number): number {
  return Math.max(1, Math.floor((width - 2 * PLATE_MARGIN) / ZONE));
}

/** Width of the control box with one switch per zone (m). */
function controlWidth(n: number): number {
  return SWITCH_PITCH * n + 0.04;
}

export const passCounter: KindDef = {
  kind: "passCounter",
  plan(s) {
    s.rect("detail", s.L + PLATE_MARGIN, s.B + PLATE_MARGIN, s.R - PLATE_MARGIN, s.F - PLATE_MARGIN);
    // The steel strips between the heat zones of the plate.
    const n = zones(s.w);
    const zw = (s.w - 2 * PLATE_MARGIN) / n;
    for (let i = 1; i < n; i++) s.line("detail", [s.L + PLATE_MARGIN + i * zw, s.B + PLATE_MARGIN + INSET], [s.L + PLATE_MARGIN + i * zw, s.F - PLATE_MARGIN - INSET]);
  },
  elevation(f) {
    f.worktop();
    f.legsAndUndershelf();
    // Plate stacks on the undershelf.
    const n = Math.max(1, Math.floor((f.w - 2 * FRONT_INSET) / (STACK_PITCH * 1000)));
    const pitch = (f.w - 2 * FRONT_INSET) / n;
    const zs = f.z0 + FRONT_UNDERSHELF;
    const half = Math.min(PLATE_R * 1000, pitch / 2 - 10);
    for (let i = 0; i < n; i++) {
      const cx = f.l + FRONT_INSET + pitch * (i + 0.5);
      f.box("detail", cx - half, cx + half, zs, zs + STACK_H * 1000);
    }
    // A control box with a switch per heat zone under the top at the right.
    const n2 = zones(f.item.width);
    const bx1 = f.r - FRONT_INSET * 1.5;
    const bx0 = bx1 - controlWidth(n2) * 1000;
    const bz0 = f.top - FRONT_TOP - FRONT_INSET * 3;
    f.box("detail", bx0, bx1, bz0, f.top - FRONT_TOP, "item-dark");
    for (let i = 0; i < n2; i++) f.circle("detail", bx0 + 20 + SWITCH_PITCH * 1000 * (i + 0.5), bz0 + FRONT_INSET * 1.5, 12);
  },
  mesh(p, s, item) {
    const m = PLATE_MARGIN / 1000;
    // Square: the heated plate lies flush in it.
    const hole: Hole = { x0: -s.w / 2 + m, x1: s.w / 2 - m, z0: -s.d / 2 + m, z1: s.d / 2 - m, r: 0 };
    openFrame(p, s, s.h - TOP);
    p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, [hole]);
    // The heated plate lies flush in the top, one glass ceramic field per heat zone with a steel
    // strip between them, the heating box under it.
    const zn = zones(item.width);
    const zw = (hole.x1 - hole.x0) / zn;
    for (let i = 0; i < zn; i++) {
      const a = hole.x0 + i * zw;
      const x0 = a + (i > 0 ? DIVIDER / 2 : 0);
      const x1 = a + zw - (i < zn - 1 ? DIVIDER / 2 : 0);
      p.roundedBox("ceramic", x0, x1, s.h - 0.008, s.h - 0.001, hole.z0, hole.z1, 0.002, "top");
      // The printed mark of the heated field in each zone.
      p.roundedBox("zone", x0 + 0.06, x1 - 0.06, s.h - 0.001, s.h, hole.z0 + 0.06, hole.z1 - 0.06, 0.02, "vertical");
      if (i > 0) p.box("steel", a - DIVIDER / 2, a + DIVIDER / 2, s.h - 0.008, s.h - 0.001, hole.z0, hole.z1);
    }
    p.box("steelDark", hole.x0, hole.x1, s.h - TOP - 0.06, s.h - 0.008, hole.z0, hole.z1);
    // Control box with a switch and a pilot lamp per zone at the right of the front.
    const bx1 = s.w / 2 - (FRONT_INSET * 1.5) / 1000;
    const bx0 = bx1 - controlWidth(zn);
    const zf = s.d / 2 - HANDLE;
    p.roundedBox("steel", bx0, bx1, s.h - TOP - 0.12, s.h - TOP, s.d / 2 - 0.08, zf, BODY_RADIUS * 2);
    p.plate("panelDark", bx0 + 0.005, bx1 - 0.005, s.h - TOP - 0.115, s.h - TOP - 0.005, zf, zf + PANEL_SHEET, 0.004);
    for (let i = 0; i < zn; i++) {
      const x = bx0 + 0.02 + SWITCH_PITCH * (i + 0.5);
      p.knob(x, s.h - TOP - 0.07, zf + PANEL_SHEET, s.d / 2, 0.016);
      pilotLamp(p, x, s.h - TOP - 0.025, zf + PANEL_SHEET, "oil", 0.005);
    }
    // Plate stacks on the undershelf.
    const n = Math.max(1, Math.min(MAX_STACKS, Math.floor((s.w - 0.08) / STACK_PITCH)));
    const pitch = (s.w - 0.08) / n;
    const y0 = UNDERSHELF + SHEET * 2;
    for (let i = 0; i < n; i++) {
      const x = -s.w / 2 + 0.04 + pitch * (i + 0.5);
      const r = Math.min(PLATE_R, pitch / 2 - 0.01, s.d / 2 - 0.06);
      plateStack(p, x, y0, 0, r, STACK_H);
    }
  },
};
