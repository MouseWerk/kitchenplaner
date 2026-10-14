// Exhaust duct (Abluftkanal): the rectangular duct from the top of a hood up to the ceiling,
// with flanges at both ends, a stiffening band and a cleaning door on the front, as fire
// regulations ask for in grease-laden exhaust ducts.

import { INSET } from "../parts/elevation";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";

/** Flange height and how far the flange stands round the duct (m). */
const FLANGE = 0.04;
const FLANGE_OUT = 0.015;
/** Cleaning door: share of the duct's width and its height (m). */
const DOOR_SHARE = 0.6;
const DOOR_H = 0.2;

export const exhaustDuct: KindDef = {
  kind: "exhaustDuct",
  placement: "overhead",
  plan(s) {
    cross(s, "overhead");
    const o = FLANGE_OUT * 1000;
    s.rect("overhead", s.L + o, s.B + o, s.R - o, s.F - o);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const fl = FLANGE * 1000;
    f.line("detail", [l, z0 + fl], [r, z0 + fl]);
    f.line("detail", [l, top - fl], [r, top - fl]);
    const cx = (l + r) / 2;
    const dw = (f.w * DOOR_SHARE) / 2;
    const zc = (z0 + top) / 2;
    const dh = Math.min(DOOR_H * 1000, (top - z0) / 2 - fl) / 2;
    if (dh > INSET / 2) f.box("detail", cx - dw, cx + dw, zc - dh, zc + dh);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const o = FLANGE_OUT;
    p.box("steel", -w / 2 + o, w / 2 - o, FLANGE, h - FLANGE, -d / 2 + o, d / 2 - o);
    p.box("steelDark", -w / 2, w / 2, 0, FLANGE, -d / 2, d / 2);
    p.box("steelDark", -w / 2, w / 2, h - FLANGE, h, -d / 2, d / 2);
    // Stiffening band low on the duct.
    const yb = Math.min(h * 0.25, h - FLANGE - 0.05);
    p.box("steelDark", -w / 2 + o / 2, w / 2 - o / 2, yb, yb + 0.02, -d / 2 + o / 2, d / 2 - o / 2);
    // Cleaning door with two latches in the middle of the front.
    const yc = h / 2;
    const dh = Math.min(DOOR_H, h / 2 - FLANGE) / 2;
    const dw = ((w - 2 * o) * DOOR_SHARE) / 2;
    if (dh > 0.02) {
      p.box("steel", -dw, dw, yc - dh, yc + dh, d / 2 - o, d / 2 - o + 0.006);
      for (const x of [-dw + 0.03, dw - 0.03]) p.box("handle", x - 0.012, x + 0.012, yc - 0.015, yc + 0.015, d / 2 - o + 0.006, d / 2 - o + 0.014);
    }
  },
};
