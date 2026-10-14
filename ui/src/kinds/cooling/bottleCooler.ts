// Bottle cooler (Getränkekühlschrank) with glass doors: bottles on wire shelves behind the panes,
// a lit sign panel on top and the machine behind a grille in the base. One door per 600 mm.

import { GAP } from "../parts/mesh";
import type { MaterialId } from "../parts/mesh";
import type { KindDef } from "../types";
import { cabinetShell, coolDoor, doorFront, doorSwings, FRONT, GLASS_FRAME_MM, grille, grilleFront, hingeLeft, LEAF_GAP_MM, m, STANDOFF, wireShelves } from "./common";

/** Height of the grille base and of the lit head (mm). */
const BASE_MM = 120;
const HEAD_MM = 160;
/** Width of one door (mm). */
const DOOR_MM = 600;
/** Shelves behind each door, and the bottles standing in the front row of a shelf. */
const SHELVES = 4;
const BOTTLE = { r: 0.03, pitch: 0.1, max: 4 };
/** Bottles shelf by shelf: dark glass and amber glass in turn. */
const BOTTLE_MATS: readonly MaterialId[] = ["glassDark", "oil"];

const doorsOf = (width: number) => Math.max(1, Math.round(width / DOOR_MM));

export const bottleCooler: KindDef = {
  kind: "bottleCooler",
  plan(s) {
    doorSwings(s, doorsOf(s.w));
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + LEAF_GAP_MM, z0 + BASE_MM - LEAF_GAP_MM);
    f.box("detail", l + LEAF_GAP_MM, r - LEAF_GAP_MM, top - HEAD_MM + LEAF_GAP_MM, top - LEAF_GAP_MM);
    const n = doorsOf(f.w);
    const dw = f.w / n;
    const y0 = z0 + BASE_MM;
    const y1 = top - HEAD_MM;
    for (let i = 0; i < n; i++) {
      const a = l + i * dw + LEAF_GAP_MM / 2;
      const b = a + dw - LEAF_GAP_MM;
      doorFront(f, a, b, y0, y1, hingeLeft(i, n), true);
      for (let k = 1; k <= SHELVES; k++) {
        const z = y0 + GLASS_FRAME_MM + ((y1 - y0 - 2 * GLASS_FRAME_MM) * k) / (SHELVES + 1);
        f.line("detail", [a + GLASS_FRAME_MM, z], [b - GLASS_FRAME_MM, z]);
      }
    }
  },
  mesh(p, s) {
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    const y0 = m(BASE_MM);
    const y1 = s.h - m(HEAD_MM);
    p.box("steelDark", -s.w / 2, s.w / 2, 0, y0, -s.d / 2, zBody);
    grille(p, -s.w / 2 + 0.02, s.w / 2 - 0.02, 0.01, y0 - 0.01, zBody, zLeaf);
    // The head with the lit sign panel in the door plane.
    p.box("steelDark", -s.w / 2, s.w / 2, y1, s.h, -s.d / 2, zBody);
    p.box("panel", -s.w / 2 + 0.02, s.w / 2 - 0.02, y1 + 0.02, s.h - 0.02, zBody, zLeaf);
    const inner = cabinetShell(p, s, y0, y1, zBody);
    const n = doorsOf(s.w * 1000);
    const dw = s.w / n;
    for (let i = 1; i < n; i++) p.box("steelDark", -s.w / 2 + i * dw - 0.02, -s.w / 2 + i * dw + 0.02, inner.y0, inner.y1, inner.z0, zBody);
    const shelves = wireShelves(p, inner, SHELVES);
    // A front row of bottles on every shelf (the part count stays moderate on wide coolers).
    for (const [k, y] of shelves.entries()) {
      const above = k + 1 < shelves.length ? shelves[k + 1] : inner.y1;
      const h = Math.min(0.26, above - y - 0.04);
      for (let i = 0; i < n; i++) {
        const a = -s.w / 2 + i * dw + 0.05;
        const b = -s.w / 2 + (i + 1) * dw - 0.05;
        const count = Math.min(BOTTLE.max, Math.floor((b - a) / BOTTLE.pitch));
        const x0 = (a + b) / 2 - ((count - 1) * BOTTLE.pitch) / 2;
        for (let j = 0; j < count; j++) p.cyl(BOTTLE_MATS[k % BOTTLE_MATS.length], x0 + j * BOTTLE.pitch, zBody - 0.08, y + GAP, y + h, BOTTLE.r);
      }
    }
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + i * dw;
      coolDoor(p, { x0, x1: x0 + dw, y0, y1, zBody, zFront: s.d / 2, hinge: hingeLeft(i, n) ? "left" : "right", handle: "vertical", glass: true });
    }
  },
};
