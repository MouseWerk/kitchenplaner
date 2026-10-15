// Exhaust duct (Abluftkanal): the rectangular duct from the top of a hood up to the ceiling,
// with flanges at both ends, a stiffening band and a cleaning door on the front, as fire
// regulations ask for in grease-laden exhaust ducts.

import { INSET } from "../parts/elevation";
import { cross } from "../parts/plan";
import type { KindDef } from "../types";
import { boltRow, latch } from "./common";

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
    // The stiffening band low on the duct.
    const zb = z0 + Math.min(f.item.height * 0.25, f.item.height - fl - 50);
    f.box("detail", l, r, zb, zb + 20);
    const cx = (l + r) / 2;
    const dw = (f.w * DOOR_SHARE) / 2;
    const zc = (z0 + top) / 2;
    const dh = Math.min(DOOR_H * 1000, (top - z0) / 2 - fl) / 2;
    if (dh > INSET / 2) f.box("detail", cx - dw, cx + dw, zc - dh, zc + dh);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const o = FLANGE_OUT;
    // The duct: welded sheet with rounded corners.
    p.roundedBox("steel", -w / 2 + o, w / 2 - o, FLANGE - 0.002, h - FLANGE + 0.002, -d / 2 + o, d / 2 - o, 0.004, "vertical");
    // Flanges at both ends with their bolts.
    for (const [y0, y1] of [
      [0, FLANGE],
      [h - FLANGE, h],
    ]) {
      p.roundedBox("steelDark", -w / 2, w / 2, y0, y1, -d / 2, d / 2, 0.003);
      boltRow(p, -w / 2 + 0.02, w / 2 - 0.02, (y0 + y1) / 2, d / 2 - 0.003, 0.12);
    }
    // Stiffening band low on the duct.
    const yb = Math.min(h * 0.25, h - FLANGE - 0.05);
    p.roundedBox("steelDark", -w / 2 + o / 2, w / 2 - o / 2, yb, yb + 0.02, -d / 2 + o / 2, d / 2 - o / 2, 0.003, "vertical");
    // Cleaning door with its gasket and two latches in the middle of the front, and the label.
    const yc = h / 2;
    const dh = Math.min(DOOR_H, h / 2 - FLANGE) / 2;
    const dw = ((w - 2 * o) * DOOR_SHARE) / 2;
    const zf = d / 2 - o;
    if (dh > 0.02) {
      p.plate("rubber", -dw - 0.004, dw + 0.004, yc - dh - 0.004, yc + dh + 0.004, zf - 0.001, zf + 0.002, 0.008);
      p.plate("steel", -dw, dw, yc - dh, yc + dh, zf + 0.002, zf + 0.006, 0.006, true);
      for (const x of [-dw + 0.03, dw - 0.03]) latch(p, x, yc + 0.01, zf + 0.006, Math.min(0.008, o - 0.006));
      if (yc + dh + 0.06 < h - FLANGE) p.plate("satin", -0.05, 0.05, yc + dh + 0.02, yc + dh + 0.05, zf - 0.0005, zf + 0.0005, 0.003);
    }
  },
};
