// Back-bar cooler (Barkühlschrank, Flaschenkühltisch): a low dark cabinet under the back bar with
// glass doors of 450 mm, bottles on a wire shelf behind each, a steel top, and the machine behind
// a grille at the bottom (front-ventilated, so it stands flush in a counter run).

import { TOP as FRONT_TOP } from "../parts/elevation";
import { TOP, worktop, type MaterialId } from "../parts/mesh";
import type { KindDef } from "../types";
import {
  bottle,
  CABINET_RADIUS,
  cabinetShell,
  coolDoor,
  display,
  displayFront,
  doorFront,
  doorSwings,
  FRONT,
  grille,
  grilleFront,
  hingeLeft,
  LEAF_GAP_MM,
  m,
  STANDOFF,
  wireShelves,
} from "./common";

/** Width of one door (mm), height of the grille at the bottom and of the strip under the top (mm). */
const DOOR_MM = 450;
const GRILLE_MM = 110;
const STRIP_MM = 50;
/** Bottles per door and level, their radius and pitch (m). */
const BOTTLE = { n: 3, r: 0.035, pitch: 0.11 };
const GLASSES: readonly MaterialId[] = ["foodGreen", "oil", "glassDark"];

const doorsOf = (width: number) => Math.max(1, Math.round(width / DOOR_MM));

export const backBarCooler: KindDef = {
  kind: "backBarCooler",
  plan(s) {
    doorSwings(s, doorsOf(s.w));
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.worktop();
    const g1 = z0 + GRILLE_MM;
    const d1 = top - FRONT_TOP - STRIP_MM;
    grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + 20, g1 - LEAF_GAP_MM);
    f.line("detail", [l, d1], [r, d1]);
    displayFront(f, r - 100, d1 + STRIP_MM / 2);
    const n = doorsOf(f.w);
    const dw = f.w / n;
    for (let i = 0; i < n; i++) {
      const a = l + i * dw + LEAF_GAP_MM / 2;
      const b = a + dw - LEAF_GAP_MM;
      doorFront(f, a, b, g1, d1 - LEAF_GAP_MM, hingeLeft(i, n), true);
      f.line("detail", [a + 60, (g1 + d1) / 2], [b - 60, (g1 + d1) / 2]);
    }
  },
  mesh(p, s) {
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    const g1 = m(GRILLE_MM);
    const d1 = s.h - TOP - m(STRIP_MM);
    // The base with the grille, the strip with the display under the top, and the top.
    p.roundedBox("steelDark", -s.w / 2, s.w / 2, 0, g1, -s.d / 2, zLeaf - 0.004, CABINET_RADIUS, "vertical");
    grille(p, -s.w / 2 + 0.02, s.w / 2 - 0.02, 0.02, g1 - 0.01, zLeaf - 0.004, zLeaf + 0.004);
    p.roundedBox("steelDark", -s.w / 2, s.w / 2, d1, s.h - TOP, -s.d / 2, zLeaf - 0.004, CABINET_RADIUS, "vertical");
    display(p, s.w / 2 - 0.13, d1 + m(STRIP_MM) / 2, zLeaf - 0.004);
    worktop(p, "steel", -s.w / 2, s.w / 2, s.h - TOP, s.h, -s.d / 2, s.d / 2);
    const inner = cabinetShell(p, s, g1, d1, zBody, "steelDark");
    const n = doorsOf(s.w * 1000);
    const dw = s.w / n;
    for (let i = 1; i < n; i++) p.box("steelDark", -s.w / 2 + i * dw - 0.015, -s.w / 2 + i * dw + 0.015, inner.y0, inner.y1, inner.z0, zBody - 0.001);
    const shelves = [inner.y0, ...wireShelves(p, inner, 1)];
    for (const [k, y] of shelves.entries()) {
      const above = k + 1 < shelves.length ? shelves[k + 1] : inner.y1;
      const h = Math.min(0.26, above - y - 0.02);
      for (let i = 0; i < n; i++) {
        const cx = -s.w / 2 + (i + 0.5) * dw;
        const count = Math.min(BOTTLE.n, Math.floor((dw - 0.08) / BOTTLE.pitch));
        for (let j = 0; j < count; j++) bottle(p, cx + (j - (count - 1) / 2) * BOTTLE.pitch, y + 0.001, zBody - 0.1, h, BOTTLE.r, GLASSES[(i + j + k) % GLASSES.length]);
      }
    }
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + i * dw;
      coolDoor(p, { x0, x1: x0 + dw, y0: g1, y1: d1, zBody, zFront: s.d / 2, hinge: hingeLeft(i, n) ? "left" : "right", handle: "vertical", glass: true, frame: "steelDark" });
    }
  },
};
