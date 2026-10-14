// Ventilation ceiling module (Lüftungsdecke): a grid of ceiling cassettes over the plenum,
// extraction cassettes with baffle filters, closed panels and light panels in turn, hung at the
// ceiling over the cooking area.

import { cross } from "../parts/plan";
import type { KindDef } from "../types";

/** Cassette grid (m): about 600 mm along the width, about 800 mm across the depth. */
const CELL_W = 0.6;
const CELL_D = 0.8;
/** Thickness of the cassette layer at the bottom and of the grid profiles (m). */
const LAYER = 0.03;
const PROFILE = 0.02;
/** Baffles across an extraction cassette. */
const BAFFLES = 3;

function grid(w: number, d: number): { cols: number; rows: number } {
  return { cols: Math.max(1, Math.round(w / CELL_W)), rows: Math.max(1, Math.round(d / CELL_D)) };
}

/** What a cell holds: cassettes alternate extraction, closed panel and light along the grid. */
function cellType(col: number, row: number): "extract" | "closed" | "light" {
  const t = (col + row * 2) % 3;
  return t === 0 ? "extract" : t === 1 ? "light" : "closed";
}

export const ventCeiling: KindDef = {
  kind: "ventCeiling",
  placement: "overhead",
  plan(s) {
    const { cols, rows } = grid(s.w / 1000, s.d / 1000);
    const cw = s.w / cols;
    const cd = s.d / rows;
    for (let i = 1; i < cols; i++) s.line("overhead", [s.L + i * cw, s.B], [s.L + i * cw, s.F]);
    for (let j = 1; j < rows; j++) s.line("overhead", [s.L, s.B + j * cd], [s.R, s.B + j * cd]);
    // Extraction cassettes crossed out, as an exhaust opening.
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (cellType(i, j) === "extract") s.line("overhead", [s.L + i * cw, s.B + j * cd], [s.L + (i + 1) * cw, s.B + (j + 1) * cd]);
      }
    }
    if (cols * rows === 1) cross(s, "overhead", false);
  },
  elevation(f) {
    f.line("detail", [f.l, f.z0 + LAYER * 1000], [f.r, f.z0 + LAYER * 1000]);
  },
  elevationSide(f) {
    f.line("detail", [f.l, f.z0 + LAYER * 1000], [f.r, f.z0 + LAYER * 1000]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    // The plenum box above the cassettes.
    p.box("steel", -w / 2, w / 2, LAYER, h, -d / 2, d / 2);
    const { cols, rows } = grid(w, d);
    const cw = w / cols;
    const cd = d / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x0 = -w / 2 + i * cw + PROFILE / 2;
        const x1 = x0 + cw - PROFILE;
        const z0 = -d / 2 + j * cd + PROFILE / 2;
        const z1 = z0 + cd - PROFILE;
        const t = cellType(i, j);
        if (t === "extract") {
          p.box("steelDark", x0, x1, LAYER * 0.4, LAYER, z0, z1);
          for (let k = 1; k <= BAFFLES; k++) {
            const x = x0 + ((x1 - x0) * k) / (BAFFLES + 1);
            p.box("steel", x - 0.015, x + 0.015, LAYER * 0.2, LAYER * 0.4, z0 + 0.02, z1 - 0.02);
          }
        } else if (t === "light") {
          p.box("steel", x0, x1, LAYER * 0.4, LAYER, z0, z1);
          p.box("panel", x0 + 0.08, x1 - 0.08, LAYER * 0.2, LAYER * 0.4, z0 + 0.15, z1 - 0.15);
        } else {
          p.box("steel", x0, x1, LAYER * 0.3, LAYER, z0, z1);
        }
      }
    }
    // Grid profiles between the cassettes, flush with the lower edge.
    for (let i = 0; i <= cols; i++) {
      const x = Math.min(w / 2 - PROFILE / 2, Math.max(-w / 2 + PROFILE / 2, -w / 2 + i * cw));
      p.box("steelDark", x - PROFILE / 2, x + PROFILE / 2, 0, LAYER, -d / 2, d / 2);
    }
    for (let j = 0; j <= rows; j++) {
      const z = Math.min(d / 2 - PROFILE / 2, Math.max(-d / 2 + PROFILE / 2, -d / 2 + j * cd));
      p.box("steelDark", -w / 2, w / 2, 0, LAYER, z - PROFILE / 2, z + PROFILE / 2);
    }
  },
};
