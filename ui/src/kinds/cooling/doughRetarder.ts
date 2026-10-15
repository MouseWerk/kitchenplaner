// Retarder-proofer (Gärunterbrecher, Gärverzögerer) for bakery trays 600 × 400: an upright cabinet
// that holds dough cold overnight and then proofs it warm and humid on a timer, so the trays go
// into the oven at the start of the shift. The trays slide in lengthwise on runners (drawn
// dashed in the plan); the door has a viewing window and the fascia a touch panel with the
// programme display beside the grille.

import { PLINTH } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import {
  BASE_MM,
  coolDoor,
  doorFront,
  doorSwings,
  FASCIA,
  FASCIA_MM,
  FRONT,
  grille,
  grilleFront,
  GRIP_HEIGHT_MM,
  LEAF_GAP_MM,
  m,
  pushButton,
  STANDOFF,
  uprightCarcass,
} from "./common";

/** A bakery tray (mm), lengthwise into the cabinet. */
const TRAY = { w: 400, d: 600 };
/** The viewing window in the door: inset from the leaf's sides, its bottom and top (mm). */
const WINDOW = { side: 130, y0: 1000, y1: 1700 };
/** The touch panel in the fascia: its width (mm). */
const PANEL_MM = 230;

export const doughRetarder: KindDef = {
  kind: "doughRetarder",
  plan(s) {
    doorSwings(s, 1);
    const tw = Math.min(TRAY.w, s.w - 2 * INSET);
    const td = Math.min(TRAY.d, s.d - 3 * INSET);
    s.rect("hidden", -tw / 2, -td / 2 - INSET / 2, tw / 2, td / 2 - INSET / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const y0 = top - FASCIA_MM;
    f.line("detail", [l, y0], [r, y0]);
    const gw = Math.min(300, f.w * 0.4);
    grilleFront(f, l + 30, l + 30 + gw, y0 + 25, top - 25);
    f.box("detail", r - 30 - PANEL_MM, r - 30, y0 + 20, top - 20, "item-dark");
    const d0 = z0 + BASE_MM;
    f.line("detail", [l, d0], [r, d0]);
    doorFront(f, l + LEAF_GAP_MM / 2, r - LEAF_GAP_MM / 2, d0 + LEAF_GAP_MM / 2, y0 - LEAF_GAP_MM / 2, true);
    const wt = Math.min(z0 + WINDOW.y1, y0 - 100);
    f.box("detail", l + WINDOW.side, r - WINDOW.side, z0 + WINDOW.y0, wt, "glass");
  },
  mesh(p, s) {
    const zBody = s.d / 2 - FRONT;
    const zLeaf = s.d / 2 - STANDOFF;
    uprightCarcass(p, s, zBody, false, "steel", false);
    const y0 = s.h - FASCIA;
    grille(p, -s.w / 2 + 0.03, -s.w / 2 + 0.03 + Math.min(0.3, s.w * 0.4), y0 + 0.025, s.h - 0.025, zLeaf, s.d / 2);
    const px1 = s.w / 2 - 0.03;
    const px0 = px1 - m(PANEL_MM);
    p.plate("panelDark", px0, px1, y0 + 0.02, s.h - 0.02, zLeaf, zLeaf + 0.002, 0.008, true);
    p.plate("glassDark", px0 + 0.012, px0 + 0.14, y0 + 0.032, s.h - 0.032, zLeaf + 0.002, zLeaf + 0.003, 0.004);
    for (const [dx, dy] of [[0.165, 0.025], [0.2, 0.025], [0.165, -0.015], [0.2, -0.015]]) pushButton(p, px0 + dx, y0 + FASCIA / 2 + dy, zLeaf + 0.002, 0.008);
    coolDoor(p, { x0: -s.w / 2, x1: s.w / 2, y0: PLINTH, y1: y0, zBody, zFront: s.d / 2, hinge: "left", handle: "vertical", gripY: m(GRIP_HEIGHT_MM) });
    // The viewing window: a double pane in a rubber seal, a hair proud of the leaf.
    const wy1 = Math.min(m(WINDOW.y1), y0 - 0.1);
    const wx = s.w / 2 - m(WINDOW.side);
    p.plate("rubber", -wx - 0.008, wx + 0.008, m(WINDOW.y0) - 0.008, wy1 + 0.008, zLeaf - 0.001, zLeaf + 0.001, 0.02);
    p.plate("glassDark", -wx, wx, m(WINDOW.y0), wy1, zLeaf + 0.001, zLeaf + 0.002, 0.014);
  },
};
