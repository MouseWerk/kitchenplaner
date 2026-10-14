// Chamber vacuum packer (Vakuumiergerät): a stainless body with the control panel at the front
// and a clear domed lid over the chamber with the seal bar inside. The table size stands on a
// work table (`tableTop`), the floor size on castors.

import type { Front } from "../parts/elevation";
import type { Parts, Size } from "../parts/mesh";
import type { PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, machineFeet, MACHINE_FOOT, mBox, metres, pRect, tableCastor } from "./common";

/** Where the parts lie (m): a flat lid on the table size, a deeper one on the floor size. */
function layout({ d, h }: Size, floor: boolean) {
  const bottom = floor ? CASTOR : MACHINE_FOOT;
  const lidY = h - (floor ? 0.16 : h * 0.3);
  const panel = { y0: floor ? lidY - 0.22 : bottom + (lidY - bottom) * 0.15, y1: lidY - 0.025 };
  const seal = d / 2 - 0.12;
  return { bottom, lidY, panel, seal };
}

function plan(s: PlanSketch, floor: boolean) {
  const m = metres(s.item);
  const { seal } = layout(m, floor);
  pRect(s, "detail", -m.w / 2 + 0.03, -m.d / 2 + 0.03, m.w / 2 - 0.03, m.d / 2 - 0.05);
  pRect(s, "detail", -m.w / 2 + 0.06, seal - 0.006, m.w / 2 - 0.06, seal + 0.006);
}

function elevation(f: Front, floor: boolean) {
  const m = metres(f.item);
  const { bottom, lidY, panel } = layout(m, floor);
  mBox(f, "detail", -m.w / 2, m.w / 2, bottom, lidY);
  mBox(f, "detail", -m.w * 0.42, m.w * 0.42, panel.y0, panel.y1, "item-dark");
  mBox(f, "detail", -m.w * 0.3, -m.w * 0.05, panel.y0 + (panel.y1 - panel.y0) * 0.3, panel.y1 - (panel.y1 - panel.y0) * 0.2);
  mBox(f, "detail", -m.w / 2 + 0.03, m.w / 2 - 0.03, lidY + 0.015, m.h - 0.01, "glass");
  mBox(f, "detail", -m.w * 0.25, m.w * 0.25, m.h - 0.015, m.h);
}

function mesh(p: Parts, s: Size, floor: boolean) {
  const { w, d, h } = s;
  const { bottom, lidY, panel, seal } = layout(s, floor);
  const front = d / 2 - 0.02;
  if (floor) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tableCastor(p, sx * (w / 2 - 0.06), sz * (d / 2 - 0.08));
  } else machineFeet(p, -w / 2, w / 2, -d / 2, front);
  p.box("steel", -w / 2, w / 2, bottom, lidY, -d / 2, front);
  // Control panel with the display and buttons; the display ends flush with the front.
  p.box("panelDark", -w * 0.42, w * 0.42, panel.y0, panel.y1, front, d / 2 - 0.004);
  const ph = panel.y1 - panel.y0;
  p.box("glassDark", -w * 0.3, -w * 0.05, panel.y0 + ph * 0.3, panel.y1 - ph * 0.2, d / 2 - 0.004, d / 2);
  for (const x of [w * 0.1, w * 0.2, w * 0.3]) p.box("knob", x - 0.015, x + 0.015, panel.y0 + ph * 0.4, panel.y0 + ph * 0.6, d / 2 - 0.004, d / 2 - 0.001);
  if (floor) {
    // Ventilation louvres of the pump compartment.
    for (let i = 0; i < 4; i++) {
      const y = bottom + 0.08 + i * 0.04;
      p.box("steelDark", -w * 0.3, w * 0.3, y, y + 0.012, front, front + 0.004);
    }
  }
  // Chamber floor and the seal bar seen through the lid.
  p.box("steelDark", -w / 2 + 0.04, w / 2 - 0.04, lidY, lidY + 0.004, -d / 2 + 0.04, d / 2 - 0.06);
  p.box("handle", -w / 2 + 0.06, w / 2 - 0.06, lidY, lidY + 0.014, seal - 0.006, seal + 0.006);
  // Lid: dark gasket frame, the clear dome and the handle at the front.
  p.box("rubber", -w / 2 + 0.02, w / 2 - 0.02, lidY, lidY + 0.015, -d / 2 + 0.02, d / 2 - 0.04);
  p.box("glass", -w / 2 + 0.03, w / 2 - 0.03, lidY + 0.015, h - 0.01, -d / 2 + 0.03, d / 2 - 0.05);
  p.box("steel", -w / 2 + 0.03, w / 2 - 0.03, h - 0.01, h, -d / 2 + 0.03, -d / 2 + 0.06);
  p.box("handle", -w * 0.25, w * 0.25, h - 0.015, h, d / 2 - 0.08, d / 2 - 0.05);
}

export const vacuumTable: KindDef = {
  kind: "vacuumTable",
  placement: "tableTop",
  plan: (s) => plan(s, false),
  elevation: (f) => elevation(f, false),
  mesh: (p, s) => mesh(p, s, false),
};

export const vacuumFloor: KindDef = {
  kind: "vacuumFloor",
  plan: (s) => plan(s, true),
  elevation: (f) => elevation(f, true),
  mesh: (p, s) => mesh(p, s, true),
};
