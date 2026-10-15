// Utensil rail (Gerätereling): a round bar on wall brackets with S hooks, a few ladles,
// skimmers and whisks hanging from it. The utensils' lower ends define the unit's height.

import { arcPoints, type Parts } from "../parts/mesh";
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
/** Wires of a whisk. */
const WHISK_WIRES = 8;
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

/**
 * One utensil of radius r hanging from the hook at x with its top at y, the lowest ones reaching
 * y = 0: a ladle (a turned bowl on a long handle), a skimmer (a flat perforated disc) or a
 * whisk (a wire balloon on a turned grip).
 */
function utensil(p: Parts, i: number, x: number, y: number, z: number, r: number) {
  switch (i % 3) {
    case 0: {
      // Ladle: a turned bowl at the bottom, the handle bent down to its back rim.
      p.tube("steel", [
        { x, y, z },
        { x, y: r * 1.6, z },
        { x, y: r * 0.88, z: z - r * 0.95 },
      ], WIRE * 1.6, { bend: r * 0.3 });
      p.lathe("satin", x, 0, z, [
        ...arcPoints(0, r, r, -Math.PI / 2, 0, 4),
        ...arcPoints(0, r, r * 0.93, 0, -Math.PI / 2, 4).map(([a, b, c, d]) => [a, b, -(c ?? 0), -(d ?? 0)] as const),
      ]);
      break;
    }
    case 1: {
      // Skimmer: a flat dished disc with holes, facing the front.
      p.rod("steel", "y", x, (y + r * 2) / 2, z, y - r * 2, WIRE * 1.6);
      p.lathe("satin", x, r * 1.1, z - 0.002, [
        [0, 0],
        [r, 0],
        [r, 0.004],
        [0, 0.004],
      ], { axis: "z" });
      for (const [dx, dy] of [
        [0, 0],
        [r * 0.5, 0],
        [-r * 0.5, 0],
        [0, r * 0.5],
        [0, -r * 0.5],
      ]) {
        p.cyl("slot", x + dx, z + 0.0021, r * 1.1 + dy - 0.0002, r * 1.1 + dy + 0.0002, 0.004).rotation.x = Math.PI / 2;
      }
      break;
    }
    default:
      // Whisk: a wire balloon on a turned grip.
      p.lathe("knob", x, r * 3.6, z, [
        [0, 0],
        [WIRE * 2.4, 0],
        [WIRE * 3, (y - r * 3.6) * 0.1],
        [WIRE * 3, (y - r * 3.6) * 0.9],
        [WIRE * 2, y - r * 3.6],
        [0, y - r * 3.6],
      ]);
      p.wireCage(x, z, r * 0.8, r * 3.8, r * 0.7, WHISK_WIRES);
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
    p.rod("handle", "x", 0, y, z, s.w - 0.002, RAIL);
    // Turned end caps on the rail.
    for (const sx of [-1, 1]) p.lathe("handle", sx * (s.w / 2 - 0.004), y, z, [[0, 0], [RAIL * 1.1, 0], [RAIL * 1.1, 0.003], [RAIL * 0.6, 0.004], [0, 0.004]], { axis: "x" }).rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    for (const x of [-s.w / 2 + BRACKET_INSET, s.w / 2 - BRACKET_INSET]) {
      // A turned wall rosette and the stand-off carrying the rail.
      p.lathe("satin", x, y, B, [
        [0, 0],
        [ROSETTE, 0],
        [ROSETTE, 0.003],
        [ROSETTE * 0.6, 0.008],
        [RAIL * 0.8, 0.012],
        [0, 0.012],
      ], { axis: "z" });
      p.rod("satin", "z", x, y, (B + z) / 2, z - B, RAIL * 0.7);
    }
    hooks(s.w).forEach((x, i) => {
      // An S hook over the rail; every other one carries a utensil.
      const yh = y - RAIL - 0.04;
      p.tube("steelDark", [
        { x, y: y + RAIL * 0.4, z: z - RAIL - WIRE },
        { x, y: y + RAIL + WIRE * 2, z: z - RAIL * 0.4 },
        { x, y: y + RAIL * 0.4, z: z + RAIL + WIRE },
        { x, y: yh, z },
      ], WIRE, { bend: 0.004 });
      if (i % 2 === 0) utensil(p, i / 2, x, yh, z, r);
    });
  },
};
