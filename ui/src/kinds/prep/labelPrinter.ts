// Label printer (Etikettendrucker), a table-top HACCP labelling station: a satin base plate with
// the printer at the right, its label slot at the front, and a touch screen on a stand at the left
// for date, contents and allergens.

import type { Size } from "../parts/mesh";
import type { KindDef } from "../types";
import { mBox, metres, pRect, rubberFoot } from "./common";
import { displayWindow, pilotLamp } from "./machine";
import { housing } from "../parts/details";

/** Base plate thickness and the screen's thickness (m). */
const BASE = 0.01;
const SCREEN_T = 0.016;

function layout({ w, d, h }: Size) {
  const split = -w / 2 + w * 0.5;
  const printer = { x0: split + 0.01, x1: w / 2, z0: -d / 2 + 0.03, z1: d / 2, y1: Math.min(0.17, h * 0.5) };
  const screen = { x0: -w / 2, x1: split - 0.01, y0: h * 0.35, z: -d / 2 + 0.06 };
  return { printer, screen };
}

export const labelPrinter: KindDef = {
  kind: "labelPrinter",
  placement: "tableTop",
  plan(s) {
    const m = metres(s.item);
    const { printer, screen } = layout(m);
    pRect(s, "detail", printer.x0, printer.z0, printer.x1, printer.z1);
    pRect(s, "detail", screen.x0 + 0.01, screen.z - SCREEN_T / 2, screen.x1 - 0.01, screen.z + SCREEN_T / 2);
  },
  elevation(f) {
    const m = metres(f.item);
    const { printer, screen } = layout(m);
    mBox(f, "detail", -m.w / 2, m.w / 2, 0, BASE);
    mBox(f, "detail", printer.x0, printer.x1, BASE, printer.y1);
    mBox(f, "detail", screen.x0, screen.x1, screen.y0, m.h, "item-dark");
    mBox(f, "detail", (screen.x0 + screen.x1) / 2 - 0.012, (screen.x0 + screen.x1) / 2 + 0.012, BASE, screen.y0);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const { printer, screen } = layout(s);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rubberFoot(p, sx * (w / 2 - 0.02), sz * (d / 2 - 0.02), 0.01, 0.003);
    p.roundedBox("satin", -w / 2, w / 2, 0.002, BASE, -d / 2, d / 2, 0.004);
    // The printer: its body, the lid's seam, the label slot and the paper's light at the front.
    housing(p, "panel", printer.x0, printer.x1, BASE - 0.002, printer.y1, printer.z0, printer.z1 - 0.008, 0.015);
    p.box("slot", printer.x0 + 0.01, printer.x1 - 0.01, printer.y1 - 0.045, printer.y1 - 0.043, printer.z0 + 0.01, printer.z1 - 0.0085);
    p.plate("slot", printer.x0 + 0.03, printer.x1 - 0.03, printer.y1 - 0.075, printer.y1 - 0.065, printer.z1 - 0.009, printer.z1 - 0.008, 0.005);
    p.plate("panel", printer.x0 + 0.035, printer.x1 - 0.035, printer.y1 - 0.09, printer.y1 - 0.07, printer.z1 - 0.0085, printer.z1, 0.002);
    pilotLamp(p, printer.x1 - 0.03, printer.y1 - 0.025, printer.z1 - 0.008, 0.004);
    // The screen on its stand.
    const cx = (screen.x0 + screen.x1) / 2;
    p.lathe("satin", cx, BASE, screen.z, [
      [0, 0],
      [0.04, 0],
      [0.04, 0.006],
      [0.012, 0.014],
      [0.012, screen.y0 - BASE + 0.02],
      [0, screen.y0 - BASE + 0.02],
    ]);
    const z0 = screen.z - SCREEN_T / 2;
    p.roundedBox("panelDark", screen.x0, screen.x1, screen.y0, h, z0, z0 + SCREEN_T, 0.008);
    displayWindow(p, screen.x0 + 0.008, screen.x1 - 0.008, screen.y0 + 0.008, h - 0.008, z0 + SCREEN_T);
  },
};
