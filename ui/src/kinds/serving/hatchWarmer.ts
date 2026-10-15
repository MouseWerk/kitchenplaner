// Heated pass-through cabinet (Durchreiche-Wärmeschrank): set into a pass-through hatch, with
// glass doors on the kitchen side (front) and the serving side (back), wire shelves inside and
// the heater with its controls in the top.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, GAP, HANDLE, SHEET, SHELF_PITCH } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { dish, pilotLamp } from "./common";
import { ventSlots } from "../parts/details";

/** Height of the heater box in the top and of the base frame (m). */
const HEATER = 0.1;
const BASE = 0.04;
/** Width of the steel frame round a door pane (m). */
const FRAME = 0.04;
/** Wire shelves inside. */
const SHELVES = 2;

/** Number of door leaves on each side (two from 800 mm). */
function leaves(width: number): number {
  return width >= 800 ? 2 : 1;
}

export const hatchWarmer: KindDef = {
  kind: "hatchWarmer",
  placement: "overhead",
  plan(s) {
    // Glass doors on both sides, the shelves inside.
    for (const y of [s.B + INSET / 2, s.F - INSET / 2]) s.line("overhead", [s.L + INSET / 2, y], [s.R - INSET / 2, y]);
    const n = leaves(s.w);
    for (let i = 1; i < n; i++) s.line("overhead", [s.L + (s.w * i) / n, s.B], [s.L + (s.w * i) / n, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const n = leaves(f.item.width);
    const zh = top - HEATER * 1000;
    // The heater band with its display in the middle and the thermostat knob at the right.
    f.box("detail", l, r, zh, top);
    const cx = (l + r) / 2;
    f.box("detail", cx - 60, cx + 60, zh + 25, top - 25, "item-dark");
    f.circle("detail", r - 80, (zh + top) / 2, 18);
    const dw = (f.w - I) / n;
    for (let i = 0; i < n; i++) {
      const a = l + I / 2 + i * dw;
      f.box("detail", a + I / 4, a + dw - I / 4, z0 + BASE * 1000, zh - I / 4, "glass");
    }
    for (let k = 1; k <= SHELVES; k++) {
      const z = z0 + BASE * 1000 + ((zh - z0 - BASE * 1000) * k) / (SHELVES + 1);
      f.line("hidden", [l + I, z], [r - I, z]);
    }
  },
  elevationSide(f) {
    f.line("detail", [f.l, f.top - HEATER * 1000], [f.r, f.top - HEATER * 1000]);
  },
  mesh(p, s, item) {
    const zf = s.d / 2;
    const yh = s.h - HEATER;
    const t = SHEET * 2;
    // Frame: side walls, base and the heater box in the top, all pressed with round corners.
    p.roundedBox("steel", -s.w / 2, -s.w / 2 + t, 0, s.h, -s.d / 2, zf, BODY_RADIUS * 2);
    p.roundedBox("steel", s.w / 2 - t, s.w / 2, 0, s.h, -s.d / 2, zf, BODY_RADIUS * 2);
    p.roundedBox("steel", -s.w / 2 + t - 0.001, s.w / 2 - t + 0.001, 0, BASE, -s.d / 2 + 0.002, zf - 0.002, BODY_RADIUS);
    p.roundedBox("steel", -s.w / 2 + t - 0.001, s.w / 2 - t + 0.001, yh, s.h, -s.d / 2 + 0.002, zf - 0.016, BODY_RADIUS);
    p.box("slot", -s.w / 2 + t, s.w / 2 - t, yh - 0.002, yh, -s.d / 2 + 0.03, zf - 0.03);
    // Wire shelves on their runners, a plated dish on each.
    for (let k = 1; k <= SHELVES; k++) {
      const y = BASE + ((yh - BASE) * k) / (SHELVES + 1);
      p.grid(-s.w / 2 + t, s.w / 2 - t, y, y + 0.01, -s.d / 2 + 0.03, zf - 0.03, SHELF_PITCH);
      for (const sx of [-1, 1]) {
        if (s.w < 0.5 && sx > 0) continue;
        const r = Math.min(0.13, s.d / 2 - 0.06, s.w / 4 - 0.02);
        dish(p, s.w < 0.5 ? 0 : (sx * s.w) / 4, y + 0.01, 0, r, k === 1 ? "foodBrown" : "foodGreen");
      }
    }
    // Glass doors on both sides: a pane in a steel frame per leaf, a handle bar at its free edge.
    const n = leaves(item.width);
    const dw = (s.w - t * 2) / n;
    for (const side of [-1, 1] as const) {
      const zFace = side > 0 ? zf - HANDLE : -s.d / 2 + HANDLE;
      const zIn = zFace - side * SHEET;
      for (let i = 0; i < n; i++) {
        const a = -s.w / 2 + t + i * dw + GAP;
        const b = a + dw - GAP * 2;
        const lo = BASE + GAP;
        const hi = yh - GAP;
        const fw = Math.min(FRAME, (b - a) / 4);
        p.lathe(
          "steel",
          (a + b) / 2,
          (lo + hi) / 2,
          Math.min(zIn, zFace),
          [
            [0, 0],
            [fw, 0],
            [fw, SHEET],
            [0, SHEET],
            [0, 0],
          ],
          { axis: "z", rect: [(b - a) / 2 - fw, (hi - lo) / 2 - fw] },
        );
        p.box("glass", a + fw - 0.002, b - fw + 0.002, lo + fw - 0.002, hi - fw + 0.002, (zIn + zFace) / 2 - 0.002, (zIn + zFace) / 2 + 0.002);
        const free = n > 1 && i === 0 ? b - fw / 2 : a + fw / 2;
        const mid = (lo + hi) / 2;
        const zOut = side > 0 ? zf : -s.d / 2;
        if (side > 0) p.barHandle("y", mid - 0.09, mid + 0.09, free, zFace, zOut);
        else {
          // The back handle: the same bar mirrored to face the serving side.
          p.tube(
            "handle",
            [
              { x: free, y: mid - 0.09, z: zFace },
              { x: free, y: mid - 0.09, z: zOut + 0.008 },
              { x: free, y: mid + 0.09, z: zOut + 0.008 },
              { x: free, y: mid + 0.09, z: zFace },
            ],
            0.006,
            { bend: 0.008 },
          );
        }
      }
    }
    // Controls in the heater box on the kitchen side: display, thermostat knob, pilot lamp,
    // and the vent slots of the heater.
    const zp = zf - 0.016;
    p.plate("glassDark", -0.05, 0.05, yh + 0.03, yh + HEATER - 0.03, zp, zp + 0.001, 0.003);
    p.knob(s.w / 2 - 0.08, yh + HEATER / 2, zp, zf, 0.018);
    pilotLamp(p, s.w / 2 - 0.13, yh + HEATER / 2, zp);
    ventSlots(p, -s.w / 2 + 0.05, -s.w / 2 + Math.min(0.2, s.w / 2 - 0.1), yh + 0.02, yh + HEATER - 0.02, zp, 3);
  },
};
