// Food waste disposer (Speiseresteentsorgung, Nassmüllanlage): a pressed cabinet whose top has a
// round hopper with a rubber splash ring, where plate waste is scraped in, ground with water and
// pumped away to the collecting tank. The control panel with start and stop sits in the front
// under the top, the service door below it.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { DOOR, DOOR_RADIUS, GAP, PLINTH, TOP, type Hole } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { button, machineFeet } from "./details";
import { display, housing, ratingPlate } from "../parts/details";

/** The hopper: radius as a share of the smaller side, its depth (m). */
const HOPPER_SHARE = 0.3;
const HOPPER_DEPTH = 0.28;
/** Height of the control strip under the top (m). */
const STRIP = 0.11;

export const wastePulper: KindDef = {
  kind: "wastePulper",
  plan(s) {
    const r = Math.min(s.w, s.d) * HOPPER_SHARE;
    s.circle("detail", 0, -INSET, r);
    s.circle("detail", 0, -INSET, r - INSET / 2);
    s.line("detail", [s.L, s.F - INSET], [s.R, s.F - INSET]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const c = (l + r) / 2;
    const strip = top - TOP * 1000 - STRIP * 1000;
    const hr = Math.min(f.w, f.item.depth) * HOPPER_SHARE;
    f.worktop();
    f.box("detail", l + I / 4, r - I / 4, strip, top - TOP * 1000 - I / 4, "item-dark");
    f.circle("detail", r - I * 2, (strip + top - TOP * 1000) / 2, I / 2);
    f.circle("detail", r - I * 4, (strip + top - TOP * 1000) / 2, I / 2);
    f.box("detail", l + I / 4, r - I / 4, z0 + FEET * 0.67, strip - I / 4);
    f.line("detail", [c - I * 3, strip - I * 2], [c + I * 3, strip - I * 2]);
    f.box("hidden", c - hr, c + hr, top - HOPPER_DEPTH * 1000, top - TOP * 1000);
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const zb = zf - DOOR;
    const r = Math.min(s.w, s.d) * HOPPER_SHARE;
    const cz = -INSET / 1000;
    machineFeet(p, s.w, s.d, zb);
    housing(p, "steel", -s.w / 2, s.w / 2, PLINTH, s.h - TOP, -s.d / 2, zb);
    // The top with the round hopper: a turned funnel narrowing to the grinder, a rubber ring
    // round its mouth.
    const hole: Hole = { x0: -r, x1: r, z0: cz - r, z1: cz + r, r };
    p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, [hole]);
    p.lathe("steel", 0, s.h - HOPPER_DEPTH, cz, [
      [0, 0],
      [r * 0.4, 0],
      [r * 0.4, 0.04],
      [r - 0.002, HOPPER_DEPTH - 0.06],
      [r - 0.002, HOPPER_DEPTH - 0.002],
      [r - 0.01, HOPPER_DEPTH - 0.002],
      [r - 0.01, HOPPER_DEPTH - 0.06],
      [r * 0.4 - 0.01, 0.05],
      [0, 0.05],
    ]);
    p.lathe("slot", 0, s.h - HOPPER_DEPTH + 0.05, cz, [
      [0, 0],
      [r * 0.36, 0],
      [r * 0.36, 0.002],
      [0, 0.002],
    ]);
    p.ring("rubber", 0, cz, s.h - 0.006, r - 0.006, 0.006);
    // Control strip with the display, start and stop; the service door under it.
    const y1 = s.h - TOP - GAP;
    const y0 = y1 - STRIP;
    p.roundedBox("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, y0, y1, zb - 0.002, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
    const yc = (y0 + y1) / 2;
    display(p, -s.w / 2 + 0.12, yc, 0.14, 0.04, zf - DOOR / 2);
    button(p, s.w / 2 - 0.08, yc, zf - DOOR / 2, 0.016, "panel");
    button(p, s.w / 2 - 0.14, yc, zf - DOOR / 2, 0.016, "knob");
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, PLINTH + GAP, y0 - GAP, zb, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
    p.barHandle("x", -0.12, 0.12, y0 - 0.05, zf - DOOR / 2, zf);
    ratingPlate(p, s.w / 2 - 0.07, PLINTH + 0.06, zf - DOOR / 2);
  },
};
