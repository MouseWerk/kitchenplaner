// Shelving units: four corner posts carrying shelves with folded edges, the lowest bay braced
// at the back. The shelves are solid sheet, perforated sheet (drawn as rows of slots) or open
// slats (aluminium shelving); the corner unit is an L of two runs sharing the corner posts.

import { FEET, LEG, TOP } from "../parts/elevation";
import type { Front } from "../parts/elevation";
import type { MaterialId, Parts } from "../parts/mesh";
import { cross, type PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { type Deck, LIP, shelf, strut } from "./helpers";

// Construction sizes (m).
/** Square post. */
const POST = 0.03;
/** Plastic foot cap under each post. */
const FOOT_CAP = 0.012;
/** Lower edge of the lowest shelf above the floor. */
const LOWEST = 0.15;
/** Radius of a bracing rod. */
const BRACE = 0.004;
/** Depth of one run of a corner shelving unit (mm in the plan and elevation, m in 3D). */
const RUN_MM = 500;

/** Plan: the four posts and one diagonal, the usual symbol of open shelving. */
function planPosts(s: PlanSketch, x0: number, y0: number, x1: number, y1: number) {
  const q = POST * 1000;
  for (const [x, y] of [
    [x0, y0],
    [x1 - q, y0],
    [x0, y1 - q],
    [x1 - q, y1 - q],
  ]) {
    s.rect("detail", x, y, x + q, y + q);
  }
}

/** Elevation: posts at both ends, the shelves and the bracing of the lowest bay (behind). */
function shelvingFront(f: Front, levels: number, braced: boolean) {
  const { l, r, z0 } = f;
  f.box("detail", l, l + LEG, z0, f.top);
  f.box("detail", r - LEG, r, z0, f.top);
  const step = (f.item.height - FEET - TOP) / (levels - 1);
  for (let i = 0; i < levels; i++) {
    const z = z0 + FEET + step * i;
    f.box("detail", l + LEG, r - LEG, z, z + TOP);
  }
  if (braced && levels > 1) {
    const a = z0 + FEET + TOP;
    const b = z0 + FEET + step;
    f.line("hidden", [l + LEG, a], [r - LEG, b]);
    f.line("hidden", [l + LEG, b], [r - LEG, a]);
  }
}

/** Heights of the shelves' lower edges (m). */
function levelHeights(h: number, levels: number): number[] {
  return Array.from({ length: levels }, (_, i) => LOWEST + ((h - LIP - LOWEST) * i) / (levels - 1));
}

/** A post with its foot cap, centred at (x, z). */
function post(p: Parts, mat: MaterialId, x: number, z: number, h: number) {
  p.box("rubber", x - POST / 2, x + POST / 2, 0, FOOT_CAP, z - POST / 2, z + POST / 2);
  p.box(mat, x - POST / 2, x + POST / 2, FOOT_CAP, h, z - POST / 2, z + POST / 2);
}

/** Shelving with `levels` shelves of the given deck; posts of the frame material. */
function shelvingKind(kind: string, levels: number, deck: Deck, frame: MaterialId): KindDef {
  return {
    kind,
    plan(s) {
      planPosts(s, s.L, s.B, s.R, s.F);
      cross(s, "detail", false);
    },
    elevation(f) {
      shelvingFront(f, levels, true);
    },
    elevationSide(f) {
      shelvingFront(f, levels, false);
    },
    mesh(p, s) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) post(p, frame, sx * (s.w / 2 - POST / 2), sz * (s.d / 2 - POST / 2), s.h);
      }
      const ys = levelHeights(s.h, levels);
      for (const y of ys) shelf(p, deck, -s.w / 2 + POST, s.w / 2 - POST, -s.d / 2, s.d / 2, y);
      // Cross bracing at the back of the lowest bay keeps the unit from racking.
      const x = s.w / 2 - POST - BRACE * 2;
      const z = -s.d / 2 + POST / 2;
      const a = ys[0] + LIP + BRACE * 2;
      const b = ys[1] - BRACE * 2;
      strut(p, frame, [-x, a, z], [x, b, z], BRACE);
      strut(p, frame, [-x, b, z], [x, a, z], BRACE);
    },
  };
}

export const shelving = shelvingKind("shelving", 4, "solid", "steelDark");
export const shelving5 = shelvingKind("shelving5", 5, "solid", "steelDark");
export const shelvingPerforated = shelvingKind("shelvingPerforated", 4, "perforated", "steelDark");
export const shelvingSlatted = shelvingKind("shelvingSlatted", 4, "slatted", "steel");

/** The depth of each run of a corner unit, never more than half its footprint (mm). */
function runMm(w: number, d: number): number {
  return Math.min(RUN_MM, w / 2, d / 2);
}

/**
 * Corner shelving: a run along the back wall and one along the left wall, meeting in the back
 * left corner. The footprint is the whole square; the open corner in front stays free.
 */
export const shelvingCorner: KindDef = {
  kind: "shelvingCorner",
  plan(s) {
    const run = runMm(s.w, s.d);
    // The inner edge of the L and a diagonal in each run.
    s.line("detail", [s.R, s.B + run], [s.L + run, s.B + run], [s.L + run, s.F]);
    s.line("detail", [s.L + run, s.B], [s.R, s.B + run]);
    s.line("detail", [s.L, s.B + run], [s.L + run, s.F]);
    // The open corner in front of the L is not part of the unit.
    s.line("hidden", [s.L + run, s.F], [s.R, s.F], [s.R, s.B + run]);
  },
  elevation(f) {
    // Seen from the front: the left run's end with a post at its inner corner, the back run
    // behind it.
    shelvingFront(f, 4, false);
    const x = f.l + (f.w * runMm(f.item.width, f.item.depth)) / f.item.width;
    f.box("detail", x - LEG / 2, x + LEG / 2, f.z0, f.top);
  },
  elevationSide(f) {
    shelvingFront(f, 4, false);
  },
  mesh(p, s) {
    const run = runMm(s.w * 1000, s.d * 1000) / 1000;
    const L = -s.w / 2;
    const B = -s.d / 2;
    const c = POST / 2;
    for (const [x, z] of [
      [L + c, B + c],
      [s.w / 2 - c, B + c],
      [s.w / 2 - c, B + run - c],
      [L + run - c, B + run - c],
      [L + run - c, s.d / 2 - c],
      [L + c, s.d / 2 - c],
    ]) {
      post(p, "steelDark", x, z, s.h);
    }
    for (const y of levelHeights(s.h, 4)) {
      // The back run between its end posts, the left run in front of it.
      shelf(p, "solid", L + POST, s.w / 2 - POST, B, B + run, y);
      shelf(p, "solid", L, L + run, B + run, s.d / 2 - POST, y);
    }
  },
};
