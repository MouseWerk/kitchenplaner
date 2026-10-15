// Proofer (Gärschrank), a floor unit: a tall insulated stainless cabinet on feet with a glazed
// door hinged at the left, the control panel above the door, and inside the tray rails with
// trays of loaves seen through the glass; the steam generator needs water and a drain.

import { frontDoorSwing } from "../parts/plan";
import { BODY_RADIUS, type Parts } from "../parts/mesh";
import type { KindDef } from "../types";
import { foot } from "./common";
import { controlPanel, displayWindow, pilotLamp, pushButton } from "./machine";

/** Feet, wall thickness of the shell and height of the control panel above the door (mm). */
const FEET_MM = 100;
const WALL = 0.05;
const PANEL_MM = 160;
/** The door's frame round its glass and the tray pitch inside (m). */
const FRAME = 0.07;
const TRAY_PITCH = 0.075;
/** Thickness of the door's leaf and the room in front of it for the handle (m). */
const LEAF = 0.03;
const HANDLE_ROOM = 0.025;

/**
 * A glazed door from x0 to x1 and y0 to y1 (m), its leaf from z0 to its face at `zf` and the
 * handle out to `zFront`, hinged at the left: a steel frame with the glass on a gasket behind it.
 */
function glassDoor(p: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, zf: number, zFront: number): void {
  p.extrude(
    "steel",
    "z",
    z0,
    zf,
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    [
      [
        [x0 + FRAME, y0 + FRAME],
        [x1 - FRAME, y0 + FRAME],
        [x1 - FRAME, y1 - FRAME * 1.4],
        [x0 + FRAME, y1 - FRAME * 1.4],
      ],
    ],
  );
  // The gasket is a band round the pane's edge (a ring turned round the window's rectangle), so
  // the lit chamber shows through the glass.
  const wy1 = y1 - FRAME * 1.4;
  p.lathe("rubber", (x0 + x1) / 2, (y0 + FRAME + wy1) / 2, z0 + 0.004, [
    [0, 0],
    [0.01, 0],
    [0.01, 0.004],
    [0, 0.004],
    [0, 0],
  ], { axis: "z", rect: [(x1 - x0) / 2 - FRAME - 0.004, (wy1 - y0 - FRAME) / 2 - 0.004] });
  p.plate("glass", x0 + FRAME - 0.004, x1 - FRAME + 0.004, y0 + FRAME - 0.004, y1 - FRAME * 1.4 + 0.004, z0 + 0.008, z0 + 0.012, 0.006);
  // Hinges at the left, the handle bar at the right.
  for (const y of [y0 + 0.15, y1 - 0.2]) {
    p.lathe("satin", x0 + 0.008, y, zf - 0.006, [
      [0, 0],
      [0.008, 0],
      [0.008, 0.08],
      [0, 0.08],
    ]);
  }
  const ym = (y0 + y1) / 2;
  p.barHandle("y", ym - 0.3, ym + 0.3, x1 - FRAME / 2, zf, zFront);
}

export const proofer: KindDef = {
  kind: "proofer",
  plan(s) {
    frontDoorSwing(s, s.w);
  },
  elevation(f) {
    const z0 = f.z0 + FEET_MM;
    const z1 = f.top - PANEL_MM;
    f.box("detail", f.l + 10, f.r - 10, z0 + 10, z1 - 10);
    f.box("detail", f.l + FRAME * 1000, f.r - FRAME * 1000, z0 + FRAME * 1000, z1 - FRAME * 1400, "glass");
    f.box("detail", f.l + 10, f.r - 10, z1, f.top - 10, "item-dark");
    for (const x of [f.l + 50, f.r - 50]) f.box("detail", x - 13, x + 13, f.z0, z0);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const feet = FEET_MM / 1000;
    const doorTop = h - PANEL_MM / 1000;
    // The shell's front; the door's leaf in front of it, its handle out to the front.
    const zf = d / 2 - LEAF - HANDLE_ROOM;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.06), sz * (d / 2 - 0.08), feet);
    // The shell: back, sides, top and bottom round the lit chamber.
    const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => p.roundedBox("steel", x0, x1, y0, y1, z0, z1, BODY_RADIUS);
    box(-w / 2, w / 2, feet, h, -d / 2, -d / 2 + WALL);
    for (const sx of [-1, 1]) box(sx > 0 ? w / 2 - WALL : -w / 2, sx > 0 ? w / 2 : -w / 2 + WALL, feet, h, -d / 2 + WALL - 0.002, zf);
    box(-w / 2 + WALL - 0.002, w / 2 - WALL + 0.002, doorTop, h, -d / 2 + WALL - 0.002, zf);
    box(-w / 2 + WALL - 0.002, w / 2 - WALL + 0.002, feet, feet + WALL, -d / 2 + WALL - 0.002, zf);
    // The chamber is lined white and lit: through the glass door it reads as a bright cabinet
    // with the trays in it, not as a dark box.
    p.box("panel", -w / 2 + WALL, w / 2 - WALL, feet + WALL, doorTop, -d / 2 + WALL, -d / 2 + WALL + 0.002);
    for (const sx of [-1, 1]) p.box("panel", sx > 0 ? w / 2 - WALL - 0.002 : -w / 2 + WALL, sx > 0 ? w / 2 - WALL : -w / 2 + WALL + 0.002, feet + WALL, doorTop, -d / 2 + WALL + 0.002, zf - 0.004);
    p.box("panel", -w / 2 + WALL + 0.002, w / 2 - WALL - 0.002, doorTop - 0.002, doorTop, -d / 2 + WALL + 0.002, zf - 0.004);
    // Tray rails on both side walls and the baking trays on them.
    const y0 = feet + WALL + 0.08;
    const n = Math.max(1, Math.floor((doorTop - 0.06 - y0) / TRAY_PITCH));
    for (let i = 0; i < n; i++) {
      const y = y0 + i * TRAY_PITCH;
      for (const sx of [-1, 1]) p.box("steelDark", sx * (w / 2 - WALL - 0.012) - 0.012, sx * (w / 2 - WALL - 0.012) + 0.012, y - 0.008, y, -d / 2 + WALL + 0.02, zf - 0.04);
      if (i % 2 !== 0) continue;
      // Every other level holds a tray with three loaves proving on it.
      const x0 = -w / 2 + WALL + 0.02;
      const x1 = w / 2 - WALL - 0.02;
      const z0 = -d / 2 + WALL + 0.04;
      const z1 = zf - 0.06;
      p.roundedBox("satin", x0, x1, y, y + 0.006, z0, z1, 0.003);
      const lw = (x1 - x0) / 3;
      for (let k = 0; k < 3; k++) p.roundedBox("foodCream", x0 + lw * k + 0.03, x0 + lw * (k + 1) - 0.03, y + 0.006, y + 0.006 + Math.min(0.05, TRAY_PITCH * 1.4), z0 + 0.05, z1 - 0.05, 0.012);
    }
    // The control panel above the door.
    const face = controlPanel(p, -w / 2 + 0.03, w / 2 - 0.03, doorTop + 0.025, h - 0.025, zf);
    const yc = (doorTop + h) / 2;
    displayWindow(p, -w * 0.3, -w * 0.02, yc - 0.03, yc + 0.03, face);
    p.knob(w * 0.12, yc, face, d / 2, 0.026);
    pushButton(p, w * 0.27, yc, face, 0.012, "panel", d / 2 - face);
    pilotLamp(p, w * 0.36, yc, face);
    glassDoor(p, -w / 2 + 0.004, w / 2 - 0.004, feet + 0.004, doorTop - 0.004, zf, zf + LEAF, d / 2);
  },
};
