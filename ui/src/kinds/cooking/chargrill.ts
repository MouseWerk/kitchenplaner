// Chargrill (Lavasteingrill): cast grates over a bed of lava stones heated by gas burners or
// electric elements, one grate per 400 mm, splash guards at the back and the sides; an open base.

import { CONTROLS, SHEET, worktop } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule } from "./common";
import { splashGuards } from "./details";

/** Height of the splash guards over the grates (m). */
const GUARD = 0.06;
/** Depth of the lava stone bed under the grates (m). */
const BED = 0.08;
/** Pitch of the grate bars (m). */
const BAR_PITCH = 0.035;
/** How far the front edge stands over the grates (m). */
const FRONT_LIP = 0.02;

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
    // The front edge (with the grease trough) stands over the grates, so from the front only
    // the splash guards show above it, not the ends of the bars.
    worktop(p, "steel", -s.w / 2, s.w / 2, bedTop - SHEET, grate + FRONT_LIP, z1 + m, s.d / 2);
    p.roundedBox("slot", -s.w / 2 + 0.04, s.w / 2 - 0.04, grate + FRONT_LIP - 0.002, grate + FRONT_LIP + 0.0005, z1 + m + 0.015, z1 + m + 0.04, 0.012, "vertical");
    const bx0 = -s.w / 2 + SHEET;
    const bx1 = s.w / 2 - SHEET;
    if (item.energy === "gas") {
      // The bed of lava stones on its grid over the burners.
      p.roundedBox("granite", bx0, bx1, bedTop, bedTop + 0.03, -s.d / 2 + SHEET, z1 + m - SHEET, 0.012, "top");
    } else {
      // Tubular heating elements in loops under the grates, on a dark reflector.
      p.box("steelDark", bx0, bx1, bedTop, bedTop + SHEET, -s.d / 2 + SHEET, z1 + m - SHEET);
      const loops = n * 2;
      const lw = (bx1 - bx0) / loops;
      const ey = bedTop + 0.045;
      for (let i = 0; i < loops; i++) {
        const xa = bx0 + lw * (i + 0.25);
        const xb = bx0 + lw * (i + 0.75);
        p.tube("steelDark", [
          { x: xa, y: ey, z: z1 - 0.01 },
          { x: xa, y: ey, z: z0 + 0.03 },
          { x: xb, y: ey, z: z0 + 0.03 },
          { x: xb, y: ey, z: z1 - 0.01 },
        ], 0.005, { bend: Math.min(0.02, lw / 4) });
      }
    }
    const gw = (s.w - m * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + m + i * (gw + m);
      const bars = Math.max(3, Math.floor(gw / BAR_PITCH));
      // Cast grate bars with rounded tops, on cross bars at the back and the front.
      for (let k = 0; k < bars; k++) {
        const x = x0 + (gw / bars) * (k + 0.5);
        p.roundedBox("castIron", x - 0.005, x + 0.005, grate - 0.02, grate, z0, z1, 0.004, "top");
      }
      p.roundedBox("castIron", x0, x0 + gw, grate - 0.028, grate - 0.019, z0, z0 + 0.015, 0.003);
      p.roundedBox("castIron", x0, x0 + gw, grate - 0.028, grate - 0.019, z1 - 0.015, z1, 0.003);
    }
    splashGuards(p, s, grate - 0.005, s.h, 0);
  },
};
