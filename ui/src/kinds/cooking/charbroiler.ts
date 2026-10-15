// Charbroiler (Strahlergrill): heavy cast grates, their bars running across, over bright steel radiants, the inverted V shields over
// the gas burners that vaporise the dripping fat (electric: tubular elements in the same place),
// a water tray under them catching the rest, splash guards at the back and the sides; an open
// base. One grate section per 400 mm.

import { CONTROLS, SHEET, worktop } from "../parts/mesh";
import { CONTROL_STRIP, controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule } from "./common";
import { splashGuards } from "./details";

/** Height of the splash guards over the grates, and the room under the grates (m). */
const GUARD = 0.07;
const FIREBOX = 0.12;
/** Pitch of the grate bars and of the radiants (m). */
const BAR_PITCH = 0.028;
const RADIANT_PITCH = 0.1;

export const charbroiler: KindDef = {
  kind: "charbroiler",
  plan(s) {
    const n = columns(s.w);
    const y0 = s.B + INSET;
    const y1 = s.F - CONTROL_STRIP;
    const gw = (s.w - INSET * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const x = s.L + INSET + i * (gw + INSET);
      s.rect("detail", x, y0, x + gw, y1);
      // The bars run across, unlike the chargrill's (front to back) over its lava stones.
      const bars = Math.max(3, Math.round((y1 - y0) / (BAR_PITCH * 2000)));
      for (let k = 1; k < bars; k++) s.line("detail", [x, y0 + ((y1 - y0) / bars) * k], [x + gw, y0 + ((y1 - y0) / bars) * k]);
    }
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, columns(f.w), "open");
    // The water tray's front under the grates.
    f.line("detail", [f.l + 40, f.top - (GUARD + FIREBOX) * 1000 + 20], [f.r - 40, f.top - (GUARD + FIREBOX) * 1000 + 20]);
  },
  mesh(p, s, item) {
    const n = columns(s.w, 0.4);
    const grate = s.h - GUARD;
    const floor = grate - FIREBOX;
    lineModule(p, s, { base: "open", knobs: n, underTop: floor - SHEET });
    const m = 0.03;
    const z0 = -s.d / 2 + m;
    const z1 = s.d / 2 - CONTROLS;
    // The fire box with the water tray on its floor, the front edge standing over the grates.
    p.tub("steel", -s.w / 2, s.w / 2, floor - SHEET, grate, -s.d / 2, z1 + m, SHEET);
    p.tub("steelDark", -s.w / 2 + SHEET, s.w / 2 - SHEET, floor, floor + 0.03, -s.d / 2 + SHEET, z1 + m - SHEET, SHEET / 2);
    p.roundedBox("water", -s.w / 2 + SHEET * 2, s.w / 2 - SHEET * 2, floor + 0.004, floor + 0.022, -s.d / 2 + SHEET * 2, z1 + m - SHEET * 2, 0.012, "vertical");
    worktop(p, "steel", -s.w / 2, s.w / 2, floor - SHEET, grate + 0.02, z1 + m, s.d / 2);
    // Radiants over the burners (gas) or the heating elements (electric), from back to front.
    const ry = grate - 0.05;
    const runs = Math.max(2, Math.round(s.w / RADIANT_PITCH));
    const rw = (s.w - SHEET * 2) / runs;
    for (let i = 0; i < runs; i++) {
      const cx = -s.w / 2 + SHEET + rw * (i + 0.5);
      if (item.energy === "gas") {
        const hw = rw * 0.42;
        p.extrude("satin", "z", z0, z1, [
          [cx - hw, ry - 0.03],
          [cx - hw + 0.004, ry - 0.03],
          [cx, ry - 0.004],
          [cx + hw - 0.004, ry - 0.03],
          [cx + hw, ry - 0.03],
          [cx, ry],
        ]);
        p.rod("steelDark", "z", cx, ry - 0.045, (z0 + z1) / 2, z1 - z0 - 0.02, 0.008);
      } else {
        p.tube("satin", [
          { x: cx - rw * 0.25, y: ry - 0.01, z: z1 - 0.01 },
          { x: cx - rw * 0.25, y: ry - 0.01, z: z0 + 0.02 },
          { x: cx + rw * 0.25, y: ry - 0.01, z: z0 + 0.02 },
          { x: cx + rw * 0.25, y: ry - 0.01, z: z1 - 0.01 },
        ], 0.005, { bend: Math.min(0.02, rw / 5) });
      }
    }
    // The cast grates: bars across with rounded tops, so from above they cross the radiants under
    // them; they lie on side bars at the left and the right of each 400 mm section and run on
    // over the joints (one bar per row keeps a wide unit within the budget).
    const gw = (s.w - m * (n + 1)) / n;
    const bars = Math.max(3, Math.floor((z1 - z0) / BAR_PITCH));
    for (let k = 0; k < bars; k++) {
      const z = z0 + ((z1 - z0) / bars) * (k + 0.5);
      p.roundedBox("castIron", -s.w / 2 + m + 0.004, s.w / 2 - m - 0.004, grate - 0.022, grate, z - 0.006, z + 0.006, 0.005, "top");
    }
    for (let i = 0; i < n; i++) {
      const x0 = -s.w / 2 + m + i * (gw + m);
      for (const x of [x0, x0 + gw - 0.02]) p.roundedBox("castIron", x, x + 0.02, grate - 0.03, grate - 0.02, z0, z1, 0.003);
    }
    splashGuards(p, s, grate - 0.005, s.h, 0);
  },
};
