// Refrigerated food counter (Kühlausgabe): cooled Gastronorm wells under a glass display with a
// middle shelf and a light, the machine compartment behind a louvre at the left and cooled doors
// on the staff side (front).

import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, DOOR_WIDTH, GAP, PLINTH, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, dish, GLASS, GN_LONG, holesOf, leafDoors, pilotLamp, planWells, ratingPlate, sneezeGuard, sneezeGuardFront, wellPans, wellRow } from "./common";
import { ventSlots } from "../parts/details";

/** Height of the glass display over the top (mm). */
const DISPLAY_RISE = 500;
/** Space between the back edge and the wells, where the display's back pane stands (mm). */
const BACK_SPACE = 100;
/** Width of the machine compartment (m) and of the louvre slots in it. */
const MACHINE = 0.4;
const LOUVRES = 7;
/** Depth of the middle shelf from the back (m) and its height share of the display. */
const SHELF_DEPTH = 0.3;
const SHELF_LEVEL = 0.6;

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
    f.line("detail", [l + I, top + DISPLAY_RISE * SHELF_LEVEL], [f.r - I, top + DISPLAY_RISE * SHELF_LEVEL]);
  },
  mesh(p, s, item) {
    const ws = wells(item.width, item.depth);
    const holes = holesOf(ws);
    const zBody = s.d / 2 - DOOR;
    const zFace = s.d / 2 - DOOR / 2;
    counterBody(p, s, holes, "steel", zBody);
    wellPans(p, holes, s.h, ["foodGreen", "foodCream", "foodRed", "foodCream"], false);
    // Machine compartment behind a louvre at the left, with the display and the pilot lamp.
    const machine = Math.min(MACHINE, s.w * 0.3);
    const x1 = -s.w / 2 + machine;
    const yt = s.h - TOP;
    p.roundedBox("panelDark", -s.w / 2 + GAP, x1 - GAP, PLINTH + GAP, yt - GAP, zBody, zFace, 0.002, "top", "z");
    ventSlots(p, -s.w / 2 + 0.05, x1 - 0.05, PLINTH + 0.05, yt - 0.16, zFace, LOUVRES);
    p.plate("glassDark", -s.w / 2 + 0.05, -s.w / 2 + 0.15, yt - 0.09, yt - 0.055, zFace, zFace + 0.001, 0.003);
    pilotLamp(p, x1 - 0.06, yt - 0.072, zFace, "foodGreen");
    leafDoors(p, x1, s.w / 2, PLINTH, yt, zBody, zFace, s.d / 2, Math.max(1, Math.round((s.w - machine) / DOOR_WIDTH)), "top", true);
    ratingPlate(p, s.w / 2 - 0.08, PLINTH + 0.06, zFace);
    // The display: back pane, glass top with the light under it, a glass middle shelf with
    // desserts on it.
    const rise = DISPLAY_RISE / 1000;
    const zFront = ws[0].y1 / 1000;
    sneezeGuard(p, s.w, s.h, rise, { zPost: -s.d / 2 + 0.03, z0: -s.d / 2 + GAP, z1: zFront, light: "light" });
    const ys = s.h + rise * SHELF_LEVEL;
    const sz1 = -s.d / 2 + SHELF_DEPTH;
    p.roundedBox("glass", -s.w / 2 + 0.06, s.w / 2 - 0.06, ys, ys + GLASS, -s.d / 2 + 0.05, sz1, 0.002, "vertical");
    const n = Math.max(1, Math.floor((s.w - 0.2) / 0.22));
    for (let i = 0; i < n; i++) {
      const x = -s.w / 2 + 0.1 + ((s.w - 0.2) / n) * (i + 0.5);
      dish(p, x, ys + GLASS, (-s.d / 2 + 0.05 + sz1) / 2, 0.08, i % 2 === 0 ? "foodCream" : "foodRed");
    }
  },
};
