// Wall protection: a bumper rail along the wall at trolley height (Rammschutzleiste), its
// profile rounded and capped at both ends, and a stainless corner guard (Kantenschutz) for an
// outside corner of a wall.

import { BODY_RADIUS, type Point2 } from "../parts/mesh";
import type { KindDef } from "../types";

// Sizes (m).
/** The rail's aluminium carrier: depth from the wall. */
const CARRIER = 0.015;
/** Length of an end cap. */
const CAP = 0.03;

/**
 * The bumper's section in (z, y) from the carrier at `z0` to the front at `z1`, `h` high: a
 * face bulging out to the front in a shallow curve, thinner at the top and bottom edges.
 */
function bumper(z0: number, z1: number, h: number): Point2[] {
  const steps = 8;
  const face: Point2[] = Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps;
    return [z1 - (z1 - z0) * 0.35 * (1 - Math.sin(Math.PI * t)), 0.004 + t * (h - 0.008)] as const;
  });
  return [[z0, 0.004], ...face, [z0, h - 0.004]];
}

export const wallGuardRail: KindDef = {
  kind: "wallGuardRail",
  placement: "overhead",
  plan(s) {
    s.line("overhead", [s.L + CAP * 1000, s.B + CARRIER * 1000], [s.R - CAP * 1000, s.B + CARRIER * 1000]);
  },
  elevation(f) {
    const c = CAP * 1000;
    f.line("detail", [f.l + c, f.z0], [f.l + c, f.top]);
    f.line("detail", [f.r - c, f.z0], [f.r - c, f.top]);
    const zm = (f.z0 + f.top) / 2;
    f.line("detail", [f.l + c, zm], [f.r - c, zm]);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const B = -s.d / 2;
    const F = s.d / 2;
    // The carrier on the wall, the bumper over it, and turned caps at the ends.
    p.roundedBox("satin", -W + CAP, W - CAP, 0.002, s.h - 0.002, B, B + CARRIER, BODY_RADIUS);
    p.extrude("panelDark", "x", -W + CAP, W - CAP, bumper(B + CARRIER - 0.002, F - 0.002, s.h));
    for (const sx of [-1, 1]) {
      const x0 = sx > 0 ? W - CAP : -W;
      p.roundedBox("knob", x0, x0 + CAP, 0, s.h, B, F, Math.min(0.02, s.h / 2, (F - B) / 2), "all", "x");
    }
    // A bright strip along the middle of the bumper.
    p.extrude("satin", "x", -W + CAP, W - CAP, [
      [F - 0.003, s.h / 2 - 0.012],
      [F, s.h / 2 - 0.01],
      [F, s.h / 2 + 0.01],
      [F - 0.003, s.h / 2 + 0.012],
    ]);
  },
};

/** Sheet thickness and bend radius of the corner guard (m). */
const GUARD_T = 0.0015;
const BEND = 0.004;

export const cornerGuard: KindDef = {
  kind: "cornerGuard",
  placement: "overhead",
  plan(s) {
    // The angle round the corner: its legs along the front and the left side.
    s.line("overhead", [s.R, s.F], [s.L, s.F], [s.L, s.B]);
  },
  elevation(f) {
    f.line("detail", [f.l + 10, f.z0], [f.l + 10, f.top]);
  },
  elevationSide(f) {
    f.line("detail", [f.l + 10, f.z0], [f.l + 10, f.top]);
  },
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    // One sheet bent round the corner at the front left, the wall's corner behind it.
    const pts: Point2[] = [
      [W, D],
      ...Array.from({ length: 4 }, (_, k) => {
        const a = Math.PI / 2 + (k / 3) * (Math.PI / 2);
        return [-W + BEND + BEND * Math.cos(a), D - BEND + BEND * Math.sin(a)] as const;
      }),
      [-W, -D],
      [-W + GUARD_T, -D],
      ...Array.from({ length: 4 }, (_, k) => {
        const a = Math.PI - (k / 3) * (Math.PI / 2);
        const r = BEND - GUARD_T;
        return [-W + BEND + r * Math.cos(a), D - BEND + r * Math.sin(a)] as const;
      }),
      [W, D - GUARD_T],
    ];
    p.extrude("steel", "y", 0, s.h, pts);
  },
};
