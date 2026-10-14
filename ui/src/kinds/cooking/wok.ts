// Wok range (Wokherd): one wok position per 400 mm, a gas ring burner under a cast wok ring or
// an induction wok with its glass bowl, a swivel tap at the back to rinse the wok and a
// gutter at the front; doors below.

import { TAP } from "../parts/elevation";
import { CONTROLS, SHEET, tap } from "../parts/mesh";
import { controlStrip } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule, planTop } from "./common";

/** Thickness of the top (m). */
const TOP_SHEET = 0.03;

/** Centres of the wok positions across the top and their radius (m). */
function woks(w: number, d: number): { x: number; z: number; r: number }[] {
  const n = columns(w, 0.4);
  const cw = w / n;
  const z = -d / 2 + (d - CONTROLS) * 0.55;
  const r = Math.min(cw * 0.4, (d - CONTROLS) * 0.3);
  return Array.from({ length: n }, (_, i) => ({ x: -w / 2 + cw * (i + 0.5), z, r }));
}

export const wok: KindDef = {
  kind: "wok",
  rise: TAP,
  plan(s) {
    const { x0, x1, y0, y1 } = planTop(s);
    const n = columns(s.w);
    const cw = (x1 - x0) / n;
    const r = Math.min(cw * 0.4, (y1 - y0) * 0.35);
    for (let i = 0; i < n; i++) {
      const cx = x0 + cw * (i + 0.5);
      const cy = y0 + (y1 - y0) * 0.55;
      s.circle("detail", cx, cy, r);
      s.circle("detail", cx, cy, r * 0.45);
    }
    // The swivel tap at the back.
    s.circle("detail", n > 1 ? s.L + s.w / n : 0, s.B + 50, 20);
    // The rinsing gutter in front of the woks.
    s.line("detail", [x0, y1 - 30], [x1, y1 - 30]);
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, columns(f.w), "doors");
    // The swivel tap over the top.
    const n = columns(f.w);
    const x = n > 1 ? f.l + f.w / n : f.l + f.w / 2;
    const top = f.top;
    f.line("detail", [x, top], [x, top + TAP * 0.95], [x + TAP * 0.3, top + TAP * 0.95]);
  },
  mesh(p, s, item) {
    const n = columns(s.w, 0.4);
    const topY = s.h - SHEET;
    const all = woks(s.w, s.d);
    const holes = all.map((w) => ({ x0: w.x - w.r, x1: w.x + w.r, z0: w.z - w.r, z1: w.z + w.r }));
    const bowl = 0.08;
    lineModule(p, s, { base: "doors", knobs: n, underTop: topY - TOP_SHEET, solidTo: topY - bowl - 0.01 });
    p.topWithHoles("steel", s.w, s.d, topY - TOP_SHEET, topY, holes);
    // Raised edges at the back and the sides keep the splashes on the top.
    p.box("steel", -s.w / 2, s.w / 2, topY, s.h, -s.d / 2, -s.d / 2 + SHEET * 2);
    p.box("steel", -s.w / 2, -s.w / 2 + SHEET, topY, s.h, -s.d / 2, s.d / 2);
    p.box("steel", s.w / 2 - SHEET, s.w / 2, topY, s.h, -s.d / 2, s.d / 2);
    // Gutter across the front of the top.
    p.box("steelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, topY - 0.002, topY + 0.001, s.d / 2 - CONTROLS - 0.03, s.d / 2 - CONTROLS);
    const gas = item.energy === "gas";
    const b = 0.006;
    for (const w of all) {
      const { x, z, r } = w;
      if (gas) {
        // A burner bowl with the ring burner at its bottom under a cast wok support.
        p.tub("top", x - r, x + r, topY - bowl, topY, z - r, z + r);
        p.cyl("steelDark", x, z, topY - bowl, topY - bowl + 0.025, r * 0.45);
        p.cyl("knob", x, z, topY - bowl + 0.025, topY - bowl + 0.035, r * 0.3);
        p.box("knob", x - r, x + r, topY, s.h, z - r, z - r + b * 2);
        p.box("knob", x - r, x + r, topY, s.h, z + r - b * 2, z + r);
        p.box("knob", x - r, x - r + b * 2, topY, s.h, z - r, z + r);
        p.box("knob", x + r - b * 2, x + r, topY, s.h, z - r, z + r);
        p.box("knob", x - r, x - r * 0.45, s.h - 0.008, s.h, z - b, z + b);
        p.box("knob", x + r * 0.45, x + r, s.h - 0.008, s.h, z - b, z + b);
        p.box("knob", x - b, x + b, s.h - 0.008, s.h, z - r, z - r * 0.45);
        p.box("knob", x - b, x + b, s.h - 0.008, s.h, z + r * 0.45, z + r);
      } else {
        // Induction: a black glass bowl set into the top, its zone marked at the bottom.
        p.tub("ceramic", x - r, x + r, topY - bowl, topY, z - r, z + r);
        p.cyl("zone", x, z, topY - bowl, topY - bowl + 0.012, r * 0.5);
        p.cyl("ceramic", x, z, topY - bowl, topY - bowl + 0.014, r * 0.42);
      }
    }
    // One swivel tap at the back, between the first two positions or in the middle.
    tap(p, n > 1 ? -s.w / 2 + s.w / n : 0, -s.d / 2, topY, TAP / 1000 + SHEET);
  },
};
