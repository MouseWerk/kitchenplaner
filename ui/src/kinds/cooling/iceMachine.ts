// Ice machine (Eiswürfelbereiter, Scherbeneisbereiter): an insulated storage bin with a flap at
// the front for scooping. Compact units have the ice maker inside, the machine behind a grille at
// the bottom; tall modular units carry the ice maker head on top of a bin on legs.

import { FEET } from "../parts/elevation";
import { GAP, LEG, plinth, PLINTH } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { BASE_MM, display, displayFront, grille, grilleFront, LEAF_GAP_MM, m, STANDOFF } from "./common";

/** Height from which the ice maker is a head on top of a separate bin (mm). */
const MODULAR_FROM = 1300;
/** Height of the ice maker head of a modular unit (mm). */
const HEAD_MM = 550;
/** Height of the bin flap (mm), and of the machine grille of a compact unit (mm). */
const FLAP_MM = 320;
const GRILLE_MM = 120;
/** Strip with the switch and the display at the top of a compact unit (mm). */
const STRIP_MM = 70;

/** Heights of the front (mm above the elevation): flap, and head or strip on top. */
function layout(height: number) {
  const modular = height >= MODULAR_FROM;
  const binTop = modular ? height - HEAD_MM : height - STRIP_MM;
  return { modular, binTop, flap0: binTop - FLAP_MM - LEAF_GAP_MM, flap1: binTop - LEAF_GAP_MM };
}

export const iceMachine: KindDef = {
  kind: "iceMachine",
  plan(s) {
    // The flap at the front and the bin behind it, under the top.
    s.line("detail", [s.L + INSET, s.F - INSET / 2], [s.R - INSET, s.F - INSET / 2]);
    s.rect("hidden", s.L + INSET, s.B + INSET, s.R - INSET, s.F - INSET);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const k = layout(f.item.height);
    const inset = LEAF_GAP_MM * 3;
    f.box("detail", l + inset, r - inset, z0 + k.flap0, z0 + k.flap1);
    f.line("detail", [l + inset * 3, z0 + k.flap1 - inset], [r - inset * 3, z0 + k.flap1 - inset]);
    if (k.modular) {
      // Head on top of the bin, the bin on legs.
      f.line("detail", [l, z0 + k.binTop], [r, z0 + k.binTop]);
      grilleFront(f, l + inset, r - inset, z0 + k.binTop + inset, top - STRIP_MM * 2);
      displayFront(f, (l + r) / 2, top - STRIP_MM);
      f.line("detail", [l, z0 + FEET], [r, z0 + FEET]);
    } else {
      grilleFront(f, l + inset, r - inset, z0 + BASE_MM, z0 + BASE_MM + GRILLE_MM);
      f.line("detail", [l, z0 + k.binTop], [r, z0 + k.binTop]);
      displayFront(f, (l + r) / 2, z0 + k.binTop + STRIP_MM / 2);
    }
  },
  mesh(p, s) {
    const k = layout(s.h * 1000);
    const zLeaf = s.d / 2 - STANDOFF;
    const binTop = m(k.binTop);
    if (k.modular) {
      // The bin stands on four legs; the head sits on it.
      const legs = m(FEET);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) p.cyl("steelDark", sx * (s.w / 2 - LEG), sz * (s.d / 2 - STANDOFF - LEG), 0, legs, LEG / 2);
      }
      p.box("steel", -s.w / 2, s.w / 2, legs, binTop, -s.d / 2, zLeaf - 0.006);
      p.box("steel", -s.w / 2, s.w / 2, binTop + GAP, s.h, -s.d / 2, zLeaf);
      grille(p, -s.w / 2 + 0.04, s.w / 2 - 0.04, binTop + 0.05, s.h - m(STRIP_MM) * 2, zLeaf, s.d / 2);
      display(p, 0, s.h - m(STRIP_MM), zLeaf);
    } else {
      plinth(p, s.w, s.d);
      p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, zLeaf - 0.006);
      grille(p, -s.w / 2 + 0.03, s.w / 2 - 0.03, PLINTH, PLINTH + m(GRILLE_MM), zLeaf - 0.006, zLeaf);
      p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, binTop + GAP, s.h - GAP, zLeaf - 0.006, zLeaf - 0.004);
      display(p, 0, binTop + m(STRIP_MM) / 2, zLeaf - 0.004);
      p.box("steel", -s.w / 2, s.w / 2, s.h - 0.01, s.h, zLeaf - 0.006, s.d / 2);
    }
    // The flap over the bin opening, with a grip along its top edge.
    const inset = m(LEAF_GAP_MM * 3);
    const f0 = m(k.flap0);
    const f1 = m(k.flap1);
    p.box("rubber", -s.w / 2 + inset - GAP, s.w / 2 - inset + GAP, f0 - GAP, f1 + GAP, zLeaf - 0.006, zLeaf - 0.004);
    p.box("steel", -s.w / 2 + inset, s.w / 2 - inset, f0, f1, zLeaf - 0.004, zLeaf + 0.006);
    p.barHandle("x", -s.w / 2 + inset * 3, s.w / 2 - inset * 3, f1 - 0.035, zLeaf + 0.006, s.d / 2);
  },
};
