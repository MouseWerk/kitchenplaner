// Eye wash and first aid station (Augenspül- und Erste-Hilfe-Station): a wall plate with a small
// round basin, two eye wash heads standing in it that a push flag beside the basin opens, the
// trap under the basin and the first aid cabinet above it.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, DOOR_RADIUS, roundBowl, SHEET, TOP_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain } from "./common";
import { bottleTrap } from "./details";

/** Wall plate (m). */
const PLATE = 0.02;
/** The basin: deck height, depth of the bowl and the bowl's radius as a share of the deck (m). */
const DECK = 0.3;
const BOWL_DEPTH = 0.09;
const BOWL_SHARE = 0.32;
/** Eye wash heads: distance apart and height above the bowl's floor (m). */
const HEADS = 0.1;
const HEAD_H = 0.13;
/** The first aid cabinet (m): height and depth, its lower edge above the deck. */
const CABINET = { h: 0.24, d: 0.12, gap: 0.12 };

/** Deck, bowl floor and the first aid cabinet's extent of a unit `h` high (m). */
function layout(h: number) {
  const deck = Math.min(DECK, h * 0.45);
  const floor = deck - BOWL_DEPTH;
  const cab1 = h;
  const cab0 = Math.max(deck + 0.06, Math.min(deck + CABINET.gap, cab1 - CABINET.h));
  return { deck, floor, cab0, cab1 };
}

export const eyeWashStation: KindDef = {
  kind: "eyeWashStation",
  placement: "overhead",
  plan(s) {
    const r = Math.min(s.w, s.d) * BOWL_SHARE;
    const cz = PLATE * 500;
    s.circle("detail", 0, cz, r);
    for (const sx of [-1, 1]) s.circle("detail", (sx * HEADS * 1000) / 2, cz, INSET / 3);
    s.line("detail", [s.L, s.B + PLATE * 1000], [s.R, s.B + PLATE * 1000]);
    s.rect("hidden", s.L + INSET / 2, s.B + PLATE * 1000, s.R - INSET / 2, s.B + (PLATE + CABINET.d) * 1000);
  },
  elevation(f) {
    const { l, r, z0 } = f;
    const I = FRONT_INSET;
    const c = (l + r) / 2;
    const k = layout(f.item.height / 1000);
    const z = (v: number) => z0 + v * 1000;
    const br = Math.min(f.w, f.item.depth) * BOWL_SHARE;
    f.box("detail", l, r, z(k.deck) - 40, z(k.deck));
    f.box("hidden", c - br, c + br, z(k.floor), z(k.deck) - 40);
    for (const sx of [-1, 1]) f.box("detail", c + (sx * HEADS * 1000) / 2 - 15, c + (sx * HEADS * 1000) / 2 + 15, z(k.deck), z(k.floor + HEAD_H));
    f.box("detail", c - 22, c + 22, z0, z(k.floor));
    // The first aid cabinet with its door and handle.
    f.box("detail", l + I / 2, r - I / 2, z(k.cab0), z(k.cab1) - I / 4);
    f.line("detail", [r - I * 1.5, z(k.cab0) + I * 1.5], [r - I * 1.5, z(k.cab1) - I * 1.5]);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    const k = layout(s.h);
    const r = Math.min(s.w, s.d) * BOWL_SHARE;
    const cz = PLATE / 2;
    p.roundedBox("steel", -s.w / 2, s.w / 2, 0, s.h, zb, zb + PLATE, BODY_RADIUS, "top", "z");
    // The deck with the round bowl and its apron, the trap under it.
    roundBowl(p, "steel", s.w, zb + PLATE, zf - SHEET, cz, r, k.deck, k.floor, 0.015);
    p.roundedBox("steel", -s.w / 2, s.w / 2, k.deck - 0.04, k.deck, zf - SHEET, zf, TOP_RADIUS, "top");
    bowlDrain(p, 0, cz, k.floor, zb, false);
    bottleTrap(p, 0, cz, 0, k.floor, zb + PLATE);
    // The two eye wash heads on their riser, each with a turned spray cap under a dust cover.
    for (const sx of [-1, 1]) {
      const x = (sx * HEADS) / 2;
      p.lathe("handle", x, k.floor + 0.005, cz, [
        [0, 0],
        [0.009, 0],
        [0.009, HEAD_H - 0.03],
        [0.02, HEAD_H - 0.018],
        [0.024, HEAD_H - 0.008],
        [0, HEAD_H - 0.008],
      ]);
      p.lathe("knob", x, k.floor + 0.005 + HEAD_H - 0.008, cz, [
        [0, 0],
        [0.026, 0],
        [0.026, 0.004],
        [0.016, 0.008],
        [0, 0.008],
      ]);
    }
    // The push flag at the side of the deck that opens the water.
    const fx = s.w / 2 - 0.05;
    p.lathe("satin", fx, k.deck, zf - 0.06, [
      [0, 0],
      [0.012, 0],
      [0.012, 0.03],
      [0, 0.03],
    ]);
    p.roundedBox("handle", fx - 0.035, fx + 0.035, k.deck + 0.02, k.deck + 0.03, zf - 0.11, zf - 0.02, 0.004);
    // The first aid cabinet: a white body with its door and a bar handle.
    const zc = zb + PLATE + CABINET.d;
    p.roundedBox("panel", -s.w / 2 + 0.02, s.w / 2 - 0.02, k.cab0, k.cab1 - 0.005, zb + PLATE, zc - 0.012, 0.01);
    p.roundedBox("panel", -s.w / 2 + 0.024, s.w / 2 - 0.024, k.cab0 + 0.004, k.cab1 - 0.009, zc - 0.012, zc, DOOR_RADIUS * 2, "top", "z");
    const hy = (k.cab0 + k.cab1) / 2;
    p.barHandle("y", hy - 0.05, hy + 0.05, s.w / 2 - 0.06, zc, zc + 0.02);
  },
};
