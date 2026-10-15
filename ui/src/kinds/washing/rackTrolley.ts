// Rack and tray trolley (Korb- und Tablettwagen): an open frame on four castors with runners on
// both sides at every level, for dish racks and GN trays between the dish line and the stores.

import { INSET as FRONT_INSET, LEG as FRONT_LEG } from "../parts/elevation";
import { LEG } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";

/** Levels of runners, from this height above the floor to this distance below the top (m). */
const LEVELS = 7;
const FIRST = 0.3;
const LAST = 0.12;
/** Castor: wheel radius and the height of its fork and the base frame above it (m). */
const WHEEL = 0.05;
const BASE = 0.14;
/** Racks loaded on the lowest levels, shown in 3D (m): size and height. */
const RACK = 0.5;
const RACK_H = 0.1;
const LOADED = 2;
/** Wire distance of a dish rack as drawn (m). */
const RACK_PITCH = 0.04;
/** How far a runner reaches into the trolley from its post (m). */
const RUNNER = 0.02;

/** Heights of the runner levels (m). */
function levels(h: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < LEVELS; i++) out.push(FIRST + ((h - LAST - FIRST) * i) / (LEVELS - 1));
  return out;
}

export const rackTrolley: KindDef = {
  kind: "rackTrolley",
  plan(s) {
    const c = INSET * 0.8;
    for (const x of [s.L + c, s.R - c]) for (const y of [s.B + c, s.F - c]) s.circle("detail", x, y, INSET / 2);
    for (const x of [s.L + LEG * 1000 + 10, s.R - LEG * 1000 - 10]) s.line("detail", [x, s.B + LEG * 1000], [x, s.F - LEG * 1000]);
    const r = Math.min(RACK * 1000, s.w - 2 * LEG * 1000 - 40, s.d - 2 * LEG * 1000) / 2;
    s.rect("hidden", -r, -r, r, r);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    f.box("detail", l, l + FRONT_LEG, z0 + BASE * 1000, top);
    f.box("detail", r - FRONT_LEG, r, z0 + BASE * 1000, top);
    f.box("detail", l, r, z0 + BASE * 1000, z0 + BASE * 1000 + I);
    f.box("detail", l, r, top - I, top);
    for (const y of levels(f.item.height / 1000)) f.line("detail", [l + FRONT_LEG, z0 + y * 1000], [r - FRONT_LEG, z0 + y * 1000]);
    for (const x of [l + WHEEL * 1000, r - WHEEL * 1000]) f.circle("detail", x, z0 + WHEEL * 1000, WHEEL * 1000);
  },
  mesh(p, s) {
    const x0 = -s.w / 2;
    const x1 = s.w / 2;
    const z0 = -s.d / 2;
    const z1 = s.d / 2;
    // Castors under the corners: a fork and a wheel.
    for (const x of [x0 + WHEEL, x1 - WHEEL]) {
      for (const z of [z0 + LEG, z1 - LEG]) {
        p.box("handle", x - 0.025, x + 0.025, WHEEL, BASE - 0.03, z - 0.02, z + 0.02);
        p.rod("rubber", "z", x, WHEEL, z, 0.03, WHEEL);
      }
    }
    // Base frame, corner posts and top frame.
    p.box("steel", x0, x1, BASE - 0.03, BASE, z0, z0 + LEG);
    p.box("steel", x0, x1, BASE - 0.03, BASE, z1 - LEG, z1);
    p.box("steel", x0, x0 + LEG, BASE - 0.03, BASE, z0 + LEG, z1 - LEG);
    p.box("steel", x1 - LEG, x1, BASE - 0.03, BASE, z0 + LEG, z1 - LEG);
    for (const x of [x0, x1 - LEG]) for (const z of [z0, z1 - LEG]) p.box("steel", x, x + LEG, BASE, s.h, z, z + LEG);
    p.box("steel", x0, x1, s.h - 0.03, s.h, z0, z0 + LEG);
    p.box("steel", x0, x1, s.h - 0.03, s.h, z1 - LEG, z1);
    // Push bar along the back, between the posts.
    p.rod("handle", "x", 0, s.h - 0.15, z0 + LEG / 2, s.w - 2 * LEG, 0.014);
    // Side rails that carry the runners, and the runners at every level.
    for (const [a, b] of [
      [x0 + LEG / 2, x0 + LEG + RUNNER],
      [x1 - LEG - RUNNER, x1 - LEG / 2],
    ]) {
      for (const y of levels(s.h)) p.box("steelDark", a, b, y - 0.004, y + 0.004, z0 + LEG, z1 - LEG);
    }
    // Dish racks on the lowest levels.
    const rack = Math.min(RACK, s.w - 2 * LEG - 0.02, s.d - 2 * LEG);
    for (const y of levels(s.h).slice(0, LOADED)) p.wireBox(-rack / 2, rack / 2, y + 0.004, y + 0.004 + RACK_H, -rack / 2, rack / 2, RACK_PITCH);
  },
};
