// Range (Herd): an electric one with round hotplates, a gas one with open burners under cast pan
// supports; over an oven (`range`) or an open base (`rangeOpen`). Two cooking zones front to
// back per 400 mm of width.

import { controlStrip, hob } from "../parts/plan";
import type { KindDef } from "../types";
import { columns, gasBurners, hotplates, lineFront, lineModule, PAN_SUPPORT, planBurners, PROUD, type LineBase } from "./common";

/** Thickness of the burner tray or hotplate top (m). */
const TOP_SHEET = 0.03;

function makeRange(kind: string, base: LineBase): KindDef {
  const oven = base === "oven" ? 1 : 0;
  return {
    kind,
    plan(s) {
      const cols = columns(s.w);
      if (s.item.energy === "gas") {
        planBurners(s, cols, 2);
        controlStrip(s);
      } else hob(s, cols, true);
    },
    elevation(f) {
      lineFront(f, columns(f.w) * 2 + oven, base);
    },
    mesh(p, s, item) {
      const cols = columns(s.w, 0.4);
      // One knob per cooking zone and one for the oven.
      if (item.energy === "gas") {
        const trayTop = s.h - PAN_SUPPORT;
        lineModule(p, s, { base, knobs: cols * 2 + oven, underTop: trayTop - TOP_SHEET });
        p.box("top", -s.w / 2, s.w / 2, trayTop - TOP_SHEET, trayTop, -s.d / 2, s.d / 2);
        gasBurners(p, s, cols, 2, trayTop, s.h);
      } else {
        // The top sits a little lower than the item height, so the hotplates stand proud of it.
        const topY = s.h - PROUD * 2;
        lineModule(p, s, { base, knobs: cols * 2 + oven, underTop: topY - TOP_SHEET });
        p.box("top", -s.w / 2, s.w / 2, topY - TOP_SHEET, topY, -s.d / 2, s.d / 2);
        hotplates(p, s, cols, 2, topY - PROUD, s.h);
      }
    },
  };
}

export const range = makeRange("range", "oven");
export const rangeOpen = makeRange("rangeOpen", "open");
