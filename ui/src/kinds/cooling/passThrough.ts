// Pass-through refrigerator (Durchreichekühlschrank) for GN 2/1: one cabinet with doors on both
// sides, set into the wall between the kitchen and the pass or the bar, so it is filled from one
// side and emptied from the other. The machine grille and the display sit in the fascia on the
// front; the back has its own doors under a plain fascia.

import type { Front } from "../parts/elevation";
import { BODY_RADIUS, GAP, PLINTH, plinth } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import {
  BASE_MM,
  CABINET_RADIUS,
  coolDoor,
  display,
  doorFront,
  doorSwings,
  FASCIA,
  FASCIA_MM,
  fasciaFront,
  FRONT,
  grille,
  GRIP_HEIGHT_MM,
  hingeLeft,
  LEAF_GAP_MM,
  m,
  STANDOFF,
  turnAround,
  uprightColumns,
} from "./common";

/** The doors of one side in the elevation, under the fascia line. */
function doorsFront(f: Front): void {
  const { l, z0, top } = f;
  const cols = uprightColumns(f.w);
  const y0 = z0 + BASE_MM;
  const y1 = top - FASCIA_MM;
  f.line("detail", [l, y0], [f.r, y0]);
  const cw = f.w / cols;
  for (let c = 0; c < cols; c++) {
    const a = l + c * cw + LEAF_GAP_MM / 2;
    doorFront(f, a, a + cw - LEAF_GAP_MM, y0 + LEAF_GAP_MM / 2, y1 - LEAF_GAP_MM / 2, hingeLeft(c, cols));
  }
}

export const fridgePassThrough: KindDef = {
  kind: "fridgePassThrough",
  plan(s) {
    const cols = uprightColumns(s.w);
    doorSwings(s, cols);
    // The doors at the back, drawn closed (they swing out on the other side of the wall).
    const dw = s.w / cols;
    for (let i = 0; i < cols; i++) s.line("detail", [s.L + i * dw, s.B + INSET / 2], [s.L + (i + 1) * dw, s.B + INSET / 2]);
  },
  elevation(f) {
    fasciaFront(f);
    doorsFront(f);
  },
  elevationSide(f) {
    // Seen from the back the doors show under a plain fascia; from the side only the fascia line.
    f.line("detail", [f.l, f.top - FASCIA_MM], [f.r, f.top - FASCIA_MM]);
    if (Math.abs(f.w - f.item.width) < 1 && f.item.width !== f.item.depth) doorsFront(f);
  },
  mesh(p, s) {
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    plinth(p, s.w, s.d);
    p.roundedBox("steel", -s.w / 2, s.w / 2, PLINTH, s.h, -zBody, zBody, CABINET_RADIUS, "vertical");
    const y1 = s.h - FASCIA;
    const cols = uprightColumns(s.w * 1000);
    const cw = s.w / cols;
    // Both sides are built on the front; the back's parts are then turned round.
    const side = (back: boolean) => {
      const from = p.g.children.length;
      p.roundedBox("steel", -s.w / 2, s.w / 2, y1 + GAP, s.h, zBody, zLeaf, BODY_RADIUS, "top", "z");
      if (!back) {
        const gw = Math.min(0.45, s.w * 0.55);
        grille(p, -s.w / 2 + 0.03, -s.w / 2 + 0.03 + gw, y1 + 0.025, s.h - 0.025, zLeaf, s.d / 2);
        display(p, s.w / 2 - 0.13, y1 + FASCIA / 2, zLeaf);
      }
      for (let c = 0; c < cols; c++) {
        const x0 = -s.w / 2 + c * cw;
        coolDoor(p, { x0, x1: x0 + cw, y0: PLINTH, y1, zBody, zFront: s.d / 2, hinge: hingeLeft(c, cols) ? "left" : "right", handle: "vertical", gripY: m(GRIP_HEIGHT_MM) });
      }
      if (back) turnAround(p, from);
    };
    side(false);
    side(true);
  },
};
