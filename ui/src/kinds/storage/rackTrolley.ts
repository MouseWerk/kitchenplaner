// Rack trolley (Hordengestellwagen) for Gastronorm containers: an open tube frame on four swivel
// castors with runners on both sides, the containers slid in from the front. Two containers
// stand in it so it reads as a GN trolley.

import type { Front } from "../parts/elevation";
import { castor, SHEET } from "../parts/mesh";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Square tube of the frame. */
const TUBE = 0.025;
/** Castor wheel radius and the top of its mounting plate. */
const WHEEL = 0.04;
const CASTOR_TOP = 0.11;
/** Lower edge of the lowest runner and the distance of the highest one below the top. */
const RUNNER_LOW = 0.22;
const RUNNER_TOP = 0.07;
/** Runner bar: width into the trolley and thickness. */
const RUNNER_W = 0.02;
const RUNNER_T = 0.004;
/** Depth of a Gastronorm container. */
const GN_PAN = 0.065;

/** Heights of the runners (m). */
function runners(h: number, levels: number): number[] {
  const top = h - RUNNER_TOP;
  return Array.from({ length: levels }, (_, i) => RUNNER_LOW + ((top - RUNNER_LOW) * i) / (levels - 1));
}

/** Elevation: frame posts, the runners (short ticks seen from the front, bars from the side), castors. */
function trolleyFront(f: Front, levels: number, side: boolean) {
  const t = TUBE * 1000;
  const { l, r, z0 } = f;
  const base = z0 + CASTOR_TOP * 1000;
  f.box("detail", l, l + t, base, f.top);
  f.box("detail", r - t, r, base, f.top);
  f.box("detail", l + t, r - t, base, base + t);
  f.box("detail", l + t, r - t, f.top - t, f.top);
  for (const y of runners(f.item.height / 1000, levels)) {
    const z = z0 + y * 1000;
    if (side) f.line("detail", [l + t, z], [r - t, z]);
    else {
      f.line("detail", [l + t, z], [l + t + RUNNER_W * 1000, z]);
      f.line("detail", [r - t - RUNNER_W * 1000, z], [r - t, z]);
    }
  }
  const wr = WHEEL * 1000;
  for (const x of [l + wr, r - wr]) f.circle("detail", x, z0 + wr, wr);
}

function rackTrolleyKind(kind: string, levels: number, panDepth: number): KindDef {
  return {
    kind,
    plan(s) {
      const wr = WHEEL * 1000;
      for (const x of [s.L + wr, s.R - wr]) for (const y of [s.B + wr, s.F - wr]) s.circle("detail", x, y, wr * 0.6);
      // Runners along both sides.
      const t = TUBE * 1000;
      for (const x of [s.L + t + RUNNER_W * 1000, s.R - t - RUNNER_W * 1000]) s.line("detail", [x, s.B + t], [x, s.F - t]);
    },
    elevation(f) {
      trolleyFront(f, levels, false);
    },
    elevationSide(f) {
      trolleyFront(f, levels, true);
    },
    mesh(p, s) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(p, sx * (s.w / 2 - WHEEL), sz * (s.d / 2 - WHEEL), WHEEL, CASTOR_TOP);
      const W = s.w / 2;
      const D = s.d / 2;
      // Posts and the bottom and top frames.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = sx * (W - TUBE / 2);
          const z = sz * (D - TUBE / 2);
          p.box("steel", x - TUBE / 2, x + TUBE / 2, CASTOR_TOP, s.h, z - TUBE / 2, z + TUBE / 2);
        }
      }
      for (const [y0, y1] of [
        [CASTOR_TOP, CASTOR_TOP + TUBE],
        [s.h - TUBE, s.h],
      ]) {
        for (const sz of [-1, 1]) p.box("steel", -W + TUBE, W - TUBE, y0, y1, sz * D - (sz > 0 ? TUBE : 0), sz * D + (sz < 0 ? TUBE : 0));
        for (const sx of [-1, 1]) p.box("steel", sx * W - (sx > 0 ? TUBE : 0), sx * W + (sx < 0 ? TUBE : 0), y0, y1, -D + TUBE, D - TUBE);
      }
      const ys = runners(s.h, levels);
      for (const y of ys) {
        for (const sx of [-1, 1]) {
          const x0 = sx > 0 ? W - TUBE - RUNNER_W : -W + TUBE;
          p.box("steelDark", x0, x0 + RUNNER_W, y - RUNNER_T, y, -D + TUBE, D - TUBE);
        }
      }
      // Two containers resting on their runners by the rim.
      const px = W - TUBE - RUNNER_W / 4;
      const pz = Math.min(panDepth, s.d - 2 * TUBE) / 2;
      for (const k of [Math.floor(levels * 0.3), Math.floor(levels * 0.65)]) {
        const y = ys[k];
        p.tub("steel", -px, px, y - GN_PAN + 0.012, y + 0.012, -pz, pz, SHEET / 2);
      }
    },
  };
}

/** GN 1/1 trolley, 15 runners. */
export const rackTrolley15 = rackTrolleyKind("rackTrolley15", 15, 0.53);
/** GN 2/1 trolley, 20 runners. */
export const rackTrolley20 = rackTrolleyKind("rackTrolley20", 20, 0.65);
