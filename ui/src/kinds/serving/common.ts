// Parts the serving counters share: counter bodies with Gastronorm wells, sneeze guards over
// them and the castors of mobile units. Plan and elevation sizes are millimetres, 3D sizes
// metres; the well layout is computed once in millimetres so all three views agree.

import { INSET as FRONT_INSET, type Front } from "../parts/elevation";
import { castor, DOOR, LEG, PLINTH, plinth, SHEET, TOP, type Hole, type MaterialId, type Parts, type Size } from "../parts/mesh";
import { INSET, type PlanSketch } from "../parts/plan";

/** Gastronorm GN 1/1 pan (mm): 530 × 325, laid crosswise in a counter (the long side to the front). */
export const GN_LONG = 530;
export const GN_SHORT = 325;
/** Pitch of crosswise GN 1/1 wells along a counter (mm): the well and the web to the next one. */
const WELL_PITCH = 370;
/** Margin between the ends of the counter and the first well (mm). */
const WELL_END = 60;
/** Depth of a well below the top in 3D (m): a 150 mm GN pan and the water bath under it. */
export const WELL_DEPTH = 0.2;
/** How far the food in a pan lies below the rim (m). */
const FOOD_DROP = 0.05;
/** Radius of a sneeze guard post (m). */
const POST = 0.012;
/** Glass thickness as drawn (m). */
const GLASS = 0.008;

/** A rectangle in the item frame (mm): x along the width, y from the back (-) to the front (+). */
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Number of crosswise GN 1/1 wells a counter of the given width holds (mm). */
export function wellCount(width: number): number {
  return Math.max(1, Math.floor((width - 2 * WELL_END) / WELL_PITCH));
}

/** The wells of a row along the width, centred, from `y0` to `y1` (mm, item frame). */
export function wellRow(width: number, y0: number, y1: number): Rect[] {
  const n = wellCount(width);
  const pitch = Math.min(WELL_PITCH, (width - 2 * WELL_END) / n);
  const half = Math.min(GN_SHORT / 2, pitch / 2 - INSET / 2);
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const cx = -(n * pitch) / 2 + pitch * (i + 0.5);
    out.push({ x0: cx - half, x1: cx + half, y0, y1 });
  }
  return out;
}

/** Wells in the plan: the opening and the pan's rim inside it. */
export function planWells(s: PlanSketch, wells: readonly Rect[]): void {
  for (const r of wells) {
    s.rect("detail", r.x0, r.y0, r.x1, r.y1);
    s.rect("detail", r.x0 + INSET / 2, r.y0 + INSET / 2, r.x1 - INSET / 2, r.y1 - INSET / 2);
  }
}

/** Wells in metres, as holes of the top. */
export function holesOf(wells: readonly Rect[]): Hole[] {
  return wells.map((r) => ({ x0: r.x0 / 1000, x1: r.x1 / 1000, z0: r.y0 / 1000, z1: r.y1 / 1000 }));
}

/**
 * A counter body on a plinth with its top, open over the holes: below the wells the body is
 * solid, around them only its skins stand, so the wells stay open from above.
 */
export function counterBody(p: Parts, s: Size, holes: readonly Hole[] = [], topMat: MaterialId = "steel"): void {
  const { w, d, h } = s;
  const zf = d / 2 - DOOR;
  plinth(p, w, d);
  if (holes.length === 0) {
    p.box("steel", -w / 2, w / 2, PLINTH, h - TOP, -d / 2, zf);
    p.box(topMat, -w / 2, w / 2, h - TOP, h, -d / 2, d / 2);
    return;
  }
  const yb = h - WELL_DEPTH - SHEET;
  p.box("steel", -w / 2, w / 2, PLINTH, yb, -d / 2, zf);
  p.box("steel", -w / 2, w / 2, yb, h - TOP, -d / 2, -d / 2 + SHEET);
  p.box("steel", -w / 2, w / 2, yb, h - TOP, zf - SHEET, zf);
  p.box("steel", -w / 2, -w / 2 + SHEET, yb, h - TOP, -d / 2, zf);
  p.box("steel", w / 2 - SHEET, w / 2, yb, h - TOP, -d / 2, zf);
  p.topWithHoles(topMat, w, d, h - TOP, h, holes);
}

/**
 * Gastronorm pans in the wells: the well as a tub and the food a little below the rim, its
 * material taken in turn from `food` (so a row of pans reads as different dishes).
 */
export function wellPans(p: Parts, holes: readonly Hole[], top: number, food: readonly MaterialId[]): void {
  holes.forEach((hl, i) => {
    if (food.length === 0) {
      p.tub("steel", hl.x0, hl.x1, top - WELL_DEPTH, top, hl.z0, hl.z1);
      return;
    }
    // The food hides the pan's floor: only its walls are drawn.
    const y0 = top - WELL_DEPTH;
    p.box("steel", hl.x0, hl.x1, y0, top, hl.z0, hl.z0 + SHEET);
    p.box("steel", hl.x0, hl.x1, y0, top, hl.z1 - SHEET, hl.z1);
    p.box("steel", hl.x0, hl.x0 + SHEET, y0, top, hl.z0, hl.z1);
    p.box("steel", hl.x1 - SHEET, hl.x1, y0, top, hl.z0, hl.z1);
    p.box(food[i % food.length], hl.x0 + SHEET, hl.x1 - SHEET, top - WELL_DEPTH, top - FOOD_DROP, hl.z0 + SHEET, hl.z1 - SHEET);
    // A ladle hangs in every other pan.
    if (i % 2 === 0) p.rod("handle", "y", (hl.x0 + hl.x1) / 2, top - FOOD_DROP * 0.55, hl.z1 - 0.04, FOOD_DROP * 0.9, 0.006);
  });
}

/**
 * A sneeze guard over a counter: a post at each end, a vertical pane at `zGlass` from a hand's
 * gap over the top, and a glass shelf on top reaching from `zShelf0` to `zShelf1` (m). It
 * stands from `top` up to `top + rise`.
 */
export function sneezeGuard(p: Parts, w: number, top: number, rise: number, zGlass: number, zShelf0: number, zShelf1: number): void {
  const y1 = top + rise;
  const xs = [-w / 2 + LEG, w / 2 - LEG];
  for (const x of xs) {
    p.rod("handle", "y", x, top + (rise - GLASS) / 2, zGlass, rise - GLASS, POST);
    p.cyl("handle", x, zGlass, top, top + 0.01, POST * 2);
    // Bracket under the shelf, from the post to the shelf's far edge.
    p.box("handle", x - POST / 2, x + POST / 2, y1 - GLASS - 0.02, y1 - GLASS, Math.min(zShelf0, zGlass), Math.max(zShelf1, zGlass));
  }
  const gap = Math.min(0.15, rise * 0.35);
  p.box("glass", xs[0] + POST, xs[1] - POST, top + gap, y1 - GLASS - 0.03, zGlass - GLASS / 2, zGlass + GLASS / 2);
  p.box("glass", xs[0] - POST, xs[1] + POST, y1 - GLASS, y1, zShelf0, zShelf1);
}

/** A sneeze guard in the elevation: the posts and the pane above the top. */
export function sneezeGuardFront(f: Front, rise: number): void {
  const { l, r, top } = f;
  const I = FRONT_INSET;
  f.line("detail", [l + I, top], [l + I, top + rise]);
  f.line("detail", [r - I, top], [r - I, top + rise]);
  f.box("detail", l + I, r - I, top + rise * 0.35, top + rise, "glass");
}

/** Wheel radius and height of a castor of a mobile unit (m). */
export const CASTOR = { r: 0.05, h: 0.13 };

/** Four castors at the corners of a mobile unit, inside its footprint; the body starts at `CASTOR.h`. */
export function castors(p: Parts, w: number, d: number): void {
  const { r, h } = CASTOR;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - r - SHEET);
      const z = sz * (d / 2 - r - SHEET);
      castor(p, x, z, r, h);
    }
  }
}

/** Castors in the elevation: two wheels under the body. */
export function castorsFront(f: Front): void {
  const rr = CASTOR.r * 1000;
  f.circle("detail", f.l + rr + FRONT_INSET / 2, f.z0 + rr, rr);
  f.circle("detail", f.r - rr - FRONT_INSET / 2, f.z0 + rr, rr);
  f.line("detail", [f.l, f.z0 + CASTOR.h * 1000], [f.r, f.z0 + CASTOR.h * 1000]);
}
