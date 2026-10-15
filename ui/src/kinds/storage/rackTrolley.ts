// Rack trolleys and tray racks (Hordengestellwagen, Hordengestell): a welded frame of square
// tube with angle runners on both sides, the containers or trays slid in from the front. The
// trolleys run on four swivel castors; the stationary rack stands on adjustable feet. A few containers or trays stand in it so it reads as what it
// holds.

import type { Front } from "../parts/elevation";
import { castor, foot, GN_RADIUS, type Parts, type Point2 } from "../parts/mesh";
import type { KindDef } from "../types";

// Construction sizes (m).
/** Square tube of the frame and the radius of its corners. */
const TUBE = 0.025;
const TUBE_RADIUS = 0.003;
/** Castor wheel radius and the top of its mounting plate. */
const WHEEL = 0.04;
const CASTOR_TOP = 0.11;
/** Height of the adjustable feet of a stationary rack. */
const FEET = 0.08;
/** Lower edge of the lowest runner and the distance of the highest one below the top. */
const RUNNER_LOW = 0.22;
const RUNNER_TOP = 0.07;
/** Angle runner: leg into the rack, leg up, and sheet thickness. */
const RUNNER_W = 0.02;
const RUNNER_UP = 0.012;
const RUNNER_T = 0.0025;
/** Depth of a Gastronorm container and of its rim resting on a runner. */
const GN_PAN = 0.065;
const GN_RIM = 0.012;
/** Height of a baking tray (600 × 400) and its rim. */
const TRAY = 0.02;

/** What stands on the runners: Gastronorm containers or flat baking trays. */
type Load = "gn" | "tray";

/** Heights of the runners (m). */
function runners(h: number, levels: number, base: number): number[] {
  const low = Math.max(RUNNER_LOW, base + 0.1);
  const top = h - RUNNER_TOP;
  return Array.from({ length: levels }, (_, i) => low + ((top - low) * i) / (levels - 1));
}

/** Elevation: frame posts, the runners (short ticks seen from the front, bars from the side), castors or feet. */
function trolleyFront(f: Front, levels: number, side: boolean, castors: boolean) {
  const t = TUBE * 1000;
  const { l, r, z0 } = f;
  const baseM = castors ? CASTOR_TOP : FEET;
  const base = z0 + baseM * 1000;
  f.box("detail", l, l + t, base, f.top);
  f.box("detail", r - t, r, base, f.top);
  f.box("detail", l + t, r - t, base, base + t);
  f.box("detail", l + t, r - t, f.top - t, f.top);
  for (const y of runners(f.item.height / 1000, levels, baseM)) {
    const z = z0 + y * 1000;
    if (side) f.line("detail", [l + t, z], [r - t, z]);
    else {
      f.line("detail", [l + t, z], [l + t + RUNNER_W * 1000, z]);
      f.line("detail", [r - t - RUNNER_W * 1000, z], [r - t, z]);
    }
  }
  if (castors) {
    const wr = WHEEL * 1000;
    for (const x of [l + wr, r - wr]) f.circle("detail", x, z0 + wr, wr);
  } else {
    for (const x of [l, r - t]) f.box("detail", x, x + t, z0, base);
  }
}

/** The welded frame from `y0` up to the top: four posts and a rectangle of tube at both ends. */
function frame(p: Parts, W: number, D: number, y0: number, h: number) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (W - TUBE / 2);
      const z = sz * (D - TUBE / 2);
      p.roundedBox("steel", x - TUBE / 2, x + TUBE / 2, y0, h, z - TUBE / 2, z + TUBE / 2, TUBE_RADIUS, "vertical");
    }
  }
  // The rails sit a hair inside the posts' faces, so their faces never share a plane.
  const e = 0.001;
  for (const [a, b] of [
    [y0, y0 + TUBE],
    [h - TUBE, h],
  ]) {
    for (const sz of [-1, 1]) p.roundedBox("steel", -W + TUBE, W - TUBE, a + e, b - e, sz * D - (sz > 0 ? TUBE - e : -e), sz * D + (sz < 0 ? TUBE - e : -e), TUBE_RADIUS, "all", "x");
    for (const sx of [-1, 1]) p.roundedBox("steel", sx * W - (sx > 0 ? TUBE - e : -e), sx * W + (sx < 0 ? TUBE - e : -e), a + e, b - e, -D + TUBE, D - TUBE, TUBE_RADIUS, "all", "z");
  }
}

/** One angle runner along the depth on side `sx`, its horizontal leg's top at `y`. */
function runner(p: Parts, sx: number, W: number, D: number, y: number) {
  const xo = sx * (W - TUBE);
  const xi = xo - sx * RUNNER_W;
  const t = RUNNER_T * sx;
  // The angle in (x, y): the horizontal leg into the rack and the upright leg against the frame.
  const outline: Point2[] = [
    [xo, y - RUNNER_T],
    [xi, y - RUNNER_T],
    [xi, y],
    [xo - t, y],
    [xo - t, y + RUNNER_UP],
    [xo, y + RUNNER_UP],
  ];
  p.extrude("steelDark", "z", -D + TUBE, D - TUBE, sx > 0 ? outline : [...outline].reverse());
}

function rackKind(kind: string, levels: number, panDepth: number, castors: boolean, load: Load): KindDef {
  return {
    kind,
    plan(s) {
      if (castors) {
        const wr = WHEEL * 1000;
        for (const x of [s.L + wr, s.R - wr]) for (const y of [s.B + wr, s.F - wr]) s.circle("detail", x, y, wr * 0.6);
      }
      // Runners along both sides.
      const t = TUBE * 1000;
      for (const x of [s.L + t + RUNNER_W * 1000, s.R - t - RUNNER_W * 1000]) s.line("detail", [x, s.B + t], [x, s.F - t]);
    },
    elevation(f) {
      trolleyFront(f, levels, false, castors);
    },
    elevationSide(f) {
      trolleyFront(f, levels, true, castors);
    },
    mesh(p, s) {
      const W = s.w / 2;
      const D = s.d / 2;
      const base = castors ? CASTOR_TOP : FEET;
      if (castors) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(p, sx * (W - WHEEL), sz * (D - WHEEL), WHEEL, CASTOR_TOP);
      } else {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (W - TUBE / 2), sz * (D - TUBE / 2), FEET, TUBE / 2);
      }
      frame(p, W, D, base, s.h);
      const ys = runners(s.h, levels, base);
      for (const y of ys) for (const sx of [-1, 1]) runner(p, sx, W, D, y);
      // Two containers (or three trays) resting on their runners.
      const px = W - TUBE - RUNNER_W / 4;
      const pz = Math.min(panDepth, s.d - 2 * TUBE) / 2;
      if (load === "gn") {
        for (const k of [Math.floor(levels * 0.3), Math.floor(levels * 0.65)]) {
          const y = ys[k];
          p.pan("steel", -px, px, y - GN_PAN + GN_RIM, y + GN_RIM * 0.25, -pz, pz, { wall: 0.003, r: GN_RADIUS, rim: GN_RIM * 0.6 });
        }
      } else {
        for (const k of [Math.floor(levels * 0.2), Math.floor(levels * 0.45), Math.floor(levels * 0.7)]) {
          const y = ys[k];
          p.pan("steel", -px, px, y + 0.0005, y + TRAY, -pz, pz, { wall: 0.002, r: 0.01 });
        }
      }
    },
  };
}

/** GN 1/1 trolley, 15 runners. */
export const rackTrolley15 = rackKind("rackTrolley15", 15, 0.53, true, "gn");
/** GN 2/1 trolley, 20 runners. */
export const rackTrolley20 = rackKind("rackTrolley20", 20, 0.65, true, "gn");
/** Stationary tray rack for 600 × 400 baking trays, 18 runners, on feet. */
export const trayRack = rackKind("trayRack", 18, 0.6, false, "tray");
