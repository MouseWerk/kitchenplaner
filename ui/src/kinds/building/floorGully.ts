// Floor gullies (Bodenablauf mit Geruchsverschluss): a small gully with a round grate in a square
// frame, and a larger one whose slotted cover lifts out over a dirt bucket (Schlammeimer). Both
// lie flush in the floor; the plan shows the trap's body below them hidden.

import type { Point2 } from "../parts/mesh";
import type { KindDef } from "../types";
import { flushFrame } from "./common";

// Sizes (m).
/** Width of the frame round the grate. */
const FRAME = 0.02;
/** Slots of a grate: width and pitch. */
const SLOT = 0.006;
const SLOT_PITCH = 0.016;
/** Corners of a round outline. */
const ROUND = 32;

/** A circle as an outline of `ROUND` points round (x, z). */
function circle(x: number, z: number, r: number): Point2[] {
  return Array.from({ length: ROUND }, (_, k) => {
    const a = (k / ROUND) * Math.PI * 2;
    return [x + r * Math.cos(a), z + r * Math.sin(a)] as const;
  });
}

export const floorGully: KindDef = {
  kind: "floorGully",
  placement: "flat",
  plan(s) {
    const r = Math.min(s.w, s.d) / 2 - FRAME * 1000;
    s.circle("detail", 0, 0, r);
    for (const y of [-r / 2, 0, r / 2]) {
      const half = Math.sqrt(r * r - y * y) - 8;
      s.line("detail", [-half, y], [half, y]);
    }
    s.circle("hidden", 0, 0, r * 0.6);
  },
  elevation() {},
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    const r = Math.min(W, D) - FRAME;
    // The square frame with the round seat, the dark trap under the grate.
    p.extrude("steel", "y", 0, s.h, [
      [-W, -D],
      [W, -D],
      [W, D],
      [-W, D],
    ], [circle(0, 0, r)]);
    p.cyl("slot", 0, 0, 0, s.h * 0.3, r);
    // The round grate: a turned disc with a raised rim, the slots across it.
    p.lathe("satin", 0, s.h * 0.35, 0, [[0, 0], [r - 0.001, 0], [r - 0.001, s.h * 0.5], [r - 0.004, s.h * 0.62], [0, s.h * 0.62]]);
    for (let z = -r + SLOT_PITCH; z < r - SLOT_PITCH / 2; z += SLOT_PITCH) {
      const half = Math.sqrt(r * r - z * z) - 0.012;
      if (half > 0.01) p.roundedBox("slot", -half, half, s.h * 0.97 - 0.0008, s.h, z - SLOT / 2, z + SLOT / 2, SLOT / 2, "vertical");
    }
  },
};

/** Lifting slots of the bucket gully's cover: their distance from the middle (m). */
const LIFT = 0.12;

export const floorGullyBucket: KindDef = {
  kind: "floorGullyBucket",
  placement: "flat",
  plan(s) {
    const f = FRAME * 1000;
    s.rect("detail", s.L + f, s.B + f, s.R - f, s.F - f);
    // The slot rows and the dirt bucket below the cover.
    for (let y = s.B + f + 40; y < s.F - f - 30; y += 40) s.line("detail", [s.L + f + 40, y], [s.R - f - 40, y]);
    s.circle("hidden", 0, 0, Math.min(s.w, s.d) / 2 - f * 3);
  },
  elevation() {},
  mesh(p, s) {
    const W = s.w / 2;
    const D = s.d / 2;
    flushFrame(p, W, D, FRAME, s.h);
    p.box("slot", -W + FRAME, W - FRAME, 0, s.h * 0.3, -D + FRAME, D - FRAME);
    // The cover plate, a hair inside the frame, with rows of slots and two lifting slots.
    const c = 0.002;
    p.roundedBox("satin", -W + FRAME + c, W - FRAME - c, s.h * 0.35, s.h - 0.0005, -D + FRAME + c, D - FRAME - c, 0.0015, "top");
    const x0 = -W + FRAME + 0.03;
    const x1 = W - FRAME - 0.03;
    for (let z = -D + FRAME + 0.03; z < D - FRAME - 0.02; z += SLOT_PITCH * 2) {
      if (Math.abs(z) < 0.02) continue;
      p.roundedBox("slot", x0, x1, s.h - 0.0015, s.h - 0.0004, z - SLOT / 2, z + SLOT / 2, SLOT / 2, "vertical");
    }
    for (const sx of [-1, 1]) {
      const x = sx * Math.min(LIFT, W - FRAME - 0.04);
      p.roundedBox("slot", x - 0.02, x + 0.02, s.h - 0.0015, s.h - 0.0003, -0.006, 0.006, 0.006, "vertical");
    }
  },
};
