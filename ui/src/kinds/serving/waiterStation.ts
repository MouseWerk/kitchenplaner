// Waiter station (Servicestation): a counter with cutlery drawers at the left and doors at the
// right, and an open shelf unit on its back for glasses, cups and menus.

import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { BODY_RADIUS, DOOR, DOOR_RADIUS, GAP, PLINTH, plinth, SHEET, TOP, TOP_RADIUS, worktop } from "../parts/mesh";
import { INSET } from "../parts/plan";
import { WORK_HEIGHT } from "../parts/sizes";
import type { KindDef } from "../types";
import { bottle, cup, leafDoors } from "./common";

/** Depth of the shelf unit on the back (mm) and its shelves. */
const HUTCH = 300;
const SHELVES = 2;
/** Drawers in the drawer block; it takes this share of the width. */
const DRAWERS = 4;
const DRAWER_SHARE = 0.4;

/** Height of the counter top above the item's lower edge (mm), at most the unit's height. */
function counterTop(height: number): number {
  return Math.min(WORK_HEIGHT, height - 100);
}

export const waiterStation: KindDef = {
  kind: "waiterStation",
  plan(s) {
    s.rect("hidden", s.L + INSET / 2, s.B, s.R - INSET / 2, s.B + Math.min(HUTCH, s.d - INSET));
    const x = s.L + s.w * DRAWER_SHARE;
    s.line("detail", [x, s.F - INSET], [x, s.F]);
  },
  elevation(f) {
    const { l, r, z0 } = f;
    const I = FRONT_INSET;
    const ct = z0 + counterTop(f.item.height);
    f.box("detail", l, r, ct - FRONT_TOP, ct);
    // Drawers at the left, doors at the right.
    const x = l + f.w * DRAWER_SHARE;
    const dh = (ct - FRONT_TOP - I - (z0 + FEET)) / DRAWERS;
    for (let i = 0; i < DRAWERS; i++) {
      const b = z0 + FEET + i * dh;
      f.box("detail", l + I, x - I / 2, b, b + dh - I / 4);
      f.line("detail", [(l + x) / 2 - I * 2, b + dh - I * 1.2], [(l + x) / 2 + I * 2, b + dh - I * 1.2]);
    }
    f.box("detail", x + I / 2, r - I, z0 + FEET, ct - FRONT_TOP - I);
    // The shelf unit above: sides, shelves and its top.
    f.box("detail", l, l + I / 2, ct, f.top);
    f.box("detail", r - I / 2, r, ct, f.top);
    f.line("detail", [l, f.top - FRONT_TOP], [r, f.top - FRONT_TOP]);
    for (let k = 1; k <= SHELVES; k++) {
      const z = ct + ((f.top - FRONT_TOP - ct) * k) / (SHELVES + 1);
      f.line("detail", [l + I / 2, z], [r - I / 2, z]);
    }
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    const ct = counterTop(item.height) / 1000;
    const zf = d / 2;
    const zBody = zf - DOOR;
    plinth(p, w, d);
    p.roundedBox("steel", -w / 2, w / 2, PLINTH, ct - TOP, -d / 2, zBody, BODY_RADIUS, "vertical");
    p.box("top", -w / 2 + 0.002, w / 2 - 0.002, PLINTH + 0.002, ct - TOP, zBody, zBody + 0.002);
    worktop(p, "steel", -w / 2, w / 2, ct - TOP, ct, -d / 2, zf);
    // Drawer block at the left, one door at the right.
    const x = -w / 2 + w * DRAWER_SHARE;
    const dh = (ct - TOP - PLINTH) / DRAWERS;
    for (let i = 0; i < DRAWERS; i++) {
      const y0 = PLINTH + i * dh;
      p.roundedBox("steel", -w / 2 + GAP, x - GAP, y0 + GAP, y0 + dh - GAP, zBody + 0.002, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
      const len = Math.min(0.2, (x + w / 2) * 0.5);
      p.barHandle("x", (x - w / 2) / 2 - len / 2, (x - w / 2) / 2 + len / 2, y0 + dh - 0.04, zf - DOOR / 2, zf);
    }
    leafDoors(p, x, w / 2, PLINTH, ct - TOP, zBody + 0.002, zf - DOOR / 2, zf, 1);
    // Shelf unit on the back of the top: sides, back, shelves and its top, with cups upside
    // down on the lower shelf and a stack of menus and a water jug on the upper one.
    const hd = Math.min(HUTCH / 1000, d - 0.05);
    const zb = -d / 2;
    const t = SHEET * 2;
    p.roundedBox("steel", -w / 2, -w / 2 + t, ct, h, zb, zb + hd, BODY_RADIUS);
    p.roundedBox("steel", w / 2 - t, w / 2, ct, h, zb, zb + hd, BODY_RADIUS);
    p.box("steelDark", -w / 2 + t, w / 2 - t, ct, h - TOP / 2, zb, zb + SHEET);
    p.roundedBox("steel", -w / 2, w / 2, h - TOP / 2, h, zb, zb + hd, TOP_RADIUS);
    for (let k = 1; k <= SHELVES; k++) {
      const y = ct + ((h - ct) * k) / (SHELVES + 1);
      p.roundedBox("steel", -w / 2 + t - 0.001, w / 2 - t + 0.001, y, y + SHEET * 2, zb + SHEET, zb + hd - 0.01, TOP_RADIUS);
      const ys = y + SHEET * 2;
      if (k === 1) {
        const n = Math.min(8, Math.max(1, Math.floor((w - 0.1) / 0.12)));
        for (let i = 0; i < n; i++) cup(p, -w / 2 + 0.08 + i * 0.12, ys, zb + hd / 2, 0.04, 0.07);
      } else {
        p.roundedBox("wood", -w / 2 + 0.1, -w / 2 + 0.35, ys, ys + 0.05, zb + 0.03, zb + 0.25, 0.004);
        p.lathe("glass", w / 2 - 0.15, ys, zb + hd / 2, [
          [0, 0],
          [0.05, 0],
          [0.055, 0.07],
          [0.045, 0.13],
          [0.05, 0.15],
          [0.044, 0.15],
          [0.04, 0.13],
          [0.049, 0.07],
          [0.044, 0.006],
          [0, 0.006],
        ]);
      }
    }
    // A cruet set (salt and pepper) stands on the top in front of the shelves.
    for (const [i, mat] of (["panel", "panelDark"] as const).entries()) bottle(p, w / 2 - 0.12 + i * 0.05, ct, zb + hd + 0.08, 0.018, 0.13, "glass", mat);
  },
};
