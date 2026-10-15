// Wok range (Wokherd): one wok position per 400 mm, a round opening in the top with a gas ring
// burner under a cast wok ring, or an induction wok with its black glass bowl under a bright
// trim ring; a swivel tap at the back to rinse the wok and a gutter at the front; doors below.

import { TAP } from "../parts/elevation";
import { flueBox } from "../parts/flue";
import { CONTROLS, SHEET, tap, type Size } from "../parts/mesh";
import { controlStrip } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule } from "./common";

/** Thickness of the top (m). */
const TOP_SHEET = 0.03;
/** Depth of the burner pit or the glass bowl under the top (m). */
const BOWL = 0.08;
/** Radius of the bar of the wok ring; the ring stands this twice over the top (m). */
const RING_BAR = 0.0125;
/** Radius of the ring's centre line as a share of the opening's radius. */
const RING_AT = 0.9;
/** Room between the flue outlet and the tap column (m). */
const TAP_SIDE = 0.04;
/** Centres of the wok positions across the top and their radius (m). */
function woks(w: number, d: number): { x: number; z: number; r: number }[] {
  const n = columns(w, 0.4);
  const cw = w / n;
  const z = -d / 2 + (d - CONTROLS) * 0.55;
  const r = Math.min(cw * 0.4, (d - CONTROLS) * 0.3);
  return Array.from({ length: n }, (_, i) => ({ x: -w / 2 + cw * (i + 0.5), z, r }));
}

/** Where the swivel tap stands across the width (m): at the back, left of the flue outlet. */
function tapX(s: Size): number {
  return flueBox(s).x0 - TAP_SIDE;
}

export const wok: KindDef = {
  kind: "wok",
  rise: TAP,
  plan(s) {
    const m = { w: s.w / 1000, d: s.d / 1000, h: s.item.height / 1000 };
    for (const w of woks(m.w, m.d)) {
      // The opening with its ring, and the burner (or the induction zone) in it.
      s.circle("detail", w.x * 1000, w.z * 1000, w.r * 1000);
      s.circle("detail", w.x * 1000, w.z * 1000, w.r * 450);
    }
    // The swivel tap at the back.
    s.circle("detail", tapX(m) * 1000, s.B + 50, 20);
    // The rinsing gutter in front of the woks.
    const gy = s.F - (CONTROLS + 0.015) * 1000;
    s.line("detail", [s.L + 30, gy], [s.R - 30, gy]);
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, columns(f.w), "doors");
    // The swivel tap over the top.
    const m = { w: f.w / 1000, d: f.item.depth / 1000, h: f.item.height / 1000 };
    const x = f.l + (tapX(m) + m.w / 2) * 1000;
    const top = f.top;
    f.line("detail", [x, top], [x, top + TAP * 0.95], [x + TAP * 0.3, top + TAP * 0.95]);
  },
  mesh(p, s, item) {
    const n = columns(s.w, 0.4);
    // The top lies lower than the item height by the wok ring standing on it.
    const topY = s.h - RING_BAR * 2;
    const all = woks(s.w, s.d);
    const holes = all.map((w) => ({ x0: w.x - w.r, x1: w.x + w.r, z0: w.z - w.r, z1: w.z + w.r }));
    lineModule(p, s, { base: "doors", knobs: n, underTop: topY - TOP_SHEET, solidTo: topY - BOWL - 0.01 });
    p.topWithHoles("steel", s.w, s.d, topY - TOP_SHEET, topY, holes);
    // Raised edges at the back and the sides keep the splashes on the top.
    p.box("steel", -s.w / 2, s.w / 2, topY, s.h, -s.d / 2, -s.d / 2 + SHEET * 2);
    p.box("steel", -s.w / 2, -s.w / 2 + SHEET, topY, s.h, -s.d / 2, s.d / 2);
    p.box("steel", s.w / 2 - SHEET, s.w / 2, topY, s.h, -s.d / 2, s.d / 2);
    // Gutter across the front of the top.
    p.box("steelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, topY - 0.002, topY + 0.001, s.d / 2 - CONTROLS - 0.03, s.d / 2 - CONTROLS);
    const gas = item.energy === "gas";
    for (const { x, z, r } of all) {
      p.roundOpening("steel", x, z, r, topY - TOP_SHEET, topY);
      // The pit under the opening ends under the top, so only the round opening shows.
      const pitTop = topY - TOP_SHEET / 2;
      if (gas) {
        // The ring burner at the bottom of a dark pit, under a cast wok ring with three prongs.
        p.tub("top", x - r, x + r, topY - BOWL, pitTop, z - r, z + r);
        p.cyl("steelDark", x, z, topY - BOWL, topY - BOWL + 0.025, r * 0.45);
        p.cyl("knob", x, z, topY - BOWL + 0.025, topY - BOWL + 0.035, r * 0.3);
        p.ring("knob", x, z, topY + RING_BAR, r * RING_AT, RING_BAR);
        const py = s.h - RING_BAR / 2;
        for (let i = 0; i < 3; i++) {
          const a = Math.PI / 2 + (i / 3) * Math.PI * 2;
          const c = Math.cos(a);
          const k = Math.sin(a);
          const outer = r * RING_AT;
          const inner = r * 0.55;
          p.bar("knob", { x: x + outer * c, y: py, z: z + outer * k }, { x: x + inner * c, y: py, z: z + inner * k }, RING_BAR / 2);
        }
      } else {
        // Induction: a black glass bowl set into the top, its zone marked at the bottom, under a
        // bright trim ring.
        p.tub("ceramic", x - r, x + r, topY - BOWL, pitTop, z - r, z + r);
        p.cyl("zone", x, z, topY - BOWL, topY - BOWL + 0.012, r * 0.5);
        p.cyl("ceramic", x, z, topY - BOWL, topY - BOWL + 0.014, r * 0.42);
        p.ring("handle", x, z, topY + RING_BAR, r * RING_AT, RING_BAR);
      }
    }
    // One swivel tap at the back, beside the flue outlet of a gas range.
    tap(p, tapX(s), -s.d / 2, topY, TAP / 1000 + (s.h - topY));
  },
};
