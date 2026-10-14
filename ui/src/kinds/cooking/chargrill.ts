// Chargrill (Lavasteingrill): cast grates over a bed of lava stones heated by gas burners or
// electric elements, one grate per 400 mm, splash guards at the back and the sides; an open base.

import { CONTROLS, SHEET } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule } from "./common";

/** Height of the splash guards over the grates (m). */
const GUARD = 0.06;
/** Depth of the lava stone bed under the grates (m). */
const BED = 0.08;
/** Pitch of the grate bars (m). */
const BAR_PITCH = 0.035;

export const chargrill: KindDef = {
  kind: "chargrill",
  plan(s) {
    const n = columns(s.w);
    const y0 = s.B + INSET;
    const y1 = s.F - CONTROL_STRIP;
    const gw = (s.w - INSET * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const x = s.L + INSET + i * (gw + INSET);
      s.rect("detail", x, y0, x + gw, y1);
      // Grate bars from back to front.
      for (let k = 1; k < 4; k++) s.line("detail", [x + (gw / 4) * k, y0], [x + (gw / 4) * k, y1]);
    }
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, columns(f.w), "open");
  },
  mesh(p, s, item) {
    const n = columns(s.w, 0.4);
    const grate = s.h - GUARD;
    const bedTop = grate - BED;
    lineModule(p, s, { base: "open", knobs: n, underTop: bedTop - SHEET * 2 });
    p.box("steel", -s.w / 2, s.w / 2, bedTop - SHEET * 2, bedTop - SHEET, -s.d / 2, s.d / 2);
    const m = 0.03;
    const z0 = -s.d / 2 + m;
    const z1 = s.d / 2 - CONTROLS;
    // The fire box: walls up to the grates, the lava stones (or the heating elements) inside.
    p.tub("steel", -s.w / 2, s.w / 2, bedTop - SHEET, grate, -s.d / 2, z1 + m, SHEET);
    p.box("steel", -s.w / 2, s.w / 2, bedTop - SHEET, grate, z1 + m, s.d / 2);
    if (item.energy === "gas") p.box("rubber", -s.w / 2 + SHEET, s.w / 2 - SHEET, bedTop, bedTop + 0.03, -s.d / 2 + SHEET, z1 + m - SHEET);
    else {
      p.box("steelDark", -s.w / 2 + SHEET, s.w / 2 - SHEET, bedTop, bedTop + SHEET, -s.d / 2 + SHEET, z1 + m - SHEET);
      for (let i = 0; i < n * 2; i++) p.rod("zone", "z", -s.w / 2 + (s.w / (n * 2)) * (i + 0.5), bedTop + 0.04, (z0 + z1) / 2, z1 - z0 - 0.04, 0.006);
    }
    const gw = (s.w - m * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + m + i * (gw + m);
      const bars = Math.max(3, Math.floor(gw / BAR_PITCH));
      for (let k = 0; k < bars; k++) {
        const x = x0 + (gw / bars) * (k + 0.5);
        p.box("knob", x - 0.005, x + 0.005, grate - 0.02, grate, z0, z1);
      }
      // Cross bars at the back and the front carrying the grate.
      p.box("knob", x0, x0 + gw, grate - 0.025, grate - 0.02, z0, z0 + 0.015);
      p.box("knob", x0, x0 + gw, grate - 0.025, grate - 0.02, z1 - 0.015, z1);
    }
    // Splash guards at the back and the sides.
    p.box("steel", -s.w / 2, s.w / 2, grate, s.h, -s.d / 2, -s.d / 2 + SHEET);
    p.box("steel", -s.w / 2, -s.w / 2 + SHEET, grate, s.h, -s.d / 2, 0);
    p.box("steel", s.w / 2 - SHEET, s.w / 2, grate, s.h, -s.d / 2, 0);
  },
};
