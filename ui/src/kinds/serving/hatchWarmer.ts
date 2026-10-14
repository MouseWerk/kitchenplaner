// Heated pass-through cabinet (Durchreiche-Wärmeschrank): set into a pass-through hatch, with
// glass doors on the kitchen side (front) and the serving side (back), wire shelves inside and
// the heater with its controls in the top.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { GAP, HANDLE, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Height of the heater box in the top and of the base frame (m). */
const HEATER = 0.1;
const BASE = 0.04;
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
    f.box("detail", l, r, zh, top, "item-dark");
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
    // Frame: side walls, base, heater box in the top.
    p.box("steel", -s.w / 2, -s.w / 2 + SHEET * 2, 0, s.h, -s.d / 2, zf);
    p.box("steel", s.w / 2 - SHEET * 2, s.w / 2, 0, s.h, -s.d / 2, zf);
    p.box("steel", -s.w / 2, s.w / 2, 0, BASE, -s.d / 2, zf);
    p.box("steel", -s.w / 2, s.w / 2, yh, s.h, -s.d / 2, zf - 0.015);
    // Wire shelves on their runners.
    for (let k = 1; k <= SHELVES; k++) {
      const y = BASE + ((yh - BASE) * k) / (SHELVES + 1);
      p.box("basket", -s.w / 2 + SHEET * 2, s.w / 2 - SHEET * 2, y, y + 0.01, -s.d / 2 + 0.03, zf - 0.03);
    }
    // Glass doors on both sides, each leaf with a steel frame bar and a handle.
    const n = leaves(item.width);
    const dw = (s.w - SHEET * 4) / n;
    for (const side of [-1, 1]) {
      const z0 = side > 0 ? zf - HANDLE : -s.d / 2 + HANDLE - SHEET;
      for (let i = 0; i < n; i++) {
        const a = -s.w / 2 + SHEET * 2 + i * dw + GAP;
        const b = a + dw - GAP * 2;
        p.box("glass", a, b, BASE + GAP, yh - GAP, z0, z0 + SHEET);
        p.box("steelDark", a, b, BASE + GAP, BASE + 0.03, z0, z0 + SHEET);
        const hx = n > 1 && i === 0 ? b - 0.03 : a + 0.03;
        const zFace = side > 0 ? z0 + SHEET : z0;
        const zOut = side > 0 ? zf : -s.d / 2;
        const lo = Math.min(zFace, zOut);
        p.box("handle", hx - 0.008, hx + 0.008, (BASE + yh) / 2 - 0.08, (BASE + yh) / 2 + 0.08, lo, lo + Math.abs(zOut - zFace));
      }
    }
    // Controls in the heater box on the kitchen side: thermostat knob and display.
    p.knob(s.w / 2 - 0.08, yh + HEATER / 2, zf - 0.015, zf, 0.018);
    p.box("glassDark", -0.06, 0.06, yh + 0.025, yh + HEATER - 0.025, zf - 0.015, zf - 0.012);
  },
};
