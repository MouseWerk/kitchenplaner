// Checkout (Kassenmodul): a counter module at the end of a serving line with the till screen,
// receipt printer and card terminal on the top, the cash drawer under it on the cashier's side
// (the front) and a closed panel towards the guests (the back).

import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, doors, GAP, PLINTH, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody } from "./common";

/** Height of the till screen over the top (mm). */
const SCREEN_RISE = 400;
/** Till screen and its stand (m), cash drawer height (m). */
const SCREEN = { w: 0.38, h: 0.26, t: 0.03 };
const DRAWER = 0.12;

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
    counterBody(p, s);
    const yt = s.h - TOP;
    const zf = s.d / 2;
    // Cash drawer under the top, two doors below.
    p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, yt - DRAWER, yt - GAP, zf - DOOR, zf - DOOR / 2);
    p.barHandle("x", -0.12, 0.12, yt - DRAWER / 2, zf - DOOR / 2, zf);
    doors(p, -s.w / 2, s.w / 2, PLINTH, yt - DRAWER, s.d, 2, "vertical");
    // Till screen on a stand, facing the cashier.
    const rise = SCREEN_RISE / 1000;
    p.box("steelDark", -0.08, 0.08, s.h, s.h + 0.01, -0.12, 0.04);
    p.box("steelDark", -0.025, 0.025, s.h, s.h + rise - SCREEN.h, -0.05, -0.02);
    p.box("knob", -SCREEN.w / 2, SCREEN.w / 2, s.h + rise - SCREEN.h, s.h + rise, -0.05, -0.05 + SCREEN.t);
    p.box("glassDark", -SCREEN.w / 2 + 0.012, SCREEN.w / 2 - 0.012, s.h + rise - SCREEN.h + 0.012, s.h + rise - 0.012, -0.05 + SCREEN.t, -0.05 + SCREEN.t + 0.002);
    // Receipt printer at the right, card terminal at the left.
    const px = SCREEN.w / 2 + INSET / 1000;
    p.box("panelDark", px, px + 0.15, s.h, s.h + 0.13, -0.06, 0.1);
    p.box("panel", px + 0.03, px + 0.12, s.h + 0.13, s.h + 0.132, 0.02, 0.06);
    const tx = -SCREEN.w / 2 - INSET / 1000;
    p.box("knob", tx - 0.09, tx, s.h, s.h + 0.05, 0.04, 0.2);
    p.box("glassDark", tx - 0.075, tx - 0.015, s.h + 0.05, s.h + 0.052, 0.13, 0.19);
  },
};
