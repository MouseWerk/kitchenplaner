// Solid top (Glühplatte): one cast plate over the whole top, hottest in the middle of its rings
// and cooler towards the edges, over an oven. One ring centre per 800 mm.

import { CONTROLS, SHEET } from "../parts/mesh";
import { controlStrip } from "../parts/plan";
import type { KindDef } from "../types";
import { lineFront, lineModule, planTop, PROUD } from "./common";

/** Width of the plate per ring centre (m). */
const RING_MODULE = 0.8;
/** Thickness of the cast plate (m). */
const PLATE = 0.03;

function rings(width: number): number {
  return Math.max(1, Math.round(width / RING_MODULE));
}

export const solidTop: KindDef = {
  kind: "solidTop",
  plan(s) {
    const { x0, x1, y0, y1 } = planTop(s);
    s.rect("detail", x0, y0, x1, y1);
    const n = rings(s.w / 1000);
    const cw = (x1 - x0) / n;
    const r = Math.min(cw, y1 - y0) / 2;
    for (let i = 0; i < n; i++) {
      const cx = x0 + cw * (i + 0.5);
      s.circle("detail", cx, (y0 + y1) / 2, r * 0.25);
      s.circle("detail", cx, (y0 + y1) / 2, r * 0.6);
    }
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, rings(f.w / 1000) * 2 + 1, "oven");
  },
  mesh(p, s) {
    const n = rings(s.w);
    const plateTop = s.h - PROUD * 2;
    lineModule(p, s, { base: "oven", knobs: n * 2 + 1, underTop: plateTop - PLATE });
    // Stainless frame with the cast plate in it; the rings stand a little proud.
    p.box("steel", -s.w / 2, s.w / 2, plateTop - PLATE, plateTop - PROUD, -s.d / 2, s.d / 2);
    const m = 0.03;
    const z0 = -s.d / 2 + m;
    const z1 = s.d / 2 - CONTROLS;
    p.box("plate", -s.w / 2 + m, s.w / 2 - m, plateTop - PLATE + SHEET, plateTop, z0, z1);
    const cw = (s.w - 2 * m) / n;
    const r = Math.min(cw, z1 - z0) / 2;
    for (let i = 0; i < n; i++) {
      const cx = -s.w / 2 + m + cw * (i + 0.5);
      const cz = (z0 + z1) / 2;
      // Each ring a step higher than the one around it, so no two faces share a plane.
      p.cyl("steelDark", cx, cz, plateTop - PROUD, s.h - PROUD * 1.5, r * 0.62);
      p.cyl("plate", cx, cz, plateTop - PROUD, s.h - PROUD, r * 0.56);
      p.cyl("steelDark", cx, cz, plateTop - PROUD, s.h - PROUD / 2, r * 0.27);
      p.cyl("plate", cx, cz, plateTop - PROUD, s.h, r * 0.22);
    }
  },
};
