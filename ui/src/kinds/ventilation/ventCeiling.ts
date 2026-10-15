// Ventilation ceiling module (Lüftungsdecke): strips of ceiling cassettes over the cooking area,
// hung from the ceiling. Extraction strips with baffle filters alternate with light strips and
// closed strips; the supply version has supply air strips with slot outlets instead of the
// closed ones. Above the cassettes the extraction strips carry their plenum with an exhaust
// spigot each, the lights their housings and the supply strips a flat supply plenum, so the
// module shows what it does from below and from above.

import { cross } from "../parts/plan";
import type { KindDef } from "../types";
import { levelSlots, spigotUp } from "./common";

/** Cassette grid (m): about 600 mm along the width, about 800 mm across the depth. */
const CELL_W = 0.6;
const CELL_D = 0.8;
/** Thickness of the cassette layer at the bottom and of the grid profiles (m). */
const LAYER = 0.03;
const PROFILE = 0.02;
/** Baffles across an extraction cassette. */
const BAFFLES = 5;
/** Edge frame round the cassettes: its height above the lower edge (m). */
const FRAME = 0.06;
/** Height of a light housing and of the supply plenum over the cassettes (m). */
const LIGHT_BOX = 0.08;
const SUPPLY_BOX = 0.14;
/** Radius of an exhaust spigot on an extraction plenum (m) and how far it rises. */
const SPIGOT_R = 0.1;
const SPIGOT_RISE = 0.09;
/** Slot outlets across a supply cassette. */
const SUPPLY_SLOTS = 4;

type Strip = "extract" | "light" | "closed" | "supply";

function grid(w: number, d: number): { cols: number; rows: number } {
  return { cols: Math.max(1, Math.round(w / CELL_W)), rows: Math.max(1, Math.round(d / CELL_D)) };
}

/** What a strip (a column of cassettes across the depth) holds: extraction first, then in turn. */
function stripType(col: number, supply: boolean): Strip {
  const t = col % 3;
  return t === 0 ? "extract" : t === 1 ? "light" : supply ? "supply" : "closed";
}

function makeVentCeiling(kind: string, supply: boolean): KindDef {
  return {
    kind,
    placement: "overhead",
    plan(s) {
      const { cols, rows } = grid(s.w / 1000, s.d / 1000);
      const cw = s.w / cols;
      const cd = s.d / rows;
      for (let i = 1; i < cols; i++) s.line("overhead", [s.L + i * cw, s.B], [s.L + i * cw, s.F]);
      for (let j = 1; j < rows; j++) s.line("overhead", [s.L, s.B + j * cd], [s.R, s.B + j * cd]);
      for (let i = 0; i < cols; i++) {
        const t = stripType(i, supply);
        const x0 = s.L + i * cw;
        for (let j = 0; j < rows; j++) {
          const y0 = s.B + j * cd;
          // Extraction cassettes crossed out (an exhaust opening), supply ones with their slots.
          if (t === "extract") s.line("overhead", [x0, y0], [x0 + cw, y0 + cd]);
          if (t === "supply") for (const k of [0.3, 0.5, 0.7]) s.line("overhead", [x0 + cw * k, y0 + cd * 0.15], [x0 + cw * k, y0 + cd * 0.85]);
        }
      }
      if (cols * rows === 1) cross(s, "overhead", false);
    },
    elevation(f) {
      const cols = grid(f.item.width / 1000, f.item.depth / 1000).cols;
      ceilingFront(f, cols, Array.from({ length: cols }, (_, i) => stripType(i, supply)));
    },
    elevationSide(f) {
      // Seen from the side, the strips stand behind each other: the extraction plenum shows.
      ceilingFront(f, Math.max(1, Math.round(f.w / (CELL_D * 1000))), ["extract"]);
    },
    mesh(p, s) {
      const { w, d, h } = s;
      const { cols, rows } = grid(w, d);
      const cw = w / cols;
      const cd = d / rows;
      // Edge frame round the cassette layer, rounded at its lower edge.
      for (const x of [-w / 2, w / 2 - PROFILE]) p.roundedBox("steel", x, x + PROFILE, 0, FRAME, -d / 2, d / 2, 0.003, "all", "z");
      for (const z of [-d / 2, d / 2 - PROFILE]) p.roundedBox("steel", -w / 2 + PROFILE - 0.001, w / 2 - PROFILE + 0.001, 0, FRAME, z, z + PROFILE, 0.003, "all", "x");
      // Grid profiles between the cassettes, flush with the lower edge.
      for (let i = 1; i < cols; i++) {
        const x = -w / 2 + i * cw;
        p.roundedBox("steelDark", x - PROFILE / 2, x + PROFILE / 2, 0.001, LAYER, -d / 2 + PROFILE, d / 2 - PROFILE, 0.003, "all", "z");
      }
      for (let j = 1; j < rows; j++) {
        const z = -d / 2 + j * cd;
        p.roundedBox("steelDark", -w / 2 + PROFILE, w / 2 - PROFILE, 0.001, LAYER, z - PROFILE / 2, z + PROFILE / 2, 0.003, "all", "x");
      }
      for (let i = 0; i < cols; i++) {
        const t = stripType(i, supply);
        const sx0 = -w / 2 + i * cw + (i === 0 ? PROFILE : PROFILE / 2);
        const sx1 = -w / 2 + (i + 1) * cw - (i === cols - 1 ? PROFILE : PROFILE / 2);
        const sz0 = -d / 2 + PROFILE;
        const sz1 = d / 2 - PROFILE;
        for (let j = 0; j < rows; j++) {
          const x0 = sx0 + 0.001;
          const x1 = sx1 - 0.001;
          const z0 = -d / 2 + j * cd + (j === 0 ? PROFILE : PROFILE / 2) + 0.001;
          const z1 = -d / 2 + (j + 1) * cd - (j === rows - 1 ? PROFILE : PROFILE / 2) - 0.001;
          cassette(p, t, x0, x1, z0, z1);
        }
        // What stands above the strip.
        if (t === "extract") {
          const ph = h - SPIGOT_RISE;
          p.roundedBox("steel", sx0 + 0.02, sx1 - 0.02, LAYER, ph, sz0 + 0.02, sz1 - 0.02, 0.006, "top");
          const r = Math.min(SPIGOT_R, (sx1 - sx0) / 2 - 0.05, (sz1 - sz0) / 2 - 0.05);
          spigotUp(p, (sx0 + sx1) / 2, ph, 0, r, h - ph);
        } else if (t === "light") {
          for (let j = 0; j < rows; j++) {
            const z0 = -d / 2 + j * cd + cd * 0.25;
            const z1 = -d / 2 + (j + 1) * cd - cd * 0.25;
            p.roundedBox("steelDark", (sx0 + sx1) / 2 - 0.1, (sx0 + sx1) / 2 + 0.1, LAYER, LAYER + LIGHT_BOX, z0, z1, 0.008, "top");
          }
        } else if (t === "supply") {
          p.roundedBox("steel", sx0 + 0.03, sx1 - 0.03, LAYER, LAYER + SUPPLY_BOX, sz0 + 0.03, sz1 - 0.03, 0.006, "top");
          spigotUp(p, (sx0 + sx1) / 2, LAYER + SUPPLY_BOX, 0, Math.min(0.08, (sx1 - sx0) / 2 - 0.06), Math.min(0.08, h - LAYER - SUPPLY_BOX));
        }
      }
    },
  };
}

/**
 * One cassette from below: an extraction cassette with its baffle filter (dark frame, slots and
 * baffles), a light with its frame and diffuser, a supply cassette with slot outlets, or a closed
 * panel with its seams.
 */
function cassette(p: Parameters<KindDef["mesh"]>[0], t: Strip, x0: number, x1: number, z0: number, z1: number): void {
  if (t === "extract") {
    p.roundedBox("steelDark", x0, x1, 0.004, LAYER - 0.002, z0, z1, 0.004);
    // A dark slot in each gap between two baffles (under a baffle it would not show).
    const pb = (x1 - x0 - 0.06) / BAFFLES;
    levelSlots(p, x0 + 0.03 + pb / 2, x1 - 0.03 - pb / 2, z0 + 0.03, z1 - 0.03, 0.004, BAFFLES - 1, 0.016);
    for (let k = 1; k <= BAFFLES; k++) {
      const x = x0 + 0.03 + ((x1 - x0 - 0.06) * (k - 0.5)) / BAFFLES;
      p.roundedBox("satin", x - 0.014, x + 0.014, 0.002, 0.008, z0 + 0.025, z1 - 0.025, 0.003, "all", "z");
    }
    // The filter's grip in the middle of its front edge.
    p.roundedBox("handle", (x0 + x1) / 2 - 0.04, (x0 + x1) / 2 + 0.04, 0.001, 0.005, z1 - 0.03, z1 - 0.012, 0.002, "all", "x");
  } else if (t === "light") {
    p.roundedBox("steel", x0, x1, 0.008, LAYER - 0.002, z0, z1, 0.004);
    const lx0 = (x0 + x1) / 2 - 0.12;
    const lx1 = (x0 + x1) / 2 + 0.12;
    const lz0 = z0 + (z1 - z0) * 0.2;
    const lz1 = z1 - (z1 - z0) * 0.2;
    p.roundedBox("satin", lx0 - 0.015, lx1 + 0.015, 0.004, 0.009, lz0 - 0.015, lz1 + 0.015, 0.006, "vertical");
    p.roundedBox("panel", lx0, lx1, 0.002, 0.005, lz0, lz1, 0.01, "vertical");
  } else if (t === "supply") {
    p.roundedBox("steel", x0, x1, 0.006, LAYER - 0.002, z0, z1, 0.004);
    levelSlots(p, x0 + (x1 - x0) * 0.2, x1 - (x1 - x0) * 0.2, z0 + 0.05, z1 - 0.05, 0.006, SUPPLY_SLOTS, 0.02);
  } else {
    p.roundedBox("steel", x0, x1, 0.006, LAYER - 0.002, z0, z1, 0.004);
  }
}

/**
 * The front of a module: the cassette layer and the edge frame, the joints of `cells` cassettes,
 * and over the strips (one per cell, or one over the whole width) their plenums and spigots.
 */
function ceilingFront(f: Parameters<KindDef["elevation"]>[0], cells: number, strips: readonly Strip[]): void {
  const { l, r, z0, top } = f;
  f.line("detail", [l, z0 + LAYER * 1000], [r, z0 + LAYER * 1000]);
  f.line("detail", [l, z0 + FRAME * 1000], [r, z0 + FRAME * 1000]);
  for (let i = 1; i < cells; i++) {
    const x = l + (f.w * i) / cells;
    f.line("detail", [x, z0], [x, z0 + LAYER * 1000]);
  }
  const sw = f.w / strips.length;
  const zl = z0 + LAYER * 1000;
  strips.forEach((t, i) => {
    const a = l + i * sw;
    const c = a + sw / 2;
    if (t === "extract") {
      const ph = top - SPIGOT_RISE * 1000;
      f.box("detail", a + 30, a + sw - 30, zl, ph);
      const rr = Math.min(SPIGOT_R * 1000, sw / 2 - 60);
      f.box("detail", c - rr, c + rr, ph, top);
    } else if (t === "light") {
      f.box("detail", c - 100, c + 100, zl, Math.min(top, zl + LIGHT_BOX * 1000));
    } else if (t === "supply") {
      const sh = Math.min(top, zl + SUPPLY_BOX * 1000);
      f.box("detail", a + 40, a + sw - 40, zl, sh);
      if (top - sh > 10) f.box("detail", c - 80, c + 80, sh, Math.min(top, sh + 80));
    }
  });
}

export const ventCeiling = makeVentCeiling("ventCeiling", false);
export const ventCeilingSupply = makeVentCeiling("ventCeilingSupply", true);
