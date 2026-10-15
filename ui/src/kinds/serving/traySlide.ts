// Tray slide (Tablettrutsche): three round tubes on brackets, fixed to the guest side of a
// serving counter just under its top, so guests push their trays along the line.

import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Tubes of the slide and their radius (m). */
const TUBES = 3;
const TUBE_R = 0.0125;
/** Largest distance between two brackets (m). */
const BRACKET_PITCH = 1;
/** Bracket plate thickness (m). */
const BRACKET = 0.01;

/** Positions of the tubes across the depth, from the counter (back) to the front (shares of d). */
function tubeZ(d: number): number[] {
  const z0 = -d / 2 + d * 0.3;
  const z1 = d / 2 - TUBE_R;
  return Array.from({ length: TUBES }, (_, i) => z0 + ((z1 - z0) * i) / (TUBES - 1));
}

function bracketXs(w: number): number[] {
  const n = Math.max(2, Math.ceil(w / BRACKET_PITCH) + 1);
  const x0 = -w / 2 + 0.05;
  const x1 = w / 2 - 0.05 - BRACKET;
  return Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));
}

export const traySlide: KindDef = {
  kind: "traySlide",
  placement: "overhead",
  plan(s) {
    for (const z of tubeZ(s.d / 1000)) s.line("detail", [s.L, z * 1000], [s.R, z * 1000]);
    for (const x of bracketXs(s.w / 1000)) s.line("overhead", [x * 1000, s.B], [x * 1000, s.F - INSET / 2]);
  },
  elevation(f) {
    const zc = f.top - TUBE_R * 1000;
    f.box("detail", f.l, f.r, zc - TUBE_R * 1000, f.top);
    const scale = f.w / f.item.width;
    for (const x of bracketXs(f.item.width / 1000)) {
      const a = (f.l + f.r) / 2 + x * 1000 * scale;
      f.box("detail", a, a + BRACKET * 1000 * scale, f.z0, f.top);
    }
  },
  mesh(p, s) {
    const y = s.h - TUBE_R;
    // The tubes with turned end caps.
    for (const z of tubeZ(s.d)) {
      p.rod("handle", "x", 0, y, z, s.w - 0.02, TUBE_R);
      for (const [x, dir] of [
        [-s.w / 2, 1],
        [s.w / 2, -1],
      ] as const) {
        p.lathe(
          "satin",
          x,
          y,
          z,
          [
            [0, 0],
            [TUBE_R * 0.8, 0],
            [TUBE_R, 0.004],
            [TUBE_R, 0.012],
            [0, 0.012],
          ],
          { axis: "x" },
        ).rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    // Brackets: a plate screwed to the counter and a bent arm under the tubes.
    for (const x of bracketXs(s.w)) {
      p.roundedBox("steel", x, x + BRACKET, 0, s.h, -s.d / 2, -s.d / 2 + 0.008, 0.003, "vertical", "z");
      p.roundedBox("steel", x, x + BRACKET, y - TUBE_R - 0.03, y - TUBE_R, -s.d / 2 + 0.008, s.d / 2 - TUBE_R, 0.003, "all", "z");
      p.roundedBox("steel", x, x + BRACKET, 0.02, y - TUBE_R - 0.03, -s.d / 2 + 0.008, -s.d / 2 + 0.03, 0.003, "vertical", "z");
      for (const yy of [0.03, s.h - 0.04]) p.lathe("satin", x + BRACKET / 2, yy, -s.d / 2 + 0.008, [[0, 0], [0.004, 0], [0.003, 0.002], [0, 0.002]], { axis: "z" });
    }
  },
};
