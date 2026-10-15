// Beverage counter (Getränkeausgabe): a cupboard counter with cooled drink dispensers on the
// top (a clear tank over a cooling base with a tap and a drip tray each) and stacks of glasses.

import { doorCount, FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { DOOR, DOOR_WIDTH, PLINTH, TOP } from "../parts/mesh";
import { INSET, upstandLine } from "../parts/plan";
import type { KindDef } from "../types";
import { counterBody, drinkDispenser, leafDoors, tumbler } from "./common";

/** Height of the dispensers over the top (mm). */
const DISPENSER_RISE = 600;
/** One dispenser: width, depth and the height of its base (mm). */
const DISPENSER = { w: 260, d: 420, base: 220 };
/** Room left of the dispensers for the glasses (mm), glass radius and stack height (m). */
const GLASSES = 300;
const GLASS_R = 0.04;
const GLASS_STACK = 0.25;
/** Offsets of the two glass stacks from the middle of their room (m). */
const GLASS_STACKS = [-0.05, 0.05];

/** Centres of the dispensers (mm), right of the glasses, at most three. */
export function dispenserXs(width: number): number[] {
  const span = width - GLASSES - INSET;
  const n = Math.max(1, Math.min(3, Math.floor(span / (DISPENSER.w + INSET))));
  const pitch = DISPENSER.w + INSET;
  const x1 = width / 2 - INSET / 2;
  return Array.from({ length: n }, (_, i) => x1 - pitch * (i + 0.5));
}

export const beverageCounter: KindDef = {
  kind: "beverageCounter",
  rise: DISPENSER_RISE,
  plan(s) {
    const y0 = s.B + INSET * 2;
    for (const x of dispenserXs(s.w)) {
      s.rect("detail", x - DISPENSER.w / 2, y0, x + DISPENSER.w / 2, y0 + DISPENSER.d);
      s.rect("detail", x - DISPENSER.w / 3, y0 + DISPENSER.d, x + DISPENSER.w / 3, Math.min(y0 + DISPENSER.d + 120, s.F - INSET));
    }
    for (const dx of GLASS_STACKS) s.circle("detail", s.L + GLASSES / 2 + dx * 1000, 0, GLASS_R * 1000);
    upstandLine(s);
  },
  elevation(f) {
    const { l, r, top } = f;
    f.worktop();
    f.doors(doorCount(f.w), f.z0 + FEET, top - FRONT_TOP - FRONT_INSET);
    const scale = f.w / f.item.width;
    for (const x0 of dispenserXs(f.item.width)) {
      const x = (l + r) / 2 + x0 * scale;
      const hw = (DISPENSER.w / 2) * scale;
      f.box("detail", x - hw, x + hw, top, top + DISPENSER.base, "item-dark");
      f.box("detail", x - hw * 0.9, x + hw * 0.9, top + DISPENSER.base, top + DISPENSER_RISE - 30, "glass");
      f.box("detail", x - hw * 0.92, x + hw * 0.92, top + DISPENSER_RISE - 30, top + DISPENSER_RISE, "item-dark");
    }
    const gx = l + (GLASSES / 2) * scale;
    f.box("detail", gx - GLASS_R * 1000, gx + GLASS_R * 1000, top, top + GLASS_STACK * 1000);
  },
  mesh(p, s, item) {
    const zBody = s.d / 2 - DOOR;
    counterBody(p, s, [], "steel", zBody);
    leafDoors(p, -s.w / 2, s.w / 2, PLINTH, s.h - TOP, zBody, s.d / 2 - DOOR / 2, s.d / 2, Math.max(1, Math.round(s.w / DOOR_WIDTH)));
    const rise = DISPENSER_RISE / 1000;
    const z0 = -s.d / 2 + (INSET * 2) / 1000;
    const z1 = Math.min(z0 + DISPENSER.d / 1000 + 0.12, s.d / 2 - 0.02);
    const drinks = ["foodRed", "oil", "foodCream"] as const;
    for (const [i, xm] of dispenserXs(item.width).entries()) drinkDispenser(p, xm / 1000, s.h, z0, z1, DISPENSER.w / 1000, rise, drinks[i % drinks.length]);
    // Stacks of upturned glasses at the left, on a tray.
    const gx = -s.w / 2 + GLASSES / 2000;
    p.roundedBox("panelDark", gx - 0.11, gx + 0.11, s.h, s.h + 0.012, -0.08, 0.08, 0.02, "vertical");
    for (const dx of GLASS_STACKS) {
      for (let k = 0; k < 3; k++) tumbler(p, gx + dx, s.h + 0.012 + k * 0.07, 0, GLASS_R, 0.09);
    }
  },
};
