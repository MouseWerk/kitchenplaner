// Bread rack (Brotregal): a stainless frame on feet with slatted beech shelves, each with a stop
// rail at the front, loaves and baguettes lying on some of them.

import type { Front } from "../parts/elevation";
import { foot, LEG_RADIUS, TOP_RADIUS, type Parts } from "../parts/mesh";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Square tube of the frame. */
const TUBE = 0.03;
/** Height of the feet. */
const FEET = 0.08;
/** Shelves and their lowest level. */
const LEVELS = 5;
const LOW = 0.3;
/** Slats: thickness, width, pitch. */
const SLAT = 0.018;
const SLAT_W = 0.06;
const SLAT_PITCH = 0.085;
/** Height of the stop rail along the front of a shelf. */
const STOP = 0.04;
/** A loaf: length, width, height; a baguette's radius and length. */
const LOAF = { l: 0.26, w: 0.12, h: 0.1 };
const BAGUETTE_R = 0.03;

function levels(h: number): number[] {
  return Array.from({ length: LEVELS }, (_, i) => LOW + ((h - SLAT - LOW) * i) / (LEVELS - 1));
}

function slats(d: number): number[] {
  const inner = d - 2 * TUBE;
  const n = Math.max(2, Math.round(inner / SLAT_PITCH));
  return Array.from({ length: n }, (_, i) => -d / 2 + TUBE + SLAT_W / 2 + ((inner - SLAT_W) * i) / (n - 1));
}

/** Loaves along a shelf from x0 to x1 lying on `y`, across the depth. */
function loaves(p: Parts, x0: number, x1: number, y: number, d: number) {
  const n = Math.max(1, Math.floor((x1 - x0) / (LOAF.w + 0.03)));
  const pitch = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + pitch * (i + 0.5);
    const z = -d / 2 + TUBE + 0.03 + LOAF.l / 2 + (i % 2) * 0.02;
    p.roundedBox("foodBrown", x - LOAF.w / 2, x + LOAF.w / 2, y, y + LOAF.h, z - LOAF.l / 2, z + LOAF.l / 2, LOAF.h * 0.38);
  }
}

/** Baguettes along the shelf, lying side by side. */
function baguettes(p: Parts, x0: number, x1: number, y: number, d: number) {
  const n = Math.max(1, Math.floor((d - 2 * TUBE - STOP) / (BAGUETTE_R * 2.4)));
  for (let i = 0; i < Math.min(n, 4); i++) {
    const z = -d / 2 + TUBE + BAGUETTE_R + 0.01 + i * BAGUETTE_R * 2.4;
    p.tube("foodBrown", [
      { x: x0 + 0.04, y: y + BAGUETTE_R, z },
      { x: x1 - 0.04, y: y + BAGUETTE_R, z },
    ], BAGUETTE_R, { segments: 12 });
  }
}

export const breadRack: KindDef = {
  kind: "breadRack",
  plan(s) {
    cross(s, "detail", false);
    s.line("detail", [s.L + TUBE * 1000, s.F - TUBE * 1000], [s.R - TUBE * 1000, s.F - TUBE * 1000]);
  },
  elevation(f: Front) {
    const t = TUBE * 1000;
    f.box("detail", f.l, f.l + t, f.z0, f.top);
    f.box("detail", f.r - t, f.r, f.z0, f.top);
    for (const y of levels(f.item.height / 1000)) {
      const z = f.z0 + y * 1000;
      f.box("detail", f.l + t, f.r - t, z, z + SLAT * 1000);
      const zs = Math.min(z + STOP * 1000, f.top - 8);
      f.line("detail", [f.l + t, zs], [f.r - t, zs]);
    }
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (W - TUBE / 2);
        const z = sz * (D - TUBE / 2);
        foot(p, x, z, FEET, TUBE / 2);
        p.roundedBox("steel", x - TUBE / 2, x + TUBE / 2, FEET, s.h, z - TUBE / 2, z + TUBE / 2, LEG_RADIUS, "vertical");
      }
    }
    const ys = levels(s.h);
    ys.forEach((y, i) => {
      // Bearers along the depth at both ends, the slats on them and the stop rail in front.
      for (const sx of [-1, 1]) p.roundedBox("steel", sx > 0 ? W - TUBE : -W, sx > 0 ? W : -W + TUBE, y - 0.03, y, -D + TUBE, D - TUBE, 0.002, "all", "z");
      for (const z of slats(s.d)) p.roundedBox("wood", -W + TUBE, W - TUBE, y, y + SLAT, z - SLAT_W / 2, z + SLAT_W / 2, TOP_RADIUS);
      p.rod("steel", "x", 0, Math.min(y + STOP, s.h - 0.008), D - TUBE / 2, s.w - 2 * TUBE, 0.006);
      if (i === 1 || i === 3) loaves(p, -W + TUBE, W - TUBE, y + SLAT, s.d);
      if (i === 2) baguettes(p, -W + TUBE, W - TUBE, y + SLAT, s.d);
    });
  },
};
