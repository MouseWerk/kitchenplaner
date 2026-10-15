// Cleaning sink (Ausgussbecken): a low, deep basin on a body with a kick plate, for filling and
// emptying buckets, with a folding grate to stand the bucket on and a wall tap on the back plate
// above it.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, PLINTH, SHEET, tap, TOP_RADIUS } from "../parts/mesh";
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
    f.line("detail", [l, z0 + Math.min(PLINTH * 1000, (rim - z0 - DEPTH * 1000) / 2)], [r, z0 + Math.min(PLINTH * 1000, (rim - z0 - DEPTH * 1000) / 2)]);
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
    // The body under the basin as wide as the basin, its front a little back from the rim, on a
    // kick plate set back further; the back plate up to the top.
    const kick = Math.min(PLINTH, floor / 2);
    p.roundedBox("steelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, 0, kick, zb + PLATE, zf - 0.07, BODY_RADIUS, "vertical");
    p.roundedBox("steel", -s.w / 2, s.w / 2, kick, floor + 0.01, zb + PLATE, zf - 0.02, BODY_RADIUS, "vertical");
    p.tub("steel", -s.w / 2, s.w / 2, floor, rim - 0.012, zb + PLATE, zf, SHEET * 1.5);
    // The rolled rim round the basin's top: a tube along the front and the sides.
    const er = 0.012;
    p.tube(
      "steel",
      [
        { x: -s.w / 2 + er, y: rim - er, z: zb + PLATE + er },
        { x: -s.w / 2 + er, y: rim - er, z: zf - er },
        { x: s.w / 2 - er, y: rim - er, z: zf - er },
        { x: s.w / 2 - er, y: rim - er, z: zb + PLATE + er },
      ],
      er,
      { bend: 0.03 },
    );
    bowlDrain(p, 0, 0, floor, zb, false);
    p.roundedBox("steel", -s.w / 2, s.w / 2, floor, s.h, zb, zb + PLATE, TOP_RADIUS, "top");
    // Folding grate over the front half: bars from the hinge rod to the front rim, on two hinges.
    const g0 = (zb + PLATE + zf) / 2;
    const gy = rim - er * 2 - 0.006;
    p.rod("handle", "x", 0, gy, g0, s.w - 0.06, 0.008);
    for (let i = 1; i <= BARS; i++) {
      const x = -s.w / 2 + 0.03 + ((s.w - 0.06) * i) / (BARS + 1);
      p.rod("handle", "z", x, gy, (g0 + zf - 0.03) / 2, zf - 0.03 - g0, 0.006);
    }
    p.rod("handle", "x", 0, gy, zf - 0.03, s.w - 0.08, 0.006);
    // The wall tap with a hose connection, high enough for a bucket: a wall block with the
    // shut-off valve's handle and the long spout.
    const ty = rim + (s.h - rim) * 0.35;
    p.roundedBox("handle", -0.025, 0.025, ty - 0.035, ty, zb + PLATE, zb + 0.06, 0.006);
    p.lathe("knob", 0.045, ty - 0.0175, zb + 0.04, [
      [0, 0],
      [0.014, 0],
      [0.016, 0.01],
      [0.012, 0.018],
      [0, 0.02],
    ], { axis: "x" });
    tap(p, 0, zb, ty, Math.min(0.25, s.h - ty));
  },
};
