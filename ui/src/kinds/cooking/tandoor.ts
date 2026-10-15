// Tandoor: a clay pot in an insulated steel cabinet, its round mouth in the top with the lid laid
// beside it; the burner (or the elements) heats the pot from below, the controls and the ash and
// service door at the front.

import { FEET } from "../parts/elevation";
import { DOOR, doors, PLINTH, plinth, TOP_RADIUS } from "../parts/mesh";
import type { KindDef } from "../types";
import { pilot } from "./details";
import { controlPanel, housing, ratingPlate } from "../parts/details";

/** Height of the raised rim round the top over it (m). */
const RIM = 0.045;
/** Thickness of the top, the pot's depth under it and the height of the control strip (m). */
const TOP_SHEET = 0.04;
const POT = 0.55;
const STRIP = 0.12;

/** Where the mouth and the lid lie on the top (m). */
function mouth(w: number, d: number) {
  const r = Math.min(w, d) * 0.16;
  const cx = -w * 0.12;
  const cz = -d * 0.06;
  return { r, cx, cz, lidX: w / 2 - r * 0.9 - 0.04 };
}

/** Where the lid lies front to back (m). */
function lidZ(d: number, r: number): number {
  return d / 2 - r * 0.9 - 0.08;
}

export const tandoor: KindDef = {
  kind: "tandoor",
  plan(s) {
    const m = mouth(s.w / 1000, s.d / 1000);
    const k = 1000;
    s.circle("detail", m.cx * k, m.cz * k, m.r * k);
    s.circle("detail", m.cx * k, m.cz * k, m.r * 1.6 * k);
    s.circle("detail", m.lidX * k, (lidZ(s.d / 1000, m.r) * k), m.r * 0.9 * k);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.box("detail", l + 40, r - 40, top - TOP_SHEET * 1000 - STRIP * 1000, top - TOP_SHEET * 1000, "item-dark");
    f.doors(1, z0 + FEET, top - TOP_SHEET * 1000 - STRIP * 1000 - 40);
    f.worktop();
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const m = mouth(s.w, s.d);
    const topY = s.h - RIM;
    // The cabinet with its service door and the control strip.
    plinth(p, s.w, s.d);
    const yc = topY - TOP_SHEET - STRIP;
    housing(p, "steel", -s.w / 2, s.w / 2, PLINTH, topY - TOP_SHEET + 0.004, -s.d / 2, zf - DOOR, 0.004);
    doors(p, -s.w / 2, s.w / 2, PLINTH, yc, s.d, 1, "top");
    controlPanel(p, -s.w / 2 + 0.01, s.w / 2 - 0.01, yc + 0.006, topY - TOP_SHEET - 0.006, zf - DOOR, zf - DOOR / 2);
    p.knob(-0.12, (yc + topY - TOP_SHEET) / 2, zf - DOOR / 2, zf, 0.022);
    p.knob(0.0, (yc + topY - TOP_SHEET) / 2, zf - DOOR / 2, zf, 0.022);
    pilot(p, 0.12, (yc + topY - TOP_SHEET) / 2, zf - DOOR / 2);
    ratingPlate(p, s.w / 2 - 0.08, PLINTH + 0.045, zf - DOOR / 2, 0.08, 0.03);
    // The top with the round mouth, the clay pot's neck in it and the pot's dark inside.
    const r = m.r;
    p.topWithHoles("steel", s.w, s.d, topY - TOP_SHEET, topY, [{ x0: m.cx - r * 1.6, x1: m.cx + r * 1.6, z0: m.cz - r * 1.6, z1: m.cz + r * 1.6, r: r * 1.6 }]);
    p.lathe("concrete", m.cx, topY - POT, m.cz, [
      [0, 0],
      [r * 1.3, 0],
      [r * 1.55, POT * 0.5],
      [r * 1.5, POT * 0.8],
      [r * 1.62, POT - 0.02],
      [r * 1.62, POT + 0.004],
      [r * 0.98, POT + 0.004],
      [r * 1.0, POT - 0.02],
      [r * 1.3, POT * 0.6],
      [r * 1.15, 0.03],
      [0, 0.03],
    ]);
    p.lathe("top", m.cx, topY - POT + 0.031, m.cz, [
      [0, 0],
      [r * 1.1, 0],
      [r * 1.1, 0.004],
      [0, 0.004],
    ]);
    // The lid laid on the top at the front right: a steel disc with a wooden knob.
    const lz = lidZ(s.d, r);
    p.lathe("steel", m.lidX, topY, lz, [
      [0, 0],
      [r * 0.9, 0],
      [r * 0.9, 0.004],
      [r * 0.82, 0.008],
      [0, 0.008],
    ]);
    p.lathe("wood", m.lidX, topY + 0.008, lz, [
      [0, 0],
      [0.014, 0],
      [0.011, 0.01],
      [0.022, 0.02],
      [0.022, 0.026],
      [0, 0.03],
    ]);
    // The raised rim at the back and the sides keeps the flour on the top.
    p.roundedBox("steel", -s.w / 2, s.w / 2, topY - TOP_RADIUS, s.h, -s.d / 2, -s.d / 2 + 0.008, TOP_RADIUS, "top");
    for (const sx of [-1, 1]) {
      const x = sx * (s.w / 2 - 0.004);
      p.roundedBox("steel", x - 0.004, x + 0.004, topY - TOP_RADIUS, s.h, -s.d / 2 + 0.008, zf - 0.1, TOP_RADIUS, "top");
    }
  },
};
