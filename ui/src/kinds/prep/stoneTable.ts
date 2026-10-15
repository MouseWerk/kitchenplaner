// Work table with a granite top (Arbeitstisch mit Granitplatte): a polished stone slab on a
// stainless frame with legs, feet and an undershelf; a cool surface for pastry, chocolate and
// pizza dough. No upstand, so the slab can be worked from all sides.

import type { Front } from "../parts/elevation";
import { TOP, TOP_RADIUS, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { tableFrame, tableLegsFront } from "./common";

/** Thickness of the stone slab (mm, a usual 30 mm granite top). */
export const SLAB_MM = 30;
const SLAB = SLAB_MM / 1000;
/** Edge radius of the slab (m): a polished, eased edge. */
const SLAB_RADIUS = 0.005;
/** How far the steel frame under the slab stays inside its edge (m). */
const FRAME_SET = 0.01;

/**
 * The stone top of a table or cabinet whose surface is at `h` (m): the slab over the whole
 * footprint and the stainless frame it lies in under it, down to `h - TOP`.
 */
export function stoneTop(p: Parts, { w, d, h }: Size): void {
  p.roundedBox("granite", -w / 2, w / 2, h - SLAB, h, -d / 2, d / 2, SLAB_RADIUS);
  p.roundedBox("steel", -w / 2 + FRAME_SET, w / 2 - FRAME_SET, h - TOP, h - SLAB + 0.001, -d / 2 + FRAME_SET, d / 2 - FRAME_SET, TOP_RADIUS, "vertical");
}

/** The stone top in the elevation: the slab over the frame. */
export function stoneTopFront(f: Front): void {
  f.box("detail", f.l, f.r, f.top - SLAB_MM, f.top);
  f.box("detail", f.l + FRAME_SET * 1000, f.r - FRAME_SET * 1000, f.top - TOP * 1000, f.top - SLAB_MM);
}

export const stoneTable: KindDef = {
  kind: "stoneTable",
  plan(s) {
    // The slab's polished edge, a line just inside the outline.
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
  },
  elevation(f) {
    stoneTopFront(f);
    tableLegsFront(f, { shelf: true });
  },
  mesh(p, s) {
    tableFrame(p, s, s.h - TOP, { shelf: true });
    stoneTop(p, s);
  },
};
