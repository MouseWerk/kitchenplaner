// Canopy hoods: an open sheet steel canopy over the cooking line with a grease filter bank in a
// plenum, lights in its ceiling and a gutter round the lower edge. The wall hood has its filter
// plenum against the wall, the island hood a plenum along its middle with a bank either side.
// Seen from above a canopy shows its 45° folded front (both long sides on an island hood), the
// seams between its sections and the exhaust collars on the plenum, which rise above the canopy
// into the duct. The filters face down, so they show from below in 3D.

import { INSET } from "../parts/elevation";
import { BODY_RADIUS, GAP, SHEET, type Parts, type Point2, type Size } from "../parts/mesh";
import { cross, INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Usual width of a grease filter of a canopy hood (mm, 500 × 500 filters). */
const FILTER = 500;
/** Depth of the filter plenum against the wall (share of the depth, at most 350 mm). */
const PLENUM_SHARE = 0.35;
const PLENUM_MAX = 350;
/** Lower edge of the filter bank above the hood's lower edge (share of the height). */
const FILTER_LEVEL = 0.35;
/** Gutter round the inside of the lower edge (m). */
const GUTTER = { w: 0.05, h: 0.04 };
/** Rise and run of the 45° fold at the top of the front (m), at most this share of the height. */
const SLOPE = 0.18;
const SLOPE_SHARE = 0.4;
/** The skirts stand back by this from the outline so the rolled lower edge shows (m). */
const EDGE = 0.004;
/** Radius of the rolled lower edge (m). */
const ROLL = 0.008;
/** Outer radius of the 45° fold at the top of the skirt (m). */
const FOLD = 0.02;
/** Steps of the rolled edge's round and of the fold's bend. */
const ROLL_STEPS = 10;
const FOLD_STEPS = 3;
/** How far seams stand out of the sheet (m). */
const SEAM = 0.001;
/** Canopies come in sections of at most this length, joined by a seam (m). */
const SECTION = 1.2;
/** One exhaust collar per this much width (m), its radius (Ø 250) and how far it rises (mm). */
const COLLAR_PITCH = 1.6;
const COLLAR_R = 0.125;
const COLLAR_RISE = 100;
/** Wall of a collar's spigot as drawn (m). */
const SPIGOT = 0.003;
/** One light per this much width (m) and the size of a light panel (m). */
const LIGHT_PITCH = 1.2;
const LIGHT = { w: 0.32, d: 0.12 };
/** Switch panel on the front skirt (m): width, height, inset from the right end. */
const SWITCHES = { w: 0.16, h: 0.08, inset: 0.12 };

/** Depth of the filter plenum (mm): against the wall for a wall hood, either side of the middle for an island hood. */
function plenum(depth: number, island: boolean): number {
  return Math.min(PLENUM_MAX, depth * (island ? PLENUM_SHARE / 2 : PLENUM_SHARE));
}

/** Rise (and run) of the folded front (m). */
function slope(h: number): number {
  return Math.min(SLOPE, h * SLOPE_SHARE);
}

/** Centres of the exhaust collars along the width (m, x from -w/2 to w/2). */
function collarXs(w: number): number[] {
  const n = Math.max(1, Math.round(w / COLLAR_PITCH));
  return Array.from({ length: n }, (_, i) => -w / 2 + (w / n) * (i + 0.5));
}

/** Positions of the seams between the canopy's sections along the width (m). */
function seamXs(w: number): number[] {
  const n = Math.max(1, Math.ceil(w / SECTION - 0.01));
  return Array.from({ length: n - 1 }, (_, i) => -w / 2 + (w / n) * (i + 1));
}

/** Depth of the collars' centre line from the back (m): over the wall plenum, or the middle. */
function collarZ(d: number, island: boolean): number {
  return island ? 0 : -d / 2 + plenum(d * 1000, false) / 2000;
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

/**
 * The profile of a canopy's front (dir 1) or back (dir -1) as (z, y) for `Parts.extrude` along x:
 * the skirt's sheet standing at `z` from its rolled lower edge, a round bead reaching out to
 * `zEdge`, up to the 45° fold with its rounded bend and up the slope to the top at `h`, where it
 * ends level so the top sheet carries on from it.
 */
function skirtProfile(z: number, zEdge: number, h: number, sl: number, dir: 1 | -1): Point2[] {
  const t = SHEET;
  // Worked out for the front (outside at +z) and mirrored for the back.
  const at = (dz: number, y: number): Point2 => [z + dir * dz, y];
  const out: Point2[] = [];
  // The bead: a round of radius ROLL on the floor line reaching out to `zEdge`, from where it
  // leaves the inside of the sheet, under it and up to where it meets the outside.
  const c = dir * (zEdge - z) - ROLL;
  const start = Math.acos(Math.max(-1, Math.min(1, (-t - c) / ROLL)));
  const end = Math.PI * 2 + Math.acos(Math.max(-1, Math.min(1, -c / ROLL)));
  for (let k = 0; k <= ROLL_STEPS; k++) {
    const a = start + ((end - start) * k) / ROLL_STEPS;
    out.push(at(c + ROLL * Math.cos(a), ROLL + ROLL * Math.sin(a)));
  }
  // Up the outside to the fold, round its bend and up the slope to the top.
  const tan = FOLD * Math.tan(Math.PI / 8);
  for (let k = 0; k <= FOLD_STEPS; k++) {
    const a = (Math.PI / 4) * (k / FOLD_STEPS);
    out.push(at(-FOLD + FOLD * Math.cos(a), h - sl - tan + FOLD * Math.sin(a)));
  }
  out.push(at(-sl, h), at(-sl - t * Math.SQRT2, h));
  // Down the inside of the slope and the skirt; the bead's first point closes the outline.
  out.push(at(-t, h - sl - t * (Math.SQRT2 - 1)));
  return dir === 1 ? out : out.reverse();
}

/** The canopy's shell: top, folded skirts with their rolled edges, sides and seams. */
function canopy(p: Parts, { w, d, h }: Size, island: boolean): void {
  const sl = slope(h);
  const zf = d / 2 - EDGE;
  const zb = island ? -zf : -d / 2;
  const topZ0 = island ? zb + sl + SHEET * Math.SQRT2 : zb;
  const xs = [-w / 2, w / 2 - SHEET];
  // The top ends where the skirt's profile takes over (no faces on top of each other); the
  // skirts are one sheet each from the rolled edge over the fold, at the front and on an island
  // hood also at the back.
  p.box("steel", -w / 2, w / 2, h - SHEET, h, topZ0, zf - sl - SHEET * Math.SQRT2);
  const ends: [number, number, 1 | -1][] = island ? [[zf, d / 2, 1], [zb, -d / 2, -1]] : [[zf, d / 2, 1]];
  for (const [z, zEdge, dir] of ends) {
    p.extrude("steel", "x", -w / 2, w / 2, skirtProfile(z, zEdge, h, sl, dir));
    for (const x of xs) {
      p.box("steel", x, x + SHEET, 0, h - sl, Math.min(z, z - dir * sl), Math.max(z, z - dir * sl));
      p.chamferCorner("steel", x, x + SHEET, z, h, sl, dir);
    }
  }
  if (!island) p.box("steel", -w / 2, w / 2, 0, h, -d / 2, -d / 2 + SHEET);
  for (const x of xs) p.box("steel", x, x + SHEET, 0, h, topZ0, zf - sl);
  // Rolled edge along the sides.
  for (const x of [-w / 2 + ROLL, w / 2 - ROLL]) p.rod("steel", "z", x, ROLL, (zb + zf) / 2, zf - zb, ROLL);
  // Seams between the sections over the top, down the folds and the skirts, standing out by a
  // millimetre so they do not fight with the sheet's face.
  const sw = 0.003;
  for (const x of seamXs(w)) {
    p.box("steelDark", x - sw, x + sw, h - 0.001, h + SEAM, topZ0, zf - sl);
    for (const [z, , dir] of ends) {
      const m = p.slope("steelDark", x - sw, x + sw, z - dir * sl, h, sl, dir, 0.002);
      m.position.y += Math.SQRT1_2 * SEAM;
      m.position.z += dir * Math.SQRT1_2 * SEAM;
      p.box("steelDark", x - sw, x + sw, ROLL * 2, h - sl, Math.min(z - dir * 0.001, z + dir * SEAM), Math.max(z - dir * 0.001, z + dir * SEAM));
    }
  }
}

function makeHood(kind: string, island: boolean): KindDef {
  return {
    kind,
    placement: "overhead",
    rise: COLLAR_RISE,
    plan(s) {
      cross(s, "overhead");
      const pd = plenum(s.d, island);
      const sl = slope(s.item.height / 1000) * 1000;
      const zc = collarZ(s.d / 1000, island) * 1000;
      // The fold line(s) of the canopy, the plenum and the exhaust collars on it.
      s.line("overhead", [s.L, s.F - sl], [s.R, s.F - sl]);
      if (island) {
        s.line("overhead", [s.L, s.B + sl], [s.R, s.B + sl]);
        for (const y of [-pd, pd]) s.line("overhead", [s.L + PLAN_INSET, y], [s.R - PLAN_INSET, y]);
      } else {
        s.line("overhead", [s.L + PLAN_INSET, s.B + pd], [s.R - PLAN_INSET, s.B + pd]);
      }
      for (const x of collarXs(s.w / 1000)) s.circle("overhead", x * 1000, zc, COLLAR_R * 1000);
    },
    elevation(f) {
      const { l, r, z0, top, w } = f;
      const sl = slope(f.item.height / 1000) * 1000;
      // The fold, the rolled edge, the seams and the switch panel; the filters behind the skirt.
      f.line("detail", [l, top - sl], [r, top - sl]);
      f.line("detail", [l, z0 + ROLL * 2000], [r, z0 + ROLL * 2000]);
      for (const x of seamXs(w / 1000)) f.line("detail", [l + w / 2 + x * 1000, z0 + ROLL * 2000], [l + w / 2 + x * 1000, top]);
      const sx1 = r - SWITCHES.inset * 1000;
      const sz0 = z0 + (f.item.height - sl - SWITCHES.h * 1000) / 2;
      f.box("detail", sx1 - SWITCHES.w * 1000, sx1, sz0, sz0 + SWITCHES.h * 1000, "item-dark");
      const n = Math.max(1, Math.floor((w - 2 * INSET) / FILTER));
      const fw = (w - 2 * INSET) / n;
      const fz0 = z0 + f.item.height * FILTER_LEVEL;
      const fz1 = Math.min(top - INSET / 2, fz0 + FILTER * 0.5);
      for (let i = 0; i < n; i++) {
        const a = l + INSET + i * fw;
        f.box("hidden", a + INSET / 4, a + fw - INSET / 4, fz0, fz1);
      }
      collarsFront(f, collarXs(w / 1000).map((x) => l + w / 2 + x * 1000));
    },
    elevationSide(f) {
      const { l, r, top, w } = f;
      // Seen from the side: the rolled edge, and on an island hood the folds of both long sides.
      const sl = slope(f.item.height / 1000) * 1000;
      if (island) {
        // The collars stand in the middle.
        f.line("detail", [l, top - sl], [l + sl, top]);
        f.line("detail", [r - sl, top], [r, top - sl]);
        collarsFront(f, [l + w / 2]);
      }
      f.line("detail", [l, f.z0 + ROLL * 2000], [r, f.z0 + ROLL * 2000]);
    },
    mesh(p, s) {
      const { w, d, h } = s;
      canopy(p, s, island);
      const zf = d / 2 - EDGE;
      const sl = slope(h);
      // Grease gutter inside the lower edge (front and sides; an island hood also at the back).
      const gz0 = island ? -zf + SHEET : -d / 2 + SHEET + plenum(d * 1000, false) / 1000;
      p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, 0, GUTTER.h, zf - SHEET - GUTTER.w, zf - SHEET);
      for (const x of [-w / 2 + SHEET, w / 2 - SHEET - GUTTER.w]) p.box("steelDark", x, x + GUTTER.w, 0, GUTTER.h, gz0, zf - SHEET);
      if (island) p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, 0, GUTTER.h, -zf + SHEET, -zf + SHEET + GUTTER.w);
      // Filter plenum and its filter banks; its front wall shows on the top as a seam.
      const pd = plenum(d * 1000, island) / 1000;
      const fy = h * FILTER_LEVEL;
      if (island) {
        p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, fy, h - SHEET, -pd, pd);
        filterBank(p, s, fy, -pd, -GAP);
        filterBank(p, s, fy, GAP, pd);
        for (const z of [-pd, pd]) p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, h - 0.001, h + SEAM, z - 0.003, z + 0.003);
      } else {
        p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, fy, h - SHEET, -d / 2 + SHEET, -d / 2 + pd);
        filterBank(p, s, fy, -d / 2 + SHEET, -d / 2 + pd);
        p.box("steelDark", -w / 2 + SHEET, w / 2 - SHEET, h - 0.001, h + SEAM, -d / 2 + pd - 0.003, -d / 2 + pd + 0.003);
      }
      // Exhaust collars on the plenum: a flange, the spigot and its dark opening.
      const rise = COLLAR_RISE / 1000;
      const zc = collarZ(d, island);
      for (const x of collarXs(w)) {
        // The flange on the top, the spigot with its bead and open mouth, dark inside.
        p.lathe("steelDark", x, h, zc, [
          [0, 0],
          [COLLAR_R + 0.02, 0],
          [COLLAR_R + 0.02, 0.006],
          [COLLAR_R + 0.012, 0.01],
          [0, 0.01],
        ]);
        p.lathe("steel", x, h, zc, [
          [0, 0],
          [COLLAR_R, 0],
          [COLLAR_R, rise - 0.03],
          [COLLAR_R + 0.004, rise - 0.026],
          [COLLAR_R, rise - 0.022],
          [COLLAR_R, rise],
          [COLLAR_R - SPIGOT, rise],
          [COLLAR_R - SPIGOT, rise - 0.04],
          [0, rise - 0.04],
        ]);
        p.cyl("slot", x, zc, h + rise - 0.04, h + rise - 0.039, COLLAR_R - SPIGOT);
      }
      // Switch panel for the lights and the fan on the front skirt, right.
      const sx1 = w / 2 - SWITCHES.inset;
      const sy0 = (h - sl - SWITCHES.h) / 2;
      p.plate("panelDark", sx1 - SWITCHES.w, sx1, sy0, sy0 + SWITCHES.h, zf - 0.002, d / 2 - 0.002, BODY_RADIUS * 3, true);
      for (const k of [0.3, 0.7]) {
        const x = sx1 - SWITCHES.w * k;
        p.box("handle", x - 0.012, x + 0.012, sy0 + SWITCHES.h * 0.3, sy0 + SWITCHES.h * 0.7, d / 2 - 0.002, d / 2);
      }
      // Lights in the canopy's ceiling, between the plenum and the fold.
      const zMax = zf - sl - 0.08;
      const zs = (island ? [-(pd + d / 2) / 2, (pd + d / 2) / 2] : [(-d / 2 + pd + d / 2) / 2]).map((z) => Math.max(-zMax, Math.min(zMax, z)));
      const n = Math.max(1, Math.round(w / LIGHT_PITCH));
      const lw = Math.min(LIGHT.w, w / n - 0.1);
      const ld = Math.min(LIGHT.d, (d / 2 - pd) * 0.6);
      for (const z of zs) {
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + (w / n) * (i + 0.5);
          p.box("steelDark", x - lw / 2 - 0.01, x + lw / 2 + 0.01, h - SHEET - 0.012, h - SHEET, z - ld / 2 - 0.01, z + ld / 2 + 0.01);
          p.roundedBox("panel", x - lw / 2, x + lw / 2, h - SHEET - 0.016, h - SHEET - 0.012, z - ld / 2, z + ld / 2, 0.01, "vertical");
        }
      }
    },
  };
}

/** The exhaust collars above the top at the given X (elevation, mm). */
function collarsFront(f: Parameters<KindDef["elevation"]>[0], xs: number[]): void {
  const r = COLLAR_R * 1000;
  for (const x of xs) {
    f.box("detail", x - r, x + r, f.top, f.top + COLLAR_RISE);
    f.line("detail", [x - r - 20, f.top + 10], [x + r + 20, f.top + 10]);
  }
}

export const hood = makeHood("hood", false);
export const hoodIsland = makeHood("hoodIsland", true);
