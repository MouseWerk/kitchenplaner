// Ice machine (Eiswürfelbereiter, Scherbeneisbereiter): an insulated storage bin with a flap at
// the front for scooping. Compact units have the ice maker inside, the machine behind a grille at
// the bottom; tall modular units carry the ice maker head on top of a bin on legs.

import { FEET } from "../parts/elevation";
import { BODY_RADIUS, foot, GAP, LEG, LEG_RADIUS, plinth, PLINTH, worktop, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { BASE_MM, CABINET_RADIUS, display, displayFront, gasket, grille, grilleFront, LEAF_GAP_MM, LEAF_RADIUS, m, STANDOFF } from "./common";

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
    const zFace = zLeaf - 0.006;
    const binTop = m(k.binTop);
    if (k.modular) {
      // The bin stands on four square legs with adjustable feet; the head sits on it.
      const legs = m(FEET);
      binLegs(p, s.w, s.d - STANDOFF * 2, legs);
      p.roundedBox("steel", -s.w / 2, s.w / 2, legs, binTop, -s.d / 2, zFace, CABINET_RADIUS, "vertical");
      p.roundedBox("steel", -s.w / 2, s.w / 2, binTop + GAP, s.h, -s.d / 2, zLeaf, PRESSED_RADIUS);
      grille(p, -s.w / 2 + 0.04, s.w / 2 - 0.04, binTop + 0.05, s.h - m(STRIP_MM) * 2, zLeaf, s.d / 2);
      display(p, 0, s.h - m(STRIP_MM), zLeaf);
    } else {
      plinth(p, s.w, s.d);
      p.roundedBox("steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, zFace, CABINET_RADIUS, "vertical");
      grille(p, -s.w / 2 + 0.03, s.w / 2 - 0.03, PLINTH, PLINTH + m(GRILLE_MM), zFace, zLeaf);
      p.roundedBox("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, binTop + GAP, s.h - 0.012, zFace, zFace + 0.002, BODY_RADIUS, "top", "z");
      display(p, 0, binTop + m(STRIP_MM) / 2 - 0.004, zFace + 0.002);
      worktop(p, "steel", -s.w / 2, s.w / 2, s.h - 0.012, s.h, -s.d / 2, s.d / 2);
    }
    // The flap over the bin opening on its gasket, with a grip along its top edge.
    const inset = m(LEAF_GAP_MM * 3);
    const f0 = m(k.flap0);
    const f1 = m(k.flap1);
    gasket(p, -s.w / 2 + inset, s.w / 2 - inset, f0, f1, zFace);
    p.roundedBox("steel", -s.w / 2 + inset, s.w / 2 - inset, f0, f1, zFace + 0.004, zLeaf + 0.006, LEAF_RADIUS, "top", "z");
    p.barHandle("x", -s.w / 2 + inset * 3, s.w / 2 - inset * 3, f1 - 0.035, zLeaf + 0.006, s.d / 2);
  },
};

/**
 * Four square legs with adjustable feet under a bin or a stand of width `w` and depth `d` (m),
 * from the floor up to `top`, centred on the item.
 */
export function binLegs(p: Parts, w: number, d: number, top: number): void {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - LEG / 2 - 0.005);
      const z = sz * (d / 2 - LEG / 2 - 0.005);
      foot(p, x, z, 0.04, 0.016);
      p.roundedBox("steel", x - LEG / 2, x + LEG / 2, 0.04, top, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
    }
  }
}

/** Edge radius of a pressed machine head (m). */
const PRESSED_RADIUS = 0.008;

/** Height of the flap of a storage bin and its distance below the top (mm). */
const BIN_FLAP_MM = 380;
const BIN_FLAP_DROP_MM = 60;

/**
 * Ice storage bin (Eisvorratsbehälter): the insulated bin on legs that an ice maker head is set
 * on, or that is filled by hand; a wide flap at the top of the front, a flat top with the cover
 * plate where the head's chute goes through.
 */
export const iceBin: KindDef = {
  kind: "iceBin",
  plan(s) {
    s.line("detail", [s.L + INSET, s.F - INSET / 2], [s.R - INSET, s.F - INSET / 2]);
    s.rect("hidden", s.L + INSET, s.B + INSET, s.R - INSET, s.F - INSET);
    s.rect("detail", -INSET * 2, s.B + INSET * 2, INSET * 2, s.B + INSET * 5);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const inset = LEAF_GAP_MM * 3;
    const f1 = top - BIN_FLAP_DROP_MM;
    f.box("detail", l + inset, r - inset, f1 - BIN_FLAP_MM, f1);
    f.line("detail", [l + inset * 3, f1 - inset * 3], [r - inset * 3, f1 - inset * 3]);
    f.line("detail", [l, z0 + FEET], [r, z0 + FEET]);
  },
  mesh(p, s) {
    const zLeaf = s.d / 2 - STANDOFF;
    const zFace = zLeaf - 0.006;
    const legs = m(FEET);
    binLegs(p, s.w, s.d - STANDOFF * 2, legs);
    p.roundedBox("steel", -s.w / 2, s.w / 2, legs, s.h - 0.016, -s.d / 2, zFace, CABINET_RADIUS, "vertical");
    worktop(p, "steel", -s.w / 2, s.w / 2, s.h - 0.016, s.h - 0.004, -s.d / 2, zFace);
    // The cover plate over the chute opening, near the back, standing on the top.
    p.roundedBox("satin", -0.1, 0.1, s.h - 0.008, s.h, -s.d / 2 + 0.1, -s.d / 2 + 0.25, 0.003);
    const inset = m(LEAF_GAP_MM * 3);
    const f1 = s.h - m(BIN_FLAP_DROP_MM);
    const f0 = f1 - m(BIN_FLAP_MM);
    gasket(p, -s.w / 2 + inset, s.w / 2 - inset, f0, f1, zFace);
    p.roundedBox("steel", -s.w / 2 + inset, s.w / 2 - inset, f0, f1, zFace + 0.004, zLeaf + 0.006, LEAF_RADIUS, "top", "z");
    p.barHandle("x", -s.w / 2 + inset * 3, s.w / 2 - inset * 3, f1 - 0.035, zLeaf + 0.006, s.d / 2);
  },
};
