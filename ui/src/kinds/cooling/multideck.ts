// Display cooler (Kühlregal, multideck): an open-fronted refrigerated display with shelves that
// step back towards the top, a cold air curtain from the lit canopy down to the well, products
// on display, and the machine behind a grille in the base.

import { INSET } from "../parts/plan";
import type { MaterialId } from "../parts/mesh";
import type { KindDef } from "../types";
import { grille, grilleFront, LEAF_GAP_MM, m } from "./common";

/** Height of the base riser in front of the well, and of the canopy (mm). */
const RISER_MM = 450;
const CANOPY_MM = 250;
/** Height of the grille at the foot of the riser (mm). */
const GRILLE_MM = 110;
/** Shelves above the well; each one steps back from the one below (mm). */
const SHELVES = 4;
const STEP_MM = 60;
/** How far the canopy stays behind the front of the base (mm). */
const CANOPY_SETBACK_MM = 150;
/** Wall thickness of the end panels and the back (m). */
const WALL = 0.04;
/** Products on display: their width and gap along a shelf (m), most per shelf. */
const PRODUCT = { w: 0.2, gap: 0.04, max: 7 };
const PRODUCT_MATS: readonly MaterialId[] = ["panel", "oil", "zone", "panel", "glassDark"];

/** Front edge of shelf `k` (0 = the well) in the item frame (mm from the centre). */
const shelfFront = (depth: number, k: number) => depth / 2 - CANOPY_SETBACK_MM / 2 - k * STEP_MM;

export const multideck: KindDef = {
  kind: "multideck",
  plan(s) {
    // The riser along the front; the shelf edges above it and the canopy are dashed.
    s.line("detail", [s.L + INSET, s.F - INSET], [s.R - INSET, s.F - INSET]);
    for (let k = 1; k <= SHELVES; k++) {
      const y = shelfFront(s.d, k);
      s.line("hidden", [s.L + INSET, y], [s.R - INSET, y]);
    }
    s.line("hidden", [s.L, s.F - CANOPY_SETBACK_MM], [s.R, s.F - CANOPY_SETBACK_MM]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const e = WALL * 1000;
    f.box("detail", l, l + e, z0, top);
    f.box("detail", r - e, r, z0, top);
    f.box("detail", l + e, r - e, top - CANOPY_MM, top, "item-dark");
    grilleFront(f, l + e + LEAF_GAP_MM, r - e - LEAF_GAP_MM, z0 + LEAF_GAP_MM, z0 + GRILLE_MM);
    f.line("detail", [l + e, z0 + RISER_MM], [r - e, z0 + RISER_MM]);
    const pitch = (top - CANOPY_MM - z0 - RISER_MM) / (SHELVES + 1);
    for (let k = 1; k <= SHELVES; k++) {
      const z = z0 + RISER_MM + pitch * k;
      f.box("detail", l + e, r - e, z - 30, z);
    }
  },
  mesh(p, s) {
    const riser = m(RISER_MM);
    const canopy = s.h - m(CANOPY_MM);
    const x0 = -s.w / 2 + WALL;
    const x1 = s.w / 2 - WALL;
    // End panels, back and base.
    p.box("steel", -s.w / 2, x0, 0, s.h, -s.d / 2, s.d / 2);
    p.box("steel", x1, s.w / 2, 0, s.h, -s.d / 2, s.d / 2);
    p.box("steelDark", x0, x1, 0, s.h, -s.d / 2, -s.d / 2 + WALL);
    p.box("panel", x0, x1, riser, canopy, -s.d / 2 + WALL, -s.d / 2 + WALL + 0.005);
    p.box("steel", x0, x1, 0, riser, -s.d / 2 + WALL, s.d / 2 - 0.02);
    grille(p, x0 + 0.01, x1 - 0.01, 0.01, m(GRILLE_MM), s.d / 2 - 0.02, s.d / 2);
    p.box("panelDark", x0, x1, m(GRILLE_MM) + 0.01, riser, s.d / 2 - 0.02, s.d / 2);
    // The canopy with its light strip along the front and the air outlet.
    const cz = s.d / 2 - m(CANOPY_SETBACK_MM);
    p.box("steel", x0, x1, canopy, s.h, -s.d / 2 + WALL, cz);
    p.box("panel", x0 + 0.01, x1 - 0.01, canopy - 0.008, canopy, cz - 0.08, cz - 0.02);
    p.box("basket", x0 + 0.01, x1 - 0.01, canopy - 0.004, canopy, cz - 0.16, cz - 0.09);
    // Shelves stepping back towards the top, each with a price rail; products on the well and shelves.
    const pitch = (canopy - riser) / (SHELVES + 1);
    const back = -s.d / 2 + WALL + 0.01;
    for (let k = 0; k <= SHELVES; k++) {
      const y = riser + pitch * k;
      const front = m(shelfFront(s.d * 1000, k));
      if (k > 0) {
        p.box("steel", x0, x1, y - 0.012, y, back, front);
        p.box("panelDark", x0, x1, y - 0.03, y, front, front + 0.006);
      }
      const n = Math.min(PRODUCT.max, Math.floor((x1 - x0 - PRODUCT.gap) / (PRODUCT.w + PRODUCT.gap)));
      const start = -(n * PRODUCT.w + (n - 1) * PRODUCT.gap) / 2;
      const ph = Math.min(0.2, pitch * 0.6);
      for (let i = 0; i < n; i++) {
        const a = start + i * (PRODUCT.w + PRODUCT.gap);
        const h = ph * (i % 2 === 0 ? 1 : 0.7);
        p.box(PRODUCT_MATS[(i + k) % PRODUCT_MATS.length], a, a + PRODUCT.w, y, y + h, back + 0.03, front - 0.04);
      }
    }
  },
};
