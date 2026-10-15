// Granulate pot washer (Granulat-Topfspülmaschine): a tall pressed machine that blasts pots, pans
// and GN containers with plastic granules and water. The loading door slides up in guides at its
// sides (a window in it, the grip along its lower edge), the granulate drawer sits in the lower
// panel, the control panel above the door and the vapour outlet on the top. In the plan the
// basket's turntable is drawn hidden inside.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { DOOR, DOOR_RADIUS, GAP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { machineFeet, machinePanel } from "./details";
import { housing, ratingPlate } from "../parts/details";

/** Heights of the door's sill and top and of the panel above it, at most (m). */
const SILL = 0.82;
const PANEL = 0.13;
/** How far the door's guides and grip stand out of the housing (m). */
const REACH = 0.045;
/** Corner radius of the window and the width of its seal (m). */
const WINDOW_RADIUS = 0.03;
const SEAL = 0.006;
/** Height of the vapour outlet stub on the top (m). */
const STUB = 0.05;

/** Sill, door top and panel top of a machine `h` high (m). */
function heights(h: number) {
  const panelTop = h - STUB - 0.06;
  const doorTop = panelTop - PANEL;
  return { sill: Math.min(SILL, doorTop * 0.48), doorTop, panelTop };
}

export const granulateWasher: KindDef = {
  kind: "granulateWasher",
  plan(s) {
    const r = Math.min(s.w, s.d) * 0.36;
    s.circle("hidden", 0, -INSET, r);
    s.line("detail", [s.L + INSET, s.F - REACH * 1000], [s.R - INSET, s.F - REACH * 1000]);
    s.circle("detail", s.L + s.w * 0.3, s.B + s.d * 0.3, INSET * 1.2);
  },
  elevation(f) {
    const { l, r, z0 } = f;
    const I = FRONT_INSET;
    const k = heights(f.item.height / 1000);
    const z = (v: number) => z0 + v * 1000;
    f.box("detail", l + I / 4, r - I / 4, z0 + FEET * 0.7, z(k.sill) - I / 4);
    f.box("detail", (l + r) / 2 - f.w * 0.25, (l + r) / 2 + f.w * 0.25, z(k.sill) - I * 4, z(k.sill) - I * 2);
    f.box("detail", l + I / 2, r - I / 2, z(k.sill), z(k.doorTop));
    f.box("detail", l + I * 3, r - I * 3, z(k.sill) + I * 3, z(k.doorTop) - I * 2, "glass");
    f.line("detail", [l + I * 2, z(k.sill) + I], [r - I * 2, z(k.sill) + I]);
    f.box("detail", l + I / 4, r - I / 4, z(k.doorTop) + I / 4, z(k.panelTop), "item-dark");
    f.box("detail", l + I, l + I * 5, z(k.doorTop) + I, z(k.panelTop) - I);
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const zBody = zf - REACH;
    const zLeaf = zBody + DOOR / 2;
    const k = heights(s.h);
    machineFeet(p, s.w, s.d, zBody);
    housing(p, "steel", -s.w / 2, s.w / 2, 0.1, s.h - STUB, -s.d / 2, zBody);
    // The lower panel with the granulate drawer and the rating plate.
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, 0.1 + GAP, k.sill - 0.03, zBody - 0.002, zLeaf, DOOR_RADIUS, "top", "z");
    const dw = s.w * 0.5;
    const dy1 = k.sill - 0.08;
    const dy0 = dy1 - 0.16;
    p.plate("slot", -dw / 2 - 0.003, dw / 2 + 0.003, dy0 - 0.003, dy1 + 0.003, zLeaf - 0.0005, zLeaf + 0.0005, 0.006);
    p.roundedBox("steel", -dw / 2, dw / 2, dy0, dy1, zLeaf - 0.004, zLeaf + 0.008, DOOR_RADIUS * 2, "top", "z");
    p.barHandle("x", -dw * 0.3, dw * 0.3, dy1 - 0.035, zLeaf + 0.008, zLeaf + 0.03);
    ratingPlate(p, s.w / 2 - 0.08, 0.17, zLeaf);
    // The sliding door between its guides, a window in a seal, the grip along its lower edge.
    for (const sx of [-1, 1]) {
      const x = sx * (s.w / 2 - 0.015);
      p.roundedBox("steelDark", x - 0.015, x + 0.015, k.sill - 0.03, k.doorTop, zBody - 0.002, zf - 0.015, 0.004, "top", "z");
    }
    const a = -s.w / 2 + 0.035;
    const b = s.w / 2 - 0.035;
    p.roundedBox("steel", a, b, k.sill, k.doorTop - GAP, zBody, zf - 0.02, DOOR_RADIUS * 2, "top", "z");
    const wx = (b - a) / 2 - 0.08;
    const wy0 = k.sill + 0.12;
    const wy1 = k.doorTop - 0.08;
    if (wy1 - wy0 > 0.1 && wx > 0.05) {
      p.plate("rubber", -wx - SEAL, wx + SEAL, wy0 - SEAL, wy1 + SEAL, zf - 0.0205, zf - 0.0185, WINDOW_RADIUS + SEAL);
      p.plate("glassDark", -wx, wx, wy0, wy1, zf - 0.02, zf - 0.017, WINDOW_RADIUS, true);
    }
    p.barHandle("x", a + 0.06, b - 0.06, k.sill + 0.05, zf - 0.02, zf);
    // The control panel above the door, the vapour outlet on the top.
    machinePanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, k.doorTop + GAP, k.panelTop, zBody - 0.002, zLeaf, 4);
    const vx = -s.w / 2 + s.w * 0.3;
    const vz = -s.d / 2 + s.d * 0.3;
    p.lathe("steel", vx, s.h - STUB - 0.002, vz, [
      [0, 0],
      [0.08, 0],
      [0.08, 0.006],
      [0.06, 0.012],
      [0.06, STUB - 0.004],
      [0.066, STUB - 0.004],
      [0.066, STUB + 0.002],
      [0.052, STUB + 0.002],
      [0.052, STUB - 0.01],
      [0, STUB - 0.01],
    ]);
  },
};
