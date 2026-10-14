// Utensil rail (Gerätereling): a round bar on wall brackets with S hooks, a few ladles,
// skimmers and whisks hanging from it. The utensils' lower ends define the unit's height.

import type { Parts } from "../parts/mesh";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Radius of the rail. */
const RAIL = 0.008;
/** Centre of the rail below the top. */
const RAIL_DROP = 0.02;
/** Radius of a wall rosette. */
const ROSETTE = 0.02;
/** Distance between two hooks. */
const HOOK_PITCH = 0.1;
/** Radius of a hook wire. */
const WIRE = 0.0025;
/** Distance of the end brackets from the rail ends. */
const BRACKET_INSET = 0.04;

/** Positions of the hooks along the width (m), centred on x = 0. */
function hooks(w: number): number[] {
  const span = Math.max(0, w - 2 * (BRACKET_INSET + 0.04));
  const n = Math.max(2, Math.floor(span / HOOK_PITCH) + 1);
  return Array.from({ length: n }, (_, i) => -span / 2 + (span * i) / (n - 1));
}

/** Radius of the ladle bowls and skimmers; the rail runs over their centres at the front. */
function bowl(d: number): number {
  return Math.min(0.035, d / 2);
}

/** One utensil of radius r hanging from the hook at x with its top at y, the lowest ones reaching y = 0. */
function utensil(p: Parts, i: number, x: number, y: number, z: number, r: number) {
  switch (i % 3) {
    case 0: // ladle: a bowl at the bottom of a long handle
      p.rod("steel", "y", x, (y + r) / 2, z, y - r, WIRE * 1.6);
      p.cyl("steel", x, z, 0, r * 0.9, r);
      break;
    case 1: // skimmer: a flat perforated disc
      p.rod("steel", "y", x, (y + r * 2) / 2, z, y - r * 2, WIRE * 1.6);
      p.rod("basket", "z", x, r * 1.2, z, 0.004, r);
      break;
    default: // whisk: a wire balloon on a handle
      p.rod("steelDark", "y", x, (y + r * 4) / 2, z, y - r * 4, WIRE * 2.4);
      p.cyl("basket", x, z, r * 0.8, r * 4, r * 0.7);
  }
}

export const utensilRail: KindDef = {
  kind: "utensilRail",
  placement: "overhead",
  plan(s) {
    const y = s.F - bowl(s.d / 1000) * 1000;
    s.line("overhead", [s.L, y], [s.R, y]);
    for (const x of [s.L + BRACKET_INSET * 1000, s.R - BRACKET_INSET * 1000]) s.line("overhead", [x, s.B], [x, y]);
  },
  elevation(f) {
    const zr = f.top - RAIL_DROP * 1000;
    f.box("detail", f.l, f.r, zr - RAIL * 1000, zr + RAIL * 1000);
    const c = (f.l + f.r) / 2;
    hooks(f.w / 1000).forEach((x, i) => {
      const xc = c + x * 1000;
      if (i % 2 === 1) {
        f.line("detail", [xc, zr], [xc, zr - 60]);
        return;
      }
      const r = 35;
      const low = i % 6 === 0 ? 0 : i % 6 === 2 ? r * 0.4 : r * 0.8;
      f.line("detail", [xc, zr], [xc, f.z0 + low + r * 2]);
      f.circle("detail", xc, f.z0 + low + r, r);
    });
  },
  mesh(p, s) {
    const y = s.h - RAIL_DROP;
    const B = -s.d / 2;
    const r = bowl(s.d);
    const z = s.d / 2 - r;
    p.rod("handle", "x", 0, y, z, s.w, RAIL);
    for (const x of [-s.w / 2 + BRACKET_INSET, s.w / 2 - BRACKET_INSET]) {
      p.rod("steel", "z", x, y, B + 0.004, 0.008, ROSETTE);
      p.rod("steel", "z", x, y, (B + z) / 2, z - B, RAIL * 0.7);
    }
    hooks(s.w).forEach((x, i) => {
      // An S hook over the rail; every other one carries a utensil.
      p.rod("steelDark", "y", x, y - RAIL - 0.02, z, 0.04 + RAIL, WIRE);
      if (i % 2 === 0) utensil(p, i / 2, x, y - RAIL - 0.04, z, r);
      else p.rod("steelDark", "z", x, y - RAIL - 0.04, z, 0.02, WIRE);
    });
  },
};
