// Cleaning sink (Ausgussbecken): a low, deep basin on the floor for filling and emptying buckets,
// with a folding grate to stand the bucket on and a wall tap on the back plate above it.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { SHEET, tap } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain } from "./common";

/** Height of the basin's rim above the floor and the depth of the basin (m). */
const RIM = 0.55;
const DEPTH = 0.3;
/** Depth of the back plate that carries the tap (m). */
const PLATE = 0.02;
/** Bars of the bucket grate. */
const BARS = 6;

/** The rim, or less on a low resized unit (m). */
const rimOf = (h: number) => Math.min(RIM, h * 0.6);

export const mopSink: KindDef = {
  kind: "mopSink",
  plan(s) {
    const x0 = s.L + INSET;
    const x1 = s.R - INSET;
    const y0 = s.B + PLATE * 1000 + INSET;
    const y1 = s.F - INSET;
    s.rect("detail", x0, y0, x1, y1);
    s.circle("detail", 0, (y0 + y1) / 2 - INSET, INSET / 2);
    // The grate over the front half of the basin.
    const gy = (y0 + y1) / 2;
    for (let i = 1; i <= 3; i++) s.line("detail", [x0 + ((x1 - x0) * i) / 4, gy], [x0 + ((x1 - x0) * i) / 4, y1]);
    s.circle("detail", 0, s.B + PLATE * 1000 + INSET / 2, INSET / 3);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const rim = z0 + rimOf(f.item.height / 1000) * 1000;
    const c = (l + r) / 2;
    f.line("detail", [l, rim], [r, rim]);
    f.box("hidden", l + I, r - I, rim - DEPTH * 1000, rim - I / 2);
    f.box("detail", l, r, rim, top);
    const tz = rim + (top - rim) * 0.6;
    f.line("detail", [c, tz - 150], [c, tz], [c - I * 3, tz], [c - I * 3, tz - I]);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    const rim = rimOf(s.h);
    const floor = rim - DEPTH;
    // Pedestal with a kick plate, the basin on it, the back plate up to the top.
    p.box("steelDark", -s.w / 2 + 0.05, s.w / 2 - 0.05, 0, floor, zb + PLATE, zf - 0.06);
    p.box("steel", -s.w / 2 + 0.02, s.w / 2 - 0.02, floor * 0.5, floor, zb + PLATE, zf - 0.02);
    p.tub("steel", -s.w / 2, s.w / 2, floor, rim, zb + PLATE, zf, SHEET * 1.5);
    p.rod("steel", "x", 0, rim - 0.012, zf - 0.012, s.w, 0.012);
    bowlDrain(p, 0, 0, floor, zb, false);
    p.box("steel", -s.w / 2, s.w / 2, floor, s.h, zb, zb + PLATE);
    // Folding grate over the front half: bars from the middle to the front rim, a hinge rod.
    const g0 = (zb + PLATE + zf) / 2;
    const gy = rim - 0.015;
    p.rod("handle", "x", 0, gy, g0, s.w - 0.04, 0.008);
    for (let i = 1; i <= BARS; i++) {
      const x = -s.w / 2 + 0.02 + ((s.w - 0.04) * i) / (BARS + 1);
      p.rod("handle", "z", x, gy, (g0 + zf - 0.02) / 2, zf - 0.02 - g0, 0.006);
    }
    // The wall tap with a hose connection, high enough for a bucket.
    const ty = rim + (s.h - rim) * 0.35;
    p.box("handle", -0.02, 0.02, ty - 0.03, ty, zb + PLATE, zb + 0.06);
    tap(p, 0, zb, ty, Math.min(0.25, s.h - ty));
  },
};
