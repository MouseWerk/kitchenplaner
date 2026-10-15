// Cutlery dryer and polisher (Besteckpoliermaschine): wet cutlery is tipped into the hopper on the
// top, runs through a heated, vibrating bed of granulate behind the UV lamp's window and comes
// out of the chute at the front into a basket, dry and polished.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { DOOR, DOOR_RADIUS, GAP, PLINTH } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { buttons, machineFeet } from "./details";
import { housing, ratingPlate } from "../parts/details";

/** The hopper on the top: its depth from the front edge of the top, and its height (m). */
const HOPPER = 0.3;
const HOPPER_H = 0.12;
/** Height of the chute's mouth and of the basket under it above the floor (m), at most. */
const CHUTE = 0.62;
/** The basket under the chute (m): width share, depth, height. */
const BASKET = { share: 0.6, d: 0.18, h: 0.1 };
/** How far the chute and the basket stand out of the housing (m). */
const REACH = 0.2;

/** Heights of a machine `h` high (m): the housing's top, the chute's mouth, the basket's floor. */
function heights(h: number) {
  const top = h - HOPPER_H;
  const chute = Math.min(CHUTE, top * 0.6);
  return { top, chute, basket: chute - BASKET.h - 0.05 };
}

export const cutleryPolisher: KindDef = {
  kind: "cutleryPolisher",
  plan(s) {
    const zh = s.F - REACH * 1000;
    s.rect("detail", s.L + INSET, zh - HOPPER * 1000, s.R - INSET, zh - INSET / 2);
    s.rect("detail", s.L + INSET, zh - HOPPER * 1000 + INSET, s.R - INSET, zh - INSET * 1.5);
    const bw = (s.w * BASKET.share) / 2;
    s.rect("detail", -bw, zh, bw, s.F);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const c = (l + r) / 2;
    const k = heights(f.item.height / 1000);
    const z = (v: number) => z0 + v * 1000;
    f.box("detail", l + I, r - I, z(k.top), top);
    f.box("detail", l + I / 4, r - I / 4, z(k.chute) + I, z(k.top) - I * 3);
    f.box("detail", l + I * 2, r - I * 2, z(k.chute) + I * 3, z(k.top) - I * 5, "glass");
    const bw = (f.w * BASKET.share) / 2;
    f.box("detail", c - bw, c + bw, z(k.basket), z(k.basket + BASKET.h));
    f.box("detail", c - bw - 20, c + bw + 20, z(k.chute) - 20, z(k.chute) + 30);
    f.box("detail", l + I / 4, r - I / 4, z0 + FEET * 0.6, z(k.basket) - I);
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const zBody = zf - REACH;
    const k = heights(s.h);
    machineFeet(p, s.w, s.d, zBody);
    housing(p, "steel", -s.w / 2, s.w / 2, PLINTH, k.top, -s.d / 2, zBody);
    // The hopper on the top: a turned square funnel with rounded corners, open at the top.
    const hw = s.w / 2 - 0.03;
    const hd = HOPPER / 2;
    const hz = zBody - 0.02 - hd;
    p.lathe("steel", 0, k.top - 0.002, hz, [
      [0.02, 0],
      [0.03, 0],
      [0.03 + 0.02, HOPPER_H + 0.002],
      [0.03 + 0.02 - 0.008, HOPPER_H + 0.002],
      [0.022, 0.012],
      [0, 0.012],
    ], { rect: [hw - 0.05, hd - 0.05] });
    // The front: the window of the UV lamp in a dark frame, the buttons, the lower door.
    const zLeaf = zBody + DOOR / 2;
    const w0 = k.chute + 0.06;
    const w1 = k.top - 0.12;
    p.roundedBox("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, w0, k.top - GAP, zBody - 0.002, zLeaf, DOOR_RADIUS, "top", "z");
    if (w1 - w0 > 0.08) p.plate("glassDark", -s.w / 2 + 0.06, s.w / 2 - 0.06, w0 + 0.03, w1, zLeaf - 0.0005, zLeaf + 0.003, 0.02, true);
    buttons(p, -0.08, 0.08, k.top - 0.055, zLeaf, 3);
    p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, PLINTH + GAP, k.basket - 0.03, zBody - 0.002, zLeaf, DOOR_RADIUS, "top", "z");
    p.barHandle("x", -0.1, 0.1, k.basket - 0.08, zLeaf, zLeaf + 0.025);
    ratingPlate(p, s.w / 2 - 0.07, PLINTH + 0.05, zLeaf);
    // The chute out of the front, falling to its mouth over the basket.
    const bw = (s.w * BASKET.share) / 2;
    p.extrude("steel", "x", -bw - 0.02, bw + 0.02, [
      [zBody - 0.01, k.chute + 0.06],
      [zBody - 0.01, k.chute + 0.04],
      [zf - 0.05, k.chute - 0.005],
      [zf - 0.04, k.chute + 0.01],
      [zf - 0.05, k.chute + 0.012],
      [zBody - 0.005, k.chute + 0.06],
    ]);
    // The basket on a bracket under the chute.
    for (const sx of [-1, 1]) p.roundedBox("steelDark", sx * bw - 0.01, sx * bw + 0.01, k.basket - 0.02, k.basket, zBody, zf - 0.01, 0.003);
    p.wireBox(-bw, bw, k.basket, k.basket + BASKET.h, zf - BASKET.d, zf, 0.03);
  },
};
