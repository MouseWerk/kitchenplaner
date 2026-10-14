// Pasta cooker (Nudelkocher): one deep water basin per 400 mm with portion baskets hanging on a
// bar at the back, a water inlet in the basin; doors below (drain valve behind them).

import { CONTROLS, SHEET } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule } from "./common";

/** Thickness of the top (m). */
const TOP_SHEET = 0.03;
/** Depth of the basin below the top (m). */
const BASIN = 0.3;
/** Water level below the top (m). */
const WATER = 0.07;

export const pastaCooker: KindDef = {
  kind: "pastaCooker",
  plan(s) {
    const n = columns(s.w);
    const bw = (s.w - (n + 1) * INSET) / n;
    for (let i = 0; i < n; i++) {
      const x = s.L + INSET + i * (bw + INSET);
      const y0 = s.B + INSET;
      const y1 = s.F - CONTROL_STRIP;
      s.rect("detail", x, y0, x + bw, y1);
      // Two portion baskets side by side, front to back.
      s.line("detail", [x + bw / 2, y0 + INSET], [x + bw / 2, y1 - INSET]);
      s.rect("detail", x + INSET / 2, y0 + INSET / 2, x + bw - INSET / 2, y1 - INSET / 2);
    }
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, columns(f.w), "doors");
  },
  mesh(p, s) {
    const n = columns(s.w, 0.4);
    const m = 0.04;
    const bw = (s.w - m * (n + 1)) / n;
    const z0 = -s.d / 2 + m;
    const z1 = s.d / 2 - CONTROLS - m;
    const holes = Array.from({ length: n }, (_, i) => {
      const x0 = -s.w / 2 + m + i * (bw + m);
      return { x0, x1: x0 + bw, z0, z1 };
    });
    lineModule(p, s, { base: "doors", knobs: n, underTop: s.h - TOP_SHEET, solidTo: s.h - BASIN - 0.01 });
    p.topWithHoles("steel", s.w, s.d, s.h - TOP_SHEET, s.h, holes);
    for (const { x0, x1 } of holes) {
      p.tub("steelDark", x0, x1, s.h - BASIN, s.h, z0, z1, SHEET / 2);
      p.box("glass", x0 + SHEET / 2, x1 - SHEET / 2, s.h - BASIN + SHEET, s.h - WATER, z0 + SHEET / 2, z1 - SHEET / 2);
      // The bar at the back the baskets hang on, and the water inlet below it.
      p.rod("handle", "x", (x0 + x1) / 2, s.h - 0.012, z0 + 0.03, x1 - x0 - SHEET, 0.006);
      p.rod("handle", "z", x0 + 0.04, s.h - WATER + 0.02, z0 + 0.025, 0.04, 0.008);
      // Two portion baskets, their grips at the front of the basin.
      const inset = 0.015;
      const kw = (x1 - x0 - inset * 3) / 2;
      const kz1 = z1 - 0.08;
      for (const kx of [x0 + inset, x0 + inset * 2 + kw]) {
        p.box("basket", kx, kx + kw, s.h - 0.22, s.h - 0.04, z0 + 0.05, kz1);
        const cx = kx + kw / 2;
        p.box("handle", cx - 0.004, cx + 0.004, s.h - 0.04, s.h - 0.012, kz1 - 0.008, kz1);
        p.rod("knob", "z", cx, s.h - 0.02, kz1 + 0.035, 0.07, 0.009);
      }
    }
  },
};
