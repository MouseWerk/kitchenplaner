// Vegetable washing machine (Gemüsewaschmaschine): a tank of water on legs where air bubbled in
// from below turns salad and vegetables over and washes the sand off; a perforated basket lifts
// them out. The blower hangs under the tank, the control column with its buttons stands at the
// right end, the drain valve at the front.

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, foot, LEG, LEG_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { buttons } from "./details";
import { display, HOUSING_RADIUS, ratingPlate } from "../parts/details";

/** Width of the control column at the right end (m). */
const COLUMN = 0.2;
/** Height of the tank's top (m, at most) and its depth. */
const RIM = 0.92;
const TANK = 0.4;
/** Margin of the basket in the tank (m). */
const BASKET_MARGIN = 0.04;

/** The tank's rim and floor of a machine `h` high (m). */
function tankOf(h: number) {
  const rim = Math.min(RIM, h - 0.06);
  return { rim, floor: rim - Math.min(TANK, rim * 0.5) };
}

export const vegetableWasher: KindDef = {
  kind: "vegetableWasher",
  plan(s) {
    const x1 = s.R - COLUMN * 1000;
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, x1 - INSET / 2, s.F - INSET / 2);
    s.rect("detail", s.L + INSET * 1.5, s.B + INSET * 1.5, x1 - INSET * 1.5, s.F - INSET * 1.5);
    s.line("detail", [x1, s.B], [x1, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const k = tankOf(f.item.height / 1000);
    const z = (v: number) => z0 + v * 1000;
    const x1 = r - COLUMN * 1000;
    f.box("detail", l, x1, z(k.floor), z(k.rim));
    f.box("detail", l + I, l + I * 2, z0 + FEET * 0.5, z(k.floor));
    f.box("detail", x1 - I * 2, x1 - I, z0 + FEET * 0.5, z(k.floor));
    f.box("detail", (l + x1) / 2 - 150, (l + x1) / 2 + 150, z(k.floor) - 220, z(k.floor) - 20);
    f.box("detail", x1, r, z0 + FEET * 0.5, top);
    f.box("detail", x1 + I / 2, r - I / 2, top - 220, top - I / 2, "item-dark");
    f.circle("detail", l + 120, z(k.floor) + 50, 25);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    const { rim, floor } = tankOf(s.h);
    const x1 = s.w / 2 - COLUMN;
    // Legs on feet under the tank, a cross rail low down.
    for (const x of [-s.w / 2 + 0.05, x1 - 0.05]) {
      for (const z of [zb + 0.05, zf - 0.05]) {
        p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, 0.08, floor + 0.02, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
        foot(p, x, z, 0.08, LEG * 0.55);
      }
    }
    p.roundedBox("steelDark", -s.w / 2 + 0.07, x1 - 0.07, 0.2, 0.23, zb + 0.04, zb + 0.07, BODY_RADIUS);
    // The tank with a rolled rim, the water in it and the basket hanging in the water.
    p.tub("steel", -s.w / 2, x1, floor, rim - 0.012, zb, zf, 0.012, 0.03);
    p.tube("steel", [
      { x: -s.w / 2 + 0.012, y: rim - 0.012, z: 0 },
      { x: -s.w / 2 + 0.012, y: rim - 0.012, z: zf - 0.012 },
      { x: x1 - 0.012, y: rim - 0.012, z: zf - 0.012 },
      { x: x1 - 0.012, y: rim - 0.012, z: zb + 0.012 },
      { x: -s.w / 2 + 0.012, y: rim - 0.012, z: zb + 0.012 },
      { x: -s.w / 2 + 0.012, y: rim - 0.012, z: 0 },
    ], 0.012, { bend: 0.03 });
    p.roundedBox("water", -s.w / 2 + 0.014, x1 - 0.014, floor + 0.014, rim - 0.08, zb + 0.014, zf - 0.014, 0.02, "vertical");
    const m = BASKET_MARGIN;
    p.wireBox(-s.w / 2 + m, x1 - m, floor + 0.06, rim - 0.03, zb + m, zf - m, 0.05);
    for (const x of [-s.w / 2 + m + 0.1, x1 - m - 0.1]) {
      p.tube("handle", [
        { x, y: rim - 0.03, z: zb + m + 0.1 },
        { x, y: rim + 0.03, z: zb + m + 0.1 },
        { x, y: rim + 0.03, z: zf - m - 0.1 },
        { x, y: rim - 0.03, z: zf - m - 0.1 },
      ], 0.006, { bend: 0.02 });
    }
    // The blower under the tank and the drain valve at the front.
    const bx = (-s.w / 2 + x1) / 2;
    p.roundedBox("paintGray", bx - 0.15, bx + 0.15, floor - 0.22, floor - 0.02, zb + 0.12, zf - 0.12, HOUSING_RADIUS);
    p.lathe("slot", bx, floor - 0.12, zf - 0.12, [
      [0, 0],
      [0.06, 0],
      [0.06, 0.001],
      [0, 0.001],
    ], { axis: "z" });
    const vx = -s.w / 2 + 0.12;
    p.tube("satin", [
      { x: vx, y: floor + 0.01, z: zf - 0.1 },
      { x: vx, y: floor - 0.06, z: zf - 0.1 },
      { x: vx, y: floor - 0.06, z: zf - 0.03 },
    ], 0.022, { bend: 0.04 });
    p.roundedBox("knob", vx - 0.012, vx + 0.012, floor - 0.04, floor - 0.03, zf - 0.08, zf - 0.02, 0.004);
    p.tube("knob", [
      { x: vx, y: floor - 0.035, z: zf - 0.05 },
      { x: vx + 0.14, y: floor - 0.035, z: zf - 0.05 },
    ], 0.008);
    // The control column at the right end with the panel facing the front.
    p.roundedBox("steel", x1 + 0.005, s.w / 2, 0.08, s.h, zb, zf - 0.02, HOUSING_RADIUS);
    for (const z of [zb + 0.05, zf - 0.07]) foot(p, (x1 + s.w / 2) / 2, z, 0.08, 0.02);
    const py1 = s.h - 0.03;
    const py0 = py1 - 0.22;
    p.roundedBox("panelDark", x1 + 0.02, s.w / 2 - 0.015, py0, py1, zf - 0.025, zf - 0.008, BODY_RADIUS, "top", "z");
    const pc = (x1 + s.w / 2) / 2 + 0.0025;
    display(p, pc, py1 - 0.05, 0.12, 0.04, zf - 0.008);
    buttons(p, pc - 0.07, pc + 0.07, py0 + 0.06, zf - 0.008, 3);
    ratingPlate(p, pc, 0.2, zf - 0.02, 0.06, 0.035);
  },
};
