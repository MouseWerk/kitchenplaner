// Pass (Ausgabepass): an open table, served from both sides, with a heated glass ceramic plate in
// its top and plate stacks on the undershelf. The heat lamps above it are their own unit.

import { INSET as FRONT_INSET, TOP as FRONT_TOP, UNDERSHELF as FRONT_UNDERSHELF } from "../parts/elevation";
import { HANDLE, openFrame, SHEET, TOP, UNDERSHELF, type Hole } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Margin of the heated plate from the edges of the top (mm). */
const PLATE_MARGIN = 80;
/** Plate stacks on the undershelf: pitch, plate radius and stack height (m). */
const STACK_PITCH = 0.32;
const PLATE_R = 0.135;
const STACK_H = 0.16;

export const passCounter: KindDef = {
  kind: "passCounter",
  plan(s) {
    s.rect("detail", s.L + PLATE_MARGIN, s.B + PLATE_MARGIN, s.R - PLATE_MARGIN, s.F - PLATE_MARGIN);
    // Heat zones marked on the plate.
    const n = Math.max(1, Math.floor((s.w - 2 * PLATE_MARGIN) / 600));
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
    // A control box with its switch under the top at the right.
    f.box("detail", f.r - FRONT_INSET * 6, f.r - FRONT_INSET * 1.5, f.top - FRONT_TOP - FRONT_INSET * 3, f.top - FRONT_TOP, "item-dark");
  },
  mesh(p, s) {
    const m = PLATE_MARGIN / 1000;
    const hole: Hole = { x0: -s.w / 2 + m, x1: s.w / 2 - m, z0: -s.d / 2 + m, z1: s.d / 2 - m };
    openFrame(p, s, s.h - TOP);
    p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, [hole]);
    // The heated plate lies flush in the top, the heating box under it.
    p.box("ceramic", hole.x0, hole.x1, s.h - 0.008, s.h, hole.z0, hole.z1);
    p.box("steelDark", hole.x0, hole.x1, s.h - TOP - 0.06, s.h - 0.008, hole.z0, hole.z1);
    // Control box with a switch at the right of the front.
    const cx = s.w / 2 - 0.12;
    p.box("panelDark", cx - 0.08, cx + 0.08, s.h - TOP - 0.12, s.h - TOP, s.d / 2 - 0.06, s.d / 2 - HANDLE);
    p.knob(cx, s.h - TOP - 0.06, s.d / 2 - HANDLE, s.d / 2);
    // Plate stacks on the undershelf.
    const n = Math.max(1, Math.floor((s.w - 0.08) / STACK_PITCH));
    const pitch = (s.w - 0.08) / n;
    const y0 = UNDERSHELF + SHEET * 2;
    for (let i = 0; i < n; i++) {
      const x = -s.w / 2 + 0.04 + pitch * (i + 0.5);
      const r = Math.min(PLATE_R, pitch / 2 - 0.01, s.d / 2 - 0.06);
      p.cyl("panel", x, 0, y0, y0 + STACK_H, r * 0.75);
      p.cyl("panel", x, 0, y0 + STACK_H - 0.01, y0 + STACK_H, r);
    }
  },
};
