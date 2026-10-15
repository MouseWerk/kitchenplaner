// Checkout (Kassenmodul): a counter module at the end of a serving line with the till screen,
// receipt printer and card terminal on the top, the cash drawer under it on the cashier's side
// (the front) and a closed panel towards the guests (the back).

import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, DOOR_RADIUS, GAP, PLINTH, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, leafDoors } from "./common";

/** Height of the till screen over the top (mm). */
const SCREEN_RISE = 400;
/** Till screen and its stand (m), cash drawer height (m). */
const SCREEN = { w: 0.38, h: 0.26, t: 0.03 };
const DRAWER = 0.12;
/** How far the screen leans back (rad). */
const TILT = 0.26;

export const cashDesk: KindDef = {
  kind: "cashDesk",
  rise: SCREEN_RISE,
  plan(s) {
    // Screen on its foot, printer and card terminal beside it, the drawer at the front.
    s.rect("detail", -SCREEN.w * 500, -INSET, SCREEN.w * 500, 0);
    s.rect("detail", -80, -120, 80, 40);
    s.rect("detail", SCREEN.w * 500 + INSET, -60, SCREEN.w * 500 + INSET + 150, 100);
    s.rect("detail", -SCREEN.w * 500 - INSET - 90, 40, -SCREEN.w * 500 - INSET, 200);
    s.line("detail", [s.L + INSET, s.F - INSET / 2], [s.R - INSET, s.F - INSET / 2]);
  },
  elevation(f) {
    const { l, r, top } = f;
    const I = FRONT_INSET;
    const cx = (l + r) / 2;
    f.worktop();
    f.box("detail", l + I, r - I, top - FRONT_TOP - DRAWER * 1000, top - FRONT_TOP - I / 4);
    f.line("detail", [cx - I * 2, top - FRONT_TOP - I], [cx + I * 2, top - FRONT_TOP - I]);
    f.doors(2, f.z0 + FEET, top - FRONT_TOP - DRAWER * 1000 - I / 2);
    // The screen on its stand.
    const sw = SCREEN.w * 500;
    f.box("detail", cx - 30, cx + 30, top, top + SCREEN_RISE - SCREEN.h * 1000);
    f.box("detail", cx - sw, cx + sw, top + SCREEN_RISE - SCREEN.h * 1000, top + SCREEN_RISE, "item-dark");
  },
  mesh(p, s) {
    const zBody = s.d / 2 - DOOR;
    counterBody(p, s, [], "steel", zBody);
    const yt = s.h - TOP;
    const zf = s.d / 2;
    // Cash drawer with its lock under the top, two doors below.
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, yt - DRAWER, yt - GAP, zBody, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
    p.barHandle("x", -0.12, 0.12, yt - DRAWER / 2, zf - DOOR / 2, zf);
    p.lathe("satin", s.w / 2 - 0.08, yt - DRAWER / 2, zf - DOOR / 2, [[0, 0], [0.008, 0], [0.008, 0.004], [0, 0.005]], { axis: "z" });
    p.box("slot", s.w / 2 - 0.0805, s.w / 2 - 0.0795, yt - DRAWER / 2 - 0.004, yt - DRAWER / 2 + 0.004, zf - DOOR / 2 + 0.004, zf - DOOR / 2 + 0.0052);
    leafDoors(p, -s.w / 2, s.w / 2, PLINTH, yt - DRAWER, zBody, zf - DOOR / 2, zf, 2);
    // Till screen on a turned stand, tilted towards the cashier.
    const rise = SCREEN_RISE / 1000;
    p.lathe("knob", 0, s.h, -0.04, [
      [0, 0],
      [0.09, 0],
      [0.09, 0.006],
      [0.07, 0.012],
      [0, 0.012],
    ]);
    p.tube(
      "steelDark",
      [
        { x: 0, y: s.h + 0.01, z: -0.04 },
        { x: 0, y: s.h + rise - SCREEN.h / 2, z: -0.04 },
      ],
      0.018,
    );
    const screen = p.roundedBox("knob", -SCREEN.w / 2, SCREEN.w / 2, -SCREEN.h / 2, SCREEN.h / 2, -SCREEN.t, 0, 0.01, "vertical", "z");
    const glass = p.plate("glassDark", -SCREEN.w / 2 + 0.012, SCREEN.w / 2 - 0.012, -SCREEN.h / 2 + 0.012, SCREEN.h / 2 - 0.012, 0, 0.002, 0.004);
    for (const m of [screen, glass]) {
      // Tilted back by 15 degrees round its middle, the stand's top.
      const { y, z } = m.position;
      m.position.y = y * Math.cos(TILT) + z * Math.sin(TILT) + s.h + rise - SCREEN.h / 2 - 0.004;
      m.position.z = -y * Math.sin(TILT) + z * Math.cos(TILT) - 0.04 + 0.03;
      m.rotation.x -= TILT;
    }
    // Receipt printer at the right with its paper slot, card terminal at the left.
    const px = SCREEN.w / 2 + INSET / 1000;
    p.roundedBox("panelDark", px, px + 0.15, s.h, s.h + 0.13, -0.06, 0.1, 0.02);
    p.roundedBox("slot", px + 0.025, px + 0.125, s.h + 0.13, s.h + 0.1305, 0.02, 0.026, 0.002, "vertical");
    p.roundedBox("panel", px + 0.03, px + 0.12, s.h + 0.128, s.h + 0.134, 0.026, 0.06, 0.002, "top");
    const tx = -SCREEN.w / 2 - INSET / 1000;
    p.roundedBox("knob", tx - 0.09, tx, s.h, s.h + 0.04, 0.04, 0.2, 0.012);
    p.roundedBox("glassDark", tx - 0.075, tx - 0.015, s.h + 0.04, s.h + 0.041, 0.13, 0.19, 0.004, "vertical");
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) p.roundedBox("satin", tx - 0.07 + c * 0.02, tx - 0.058 + c * 0.02, s.h + 0.04, s.h + 0.043, 0.055 + r * 0.02, 0.067 + r * 0.02, 0.002);
  },
};
