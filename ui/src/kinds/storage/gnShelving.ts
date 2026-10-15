// Shelving with Gastronorm runners (GN-Auflagenregal) for the cold room: aluminium posts carrying
// a front and a back rail on every level and angle runners between them, so GN 1/1 containers
// hang in it side by side by their rims, long side front to back.

import type { Front } from "../parts/elevation";
import { BODY_RADIUS, GN_RADIUS, type Parts } from "../parts/mesh";
import type { PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { POST_R, roundPost } from "./helpers";

// Construction sizes (m).
/** Room a post takes at each corner. */
const POST = 0.03;
/** Width of one GN 1/1 bay (325 mm and play) and the levels. */
const BAY = 0.335;
const LEVELS = 6;
/** The front and back rails of a level: depth and height. */
const RAIL_D = 0.025;
const RAIL_H = 0.03;
/** Angle runner: width, upright leg. */
const RUNNER = 0.02;
const RUNNER_UP = 0.012;
/** Depth of a GN container and its rim. */
const GN = 0.1;
const GN_RIM = 0.012;
/** Lowest level above the floor. */
const LOW = 0.2;

/** Bays across the width: how many and the x of the runners between and beside them (m). */
function bays(w: number): number[] {
  const inner = w - 2 * POST;
  const n = Math.max(1, Math.floor(inner / BAY));
  const used = n * BAY;
  return Array.from({ length: n + 1 }, (_, i) => -used / 2 + i * BAY);
}

function levels(h: number): number[] {
  // The top level's runners stay under the posts' caps.
  const top = h - RAIL_H - RUNNER_UP;
  return Array.from({ length: LEVELS }, (_, i) => LOW + ((top - LOW) * i) / (LEVELS - 1));
}

function planGn(s: PlanSketch) {
  const q = (POST * 1000) / 2;
  for (const x of [s.L + q, s.R - q]) for (const y of [s.B + q, s.F - q]) s.circle("detail", x, y, POST_R * 1000);
  for (const y of [s.B + RAIL_D * 1000, s.F - RAIL_D * 1000]) s.line("detail", [s.L + POST * 1000, y], [s.R - POST * 1000, y]);
  for (const x of bays(s.w / 1000)) s.line("detail", [x * 1000, s.B + RAIL_D * 1000], [x * 1000, s.F - RAIL_D * 1000]);
}

function frontGn(f: Front) {
  const p = POST * 1000;
  f.box("detail", f.l, f.l + p, f.z0, f.top);
  f.box("detail", f.r - p, f.r, f.z0, f.top);
  const c = (f.l + f.r) / 2;
  const xs = bays(f.w / 1000);
  for (const y of levels(f.item.height / 1000)) {
    const z = f.z0 + y * 1000;
    f.box("detail", f.l + p, f.r - p, z, z + RAIL_H * 1000);
    // The containers' fronts hanging below the rail.
    for (let i = 0; i + 1 < xs.length; i++) f.box("detail", c + xs[i] * 1000 + 8, c + xs[i + 1] * 1000 - 8, z - GN * 1000 + GN_RIM * 1000, z);
  }
}

/** One runner along the depth at x, its top at y: an upright angle between the two rails. */
function runner(p: Parts, x: number, y: number, z0: number, z1: number) {
  p.roundedBox("satin", x - RUNNER / 2, x + RUNNER / 2, y - 0.003, y, z0, z1, 0.001);
  p.roundedBox("satin", x - 0.0015, x + 0.0015, y, y + RUNNER_UP, z0, z1, 0.001);
}

export const gnShelving: KindDef = {
  kind: "gnShelving",
  plan: planGn,
  elevation: frontGn,
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) roundPost(p, "satin", sx * (W - POST / 2), sz * (D - POST / 2), s.h);
    const xs = bays(s.w);
    const z0 = -D + RAIL_D;
    const z1 = D - RAIL_D;
    levels(s.h).forEach((y, li) => {
      for (const [a, b] of [
        [-D + 0.002, z0],
        [z1, D - 0.002],
      ]) {
        p.roundedBox("satin", -W + POST / 2, W - POST / 2, y, y + RAIL_H, a, b, BODY_RADIUS);
      }
      for (const x of xs) runner(p, x, y + RAIL_H - 0.002, z0, z1);
      // Containers in some of the bays, hanging by their rims on the runners.
      for (let i = 0; i + 1 < xs.length; i++) {
        if ((li + i) % 3 === 2) continue;
        const a = xs[i] + RUNNER / 4;
        const b = xs[i + 1] - RUNNER / 4;
        const top = y + RAIL_H + 0.0005;
        p.pan("steel", a, b, top - GN, top, z0 + 0.004, z1 - 0.004, { wall: 0.003, r: GN_RADIUS, rim: GN_RIM * 0.6 });
      }
    });
  },
};
