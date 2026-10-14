// Under-counter refrigerator or freezer (Unterbaukühlschrank): a worktop on a cooled cabinet, the
// machine behind a grille at the bottom (front-ventilated, so it fits under a counter), a control
// strip under the top and one door per 600 mm.

import { TOP as FRONT_TOP } from "../parts/elevation";
import { PLINTH, plinth, TOP } from "../parts/mesh";
import type { KindDef } from "../types";
import { BASE_MM, coolDoor, display, displayFront, doorFront, doorSwings, FRONT, grille, grilleFront, hingeLeft, LEAF_GAP_MM, m, STANDOFF } from "./common";

/** Height of the machine grille above the base, and of the control strip under the top (mm). */
const GRILLE_MM = 110;
const STRIP_MM = 70;
/** Width of one door (mm). */
const DOOR_MM = 600;

const doorsOf = (width: number) => Math.max(1, Math.round(width / DOOR_MM));

export const underCounterFridge: KindDef = {
  kind: "underCounterFridge",
  plan(s) {
    doorSwings(s, doorsOf(s.w));
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.worktop();
    const g0 = z0 + BASE_MM;
    const d0 = g0 + GRILLE_MM;
    const d1 = top - FRONT_TOP - STRIP_MM;
    grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, g0, d0 - LEAF_GAP_MM);
    displayFront(f, r - 100, d1 + STRIP_MM / 2);
    f.line("detail", [l, d1], [r, d1]);
    const n = doorsOf(f.w);
    const dw = f.w / n;
    for (let i = 0; i < n; i++) {
      const a = l + i * dw + LEAF_GAP_MM / 2;
      doorFront(f, a, a + dw - LEAF_GAP_MM, d0, d1 - LEAF_GAP_MM, hingeLeft(i, n));
    }
  },
  mesh(p, s) {
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    plinth(p, s.w, s.d);
    p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h - TOP, -s.d / 2, zBody);
    p.box("steel", -s.w / 2, s.w / 2, s.h - TOP, s.h, -s.d / 2, s.d / 2);
    const d0 = PLINTH + m(GRILLE_MM);
    const d1 = s.h - TOP - m(STRIP_MM);
    grille(p, -s.w / 2 + 0.01, s.w / 2 - 0.01, PLINTH, d0 - 0.01, zBody, zLeaf);
    p.box("panelDark", -s.w / 2, s.w / 2, d1, s.h - TOP, zBody, zLeaf - 0.006);
    display(p, s.w / 2 - 0.13, d1 + m(STRIP_MM) / 2, zLeaf - 0.006);
    const n = doorsOf(s.w * 1000);
    const dw = s.w / n;
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + i * dw;
      coolDoor(p, { x0, x1: x0 + dw, y0: d0, y1: d1, zBody, zFront: s.d / 2, hinge: hingeLeft(i, n) ? "left" : "right", handle: "vertical" });
    }
  },
};
