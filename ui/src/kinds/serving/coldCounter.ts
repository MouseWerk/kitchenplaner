// Refrigerated food counter (Kühlausgabe): cooled Gastronorm wells under a glass display with a
// middle shelf, the machine compartment at the left and cooled doors on the staff side (front).

import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, DOOR_WIDTH, doors, GAP, HANDLE, PLINTH, SHEET, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, GN_LONG, holesOf, planWells, sneezeGuard, sneezeGuardFront, wellPans, wellRow } from "./common";

/** Height of the glass display over the top (mm). */
const DISPLAY_RISE = 500;
/** Space between the back edge and the wells, where the display's back pane stands (mm). */
const BACK_SPACE = 100;
/** Width of the machine compartment (m) and of the louvre slats in it. */
const MACHINE = 0.4;
const LOUVRES = 5;

function wells(width: number, depth: number) {
  const y0 = -depth / 2 + BACK_SPACE;
  return wellRow(width, y0, Math.min(y0 + GN_LONG, depth / 2 - INSET * 2));
}

export const coldCounter: KindDef = {
  kind: "coldCounter",
  rise: DISPLAY_RISE,
  plan(s) {
    const ws = wells(s.w, s.d);
    planWells(s, ws);
    // The display's glass top covers the wells.
    s.rect("hidden", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, ws[0].y1);
  },
  elevation(f) {
    const { l, top, z0 } = f;
    const I = FRONT_INSET;
    f.worktop();
    const machine = Math.min(MACHINE * 1000, f.w * 0.3);
    f.box("detail", l + I, l + machine - I / 2, z0 + FEET, top - FRONT_TOP - I, "item-dark");
    const dr = f.r;
    const n = Math.max(1, Math.round((f.w - machine) / (DOOR_WIDTH * 1000)));
    const dw = (dr - l - machine - I * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const a = l + machine + I + i * (dw + I);
      f.box("detail", a, a + dw, z0 + FEET, top - FRONT_TOP - I);
      f.line("detail", [a + dw / 4, top - FRONT_TOP - I * 2.5], [a + (dw * 3) / 4, top - FRONT_TOP - I * 2.5]);
    }
    sneezeGuardFront(f, DISPLAY_RISE);
    f.line("detail", [l + I, top + DISPLAY_RISE * 0.6], [f.r - I, top + DISPLAY_RISE * 0.6]);
  },
  mesh(p, s, item) {
    const ws = wells(item.width, item.depth);
    const holes = holesOf(ws);
    counterBody(p, s, holes);
    wellPans(p, holes, s.h, ["foodGreen", "foodCream", "foodRed", "foodCream"]);
    // Machine compartment with a louvre at the left, cooled doors to its right.
    const machine = Math.min(MACHINE, s.w * 0.3);
    const x1 = -s.w / 2 + machine;
    const yt = s.h - TOP;
    p.box("panelDark", -s.w / 2 + GAP, x1 - GAP, PLINTH + GAP, yt - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
    for (let i = 1; i <= LOUVRES; i++) {
      const y = PLINTH + ((yt - PLINTH) * i) / (LOUVRES + 1);
      p.box("steelDark", -s.w / 2 + 0.04, x1 - 0.04, y - 0.006, y + 0.006, s.d / 2 - HANDLE, s.d / 2 - HANDLE + 0.004);
    }
    doors(p, x1, s.w / 2, PLINTH, yt, s.d, Math.max(1, Math.round((s.w - machine) / DOOR_WIDTH)), "top");
    // The display: back pane and glass top as a guard, and a glass middle shelf on the posts.
    const rise = DISPLAY_RISE / 1000;
    const zFront = ws[0].y1 / 1000;
    sneezeGuard(p, s.w, s.h, rise, -s.d / 2 + 0.03, -s.d / 2 + GAP, zFront);
    p.box("glass", -s.w / 2 + 0.06, s.w / 2 - 0.06, s.h + rise * 0.6, s.h + rise * 0.6 + SHEET, -s.d / 2 + 0.05, -s.d / 2 + 0.3);
  },
};
