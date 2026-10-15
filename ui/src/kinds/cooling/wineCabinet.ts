// Wine climate cabinet (Weinklimaschrank): a dark cabinet with a full glass door in a black frame,
// beech racks on which the bottles lie neck to the front, and the machine behind a grille in
// the base under the display. It keeps wine at serving or cellar temperature at the bar.

import { GAP, type MaterialId } from "../parts/mesh";
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
  GLASS_FRAME_MM,
  grille,
  grilleFront,
  GRIP_HEIGHT_MM,
  hingeLeft,
  LEAF_GAP_MM,
  m,
  STANDOFF,
} from "./common";

/** Height of the base with the grille and the display (mm). */
const BASE_MM = 160;
/** Width of one door (mm), pitch of the shelves (m). */
const DOOR_MM = 600;
const SHELF = 0.2;
/** Depth of a rack's rail (m). */
const RAIL = 0.03;
/** A lying bottle: radius and length (m), and their pitch along a shelf. */
const BOTTLE = { r: 0.038, l: 0.31, pitch: 0.088 };
/** Most bottles shown per shelf and door, for the budget (fewer behind each of two doors). */
const PER_SHELF = 5;
const PER_SHELF_WIDE = 3;
/** Most bottles in the cabinet: a wide one leaves its top racks empty. */
const MAX_BOTTLES = 46;
/** Red, white and rosé in turn: dark, green and amber glass. */
const GLASSES: readonly MaterialId[] = ["glassDark", "foodGreen", "oil"];

const doorsOf = (width: number) => Math.max(1, Math.round(width / DOOR_MM));
const shelvesIn = (h: number) => Math.max(1, Math.floor(h / SHELF));

export const wineCabinet: KindDef = {
  kind: "wineCabinet",
  plan(s) {
    doorSwings(s, doorsOf(s.w));
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const y0 = z0 + BASE_MM;
    grilleFront(f, l + LEAF_GAP_MM * 3, l + f.w * 0.55, z0 + 30, y0 - 30);
    displayFront(f, r - 110, (z0 + y0) / 2);
    const n = doorsOf(f.w);
    const dw = f.w / n;
    const inner = top - y0 - 2 * GLASS_FRAME_MM;
    const k = shelvesIn(inner / 1000);
    for (let i = 0; i < n; i++) {
      const a = l + i * dw + LEAF_GAP_MM / 2;
      const b = a + dw - LEAF_GAP_MM;
      doorFront(f, a, b, y0, top - LEAF_GAP_MM, hingeLeft(i, n), true);
      for (let j = 1; j <= k; j++) {
        const z = y0 + GLASS_FRAME_MM + (inner * j) / (k + 1);
        f.line("detail", [a + GLASS_FRAME_MM, z], [b - GLASS_FRAME_MM, z]);
      }
    }
  },
  mesh(p, s) {
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    const y0 = m(BASE_MM);
    // The base: grille and display in a dark front down to the floor.
    p.roundedBox("panelDark", -s.w / 2, s.w / 2, 0, y0, -s.d / 2, zLeaf - 0.002, CABINET_RADIUS, "vertical");
    grille(p, -s.w / 2 + 0.03, -s.w / 2 + s.w * 0.55, 0.03, y0 - 0.03, zLeaf - 0.002, zLeaf + 0.008);
    display(p, s.w / 2 - 0.11, y0 / 2, zLeaf - 0.002);
    const inner = cabinetShell(p, s, y0, s.h, zBody, "panelDark");
    const n = doorsOf(s.w * 1000);
    const dw = s.w / n;
    for (let i = 1; i < n; i++) p.box("panelDark", -s.w / 2 + i * dw - 0.02, -s.w / 2 + i * dw + 0.02, inner.y0, inner.y1, inner.z0, zBody - 0.001);
    // Racks of beech rails; the bottles lie on them, neck to the front.
    const k = shelvesIn(inner.y1 - inner.y0);
    const pitch = (inner.y1 - inner.y0) / (k + 1);
    const z0 = inner.z0 + 0.01;
    const lie = Math.min(BOTTLE.l, inner.z1 - z0 - 0.04);
    let shown = 0;
    for (let j = 0; j <= k; j++) {
      const y = inner.y0 + pitch * j;
      if (j > 0) {
        // A beech rack: a rail at the back and one at the front, the bottles' bellies on them,
        // carried by steel runners at the sides.
        const zr = inner.z1 - 0.02;
        p.roundedBox("wood", inner.x0 + 0.002, inner.x1 - 0.002, y - 0.025, y, zr - RAIL, zr, 0.004);
        p.roundedBox("wood", inner.x0 + 0.002, inner.x1 - 0.002, y - 0.025, y, z0 + 0.05, z0 + 0.05 + RAIL, 0.004);
        for (const x of [inner.x0 + 0.004, inner.x1 - 0.012]) p.box("satin", x, x + 0.008, y - 0.03, y - 0.025, z0, zr);
      }
      for (let i = 0; i < n; i++) {
        const a = -s.w / 2 + i * dw + 0.04;
        const b = -s.w / 2 + (i + 1) * dw - 0.04;
        const count = Math.min(n > 1 ? PER_SHELF_WIDE : PER_SHELF, Math.floor((b - a) / BOTTLE.pitch), MAX_BOTTLES - shown);
        shown += count;
        const x0 = (a + b) / 2 - ((count - 1) * BOTTLE.pitch) / 2;
        // Lying bottles: the turned bottle laid along z, its belly on the shelf.
        for (let c = 0; c < count; c++) bottle(p, x0 + c * BOTTLE.pitch, y + BOTTLE.r + GAP, z0 + 0.01, lie, BOTTLE.r, GLASSES[(j + c) % GLASSES.length], true);
      }
    }
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + i * dw;
      coolDoor(p, { x0, x1: x0 + dw, y0, y1: s.h, zBody, zFront: s.d / 2, hinge: hingeLeft(i, n) ? "left" : "right", handle: "vertical", gripY: m(GRIP_HEIGHT_MM), glass: true, frame: "panelDark" });
    }
  },
};
