// Mobile tray dispenser (Tablettspender, fahrbar): a spring-loaded platform keeps the top tray
// at the opening, four corner guides hold the stack; on castors.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bumper, CASTOR, castors, castorsFront, ratingPlate, trayStack } from "./common";

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
    bumper(p, -s.w / 2, s.w / 2, CASTOR.h, CASTOR.h + 0.03, -s.d / 2, s.d / 2);
    p.roundedBox("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, CASTOR.h + 0.03, yb, -s.d / 2 + SHEET, s.d / 2 - SHEET, BODY_RADIUS * 4, "vertical");
    // The opening at the top with its rolled edge and the spring platform's dark gap round the
    // stack.
    p.lathe(
      "satin",
      0,
      yb - 0.012,
      0,
      [
        [0, 0],
        [0.012, 0],
        [0.012, 0.01],
        [0.006, 0.014],
        [0, 0.012],
        [0, 0],
      ],
      { rect: [s.w / 2 - SHEET - 0.012, s.d / 2 - SHEET - 0.012] },
    );
    p.box("slot", -s.w / 2 + GUIDE, s.w / 2 - GUIDE, yb - 0.004, yb - 0.002, -s.d / 2 + GUIDE, s.d / 2 - GUIDE);
    // The tray stack, reaching down into the body.
    const tw = s.w / 2 - GUIDE - 0.005;
    const td = s.d / 2 - GUIDE - 0.005;
    trayStack(p, -tw, tw, yb - 0.04, -td, td, TRAYS + 2, TRAY);
    // Corner guides: angle profiles standing in the corners, rounded at their tops.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - GUIDE / 2);
        const z = sz * (s.d / 2 - GUIDE / 2);
        p.roundedBox("handle", x - GUIDE / 2, x + GUIDE / 2, yb - 0.06, s.h, z - GUIDE / 2, z + GUIDE / 2, 0.006, "top");
      }
    }
    ratingPlate(p, 0, CASTOR.h + 0.09, s.d / 2 - SHEET);
  },
};
