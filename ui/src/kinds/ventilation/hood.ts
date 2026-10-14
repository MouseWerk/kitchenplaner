// Canopy hoods: an open sheet steel canopy over the cooking line with a grease filter bank in a
// plenum, lights in its ceiling and a gutter round the lower edge. The wall hood has its filter
// plenum against the wall, the island hood a plenum along its middle with a bank either side.
// The filters face down, so they show from below in 3D.

import { INSET } from "../parts/elevation";
import { GAP, SHEET, type Parts, type Size } from "../parts/mesh";
import { cross, INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Usual width of a grease filter of a canopy hood (mm, 500 × 500 filters). */
const FILTER = 500;
/** Depth of the filter plenum against the wall (share of the depth, at most 350 mm). */
const PLENUM_SHARE = 0.35;
const PLENUM_MAX = 350;
/** Lower edge of the filter bank above the hood's lower edge (share of the height). */
const FILTER_LEVEL = 0.35;
/** Gutter round the inside of the lower edge (m), the fold line under the top (m). */
const GUTTER = { w: 0.05, h: 0.04 };
const FOLD = 0.07;
/** One light per this much width (m) and the size of a light panel (m). */
const LIGHT_PITCH = 1.2;
const LIGHT = { w: 0.32, d: 0.12 };

/** Depth of the filter plenum (mm): against the wall for a wall hood, either side of the middle for an island hood. */
function plenum(depth: number, island: boolean): number {
  return Math.min(PLENUM_MAX, depth * (island ? PLENUM_SHARE / 2 : PLENUM_SHARE));
}

/**
 * A bank of grease filters facing down, from z0 to z1 at height y (m): a frame cassette per
 * filter with two baffles under it.
 */
function filterBank(p: Parts, s: Size, y: number, z0: number, z1: number): void {
  const n = Math.max(1, Math.round(s.w / (FILTER / 1000)));
  const fw = (s.w - SHEET * 2) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -s.w / 2 + SHEET + i * fw + GAP;
    const x1 = x0 + fw - GAP * 2;
    p.box("steelDark", x0, x1, y - 0.02, y, z0, z1);
    for (const t of [1 / 3, 2 / 3]) {
      const x = x0 + (x1 - x0) * t;
      p.box("steel", x - 0.006, x + 0.006, y - 0.028, y - 0.02, z0 + 0.01, z1 - 0.01);
    }
  }
}

function makeHood(kind: string, island: boolean): KindDef {
  return {
    kind,
    placement: "overhead",
    plan(s) {
      cross(s, "overhead");
      const pd = plenum(s.d, island);
      if (island) {
        for (const y of [-pd, pd]) s.line("overhead", [s.L + PLAN_INSET, y], [s.R - PLAN_INSET, y]);
      } else {
        s.line("overhead", [s.L + PLAN_INSET, s.B + pd], [s.R - PLAN_INSET, s.B + pd]);
      }
    },
    elevation(f) {
      const { l, r, z0, top, w } = f;
      // The fold under the top and the gutter at the lower edge; the filters behind the skirt.
      f.line("detail", [l, top - FOLD * 1000], [r, top - FOLD * 1000]);
      f.line("detail", [l, z0 + GUTTER.h * 1000], [r, z0 + GUTTER.h * 1000]);
      const n = Math.max(1, Math.floor((w - 2 * INSET) / FILTER));
      const fw = (w - 2 * INSET) / n;
      const fz0 = z0 + f.item.height * FILTER_LEVEL;
      const fz1 = Math.min(top - FOLD * 1000 - INSET / 2, fz0 + FILTER * 0.5);
      for (let i = 0; i < n; i++) {
        const a = l + INSET + i * fw;
        f.box("hidden", a + INSET / 4, a + fw - INSET / 4, fz0, fz1);
      }
    },
    mesh(p, s) {
      const { w, d, h } = s;
      const lip = 0.002;
      // Canopy: top and four skirts; the front skirt stands back by the lip of its rolled edges.
      p.box("steel", -w / 2, w / 2, h - SHEET, h, -d / 2, d / 2 - lip);
      p.box("steel", -w / 2, w / 2, 0, h, d / 2 - lip - SHEET, d / 2 - lip);
      p.box("steel", -w / 2, w / 2, 0, h, -d / 2, -d / 2 + SHEET);
      p.box("steel", -w / 2, -w / 2 + SHEET, 0, h, -d / 2, d / 2 - lip);
      p.box("steel", w / 2 - SHEET, w / 2, 0, h, -d / 2, d / 2 - lip);
      // Rolled lower edge and fold line along the front.
      p.box("steelDark", -w / 2, w / 2, 0, 0.012, d / 2 - lip, d / 2);
      p.box("steelDark", -w / 2, w / 2, h - FOLD - 0.004, h - FOLD, d / 2 - lip, d / 2);
      // Grease gutter inside the lower edge (front and sides; an island hood also at the back).
      const gz0 = island ? -d / 2 + SHEET : -d / 2 + SHEET + plenum(d * 1000, false) / 1000;
      p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, 0, GUTTER.h, d / 2 - lip - SHEET - GUTTER.w, d / 2 - lip - SHEET);
      for (const x of [-w / 2 + SHEET, w / 2 - SHEET - GUTTER.w]) p.box("steelDark", x, x + GUTTER.w, 0, GUTTER.h, gz0, d / 2 - lip - SHEET);
      if (island) p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, 0, GUTTER.h, -d / 2 + SHEET, -d / 2 + SHEET + GUTTER.w);
      // Filter plenum and its filter banks.
      const pd = plenum(d * 1000, island) / 1000;
      const fy = h * FILTER_LEVEL;
      if (island) {
        p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, fy, h - SHEET, -pd, pd);
        filterBank(p, s, fy, -pd, -GAP);
        filterBank(p, s, fy, GAP, pd);
      } else {
        p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, fy, h - SHEET, -d / 2 + SHEET, -d / 2 + pd);
        filterBank(p, s, fy, -d / 2 + SHEET, -d / 2 + pd);
      }
      // Lights in the canopy's ceiling, between the plenum and the skirts.
      const zs = island ? [-(pd + d / 2) / 2, (pd + d / 2) / 2] : [(-d / 2 + pd + d / 2) / 2];
      const n = Math.max(1, Math.round(w / LIGHT_PITCH));
      const lw = Math.min(LIGHT.w, w / n - 0.1);
      const ld = Math.min(LIGHT.d, (d / 2 - pd) * 0.6);
      for (const z of zs) {
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + (w / n) * (i + 0.5);
          p.box("steelDark", x - lw / 2 - 0.01, x + lw / 2 + 0.01, h - SHEET - 0.012, h - SHEET, z - ld / 2 - 0.01, z + ld / 2 + 0.01);
          p.box("panel", x - lw / 2, x + lw / 2, h - SHEET - 0.016, h - SHEET - 0.012, z - ld / 2, z + ld / 2);
        }
      }
    },
  };
}

export const hood = makeHood("hood", false);
export const hoodIsland = makeHood("hoodIsland", true);
