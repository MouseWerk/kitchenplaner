// Mobile tray dispenser (Tablettspender, fahrbar): a spring-loaded platform keeps the top tray
// at the opening, four corner guides hold the stack; on castors.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, castors, castorsFront } from "./common";

/** Height of the corner guides above the body (m) and their size. */
const GUIDES = 0.12;
const GUIDE = 0.03;
/** Trays visible above the body, each with its thickness (m). */
const TRAYS = 4;
const TRAY = 0.02;

export const trayDispenser: KindDef = {
  kind: "trayDispenser",
  plan(s) {
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, s.F - INSET);
    for (const [x, y] of [
      [s.L, s.B],
      [s.R - INSET, s.B],
      [s.L, s.F - INSET],
      [s.R - INSET, s.F - INSET],
    ]) s.rect("detail", x, y, x + INSET, y + INSET);
  },
  elevation(f) {
    castorsFront(f);
    const yb = f.top - GUIDES * 1000;
    f.line("detail", [f.l, yb], [f.r, yb]);
    f.box("detail", f.l, f.l + GUIDE * 1000, yb, f.top);
    f.box("detail", f.r - GUIDE * 1000, f.r, yb, f.top);
    for (let i = 1; i <= TRAYS; i++) f.line("detail", [f.l + FRONT_INSET, yb + TRAY * 1000 * i], [f.r - FRONT_INSET, yb + TRAY * 1000 * i]);
  },
  mesh(p, s) {
    const yb = s.h - GUIDES;
    castors(p, s.w, s.d);
    p.box("rubber", -s.w / 2, s.w / 2, CASTOR.h, CASTOR.h + 0.03, -s.d / 2, s.d / 2);
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, CASTOR.h + 0.03, yb, -s.d / 2 + SHEET, s.d / 2 - SHEET);
    p.box("steelDark", -s.w / 2 + GUIDE, s.w / 2 - GUIDE, yb - 0.002, yb, -s.d / 2 + GUIDE, s.d / 2 - GUIDE);
    // The tray stack, alternating shades so the trays read one by one.
    const tw = s.w / 2 - GUIDE - 0.005;
    const td = s.d / 2 - GUIDE - 0.005;
    for (let i = 0; i < TRAYS; i++) {
      const y = yb + i * TRAY;
      p.box(i % 2 === 0 ? "panelDark" : "knob", -tw, tw, y, y + TRAY, -td, td);
    }
    // Corner guides.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - GUIDE / 2);
        const z = sz * (s.d / 2 - GUIDE / 2);
        p.box("handle", x - GUIDE / 2, x + GUIDE / 2, yb - 0.04, s.h, z - GUIDE / 2, z + GUIDE / 2);
      }
    }
  },
};
