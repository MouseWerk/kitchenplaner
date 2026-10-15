// Dish return belt (Bandrückgabe, Geschirrrückgabeband): guests put their trays on a slow belt
// at the return window, it carries them into the dish room. A frame on legs with the belt of
// plastic slats between two guards, the turning rollers at both ends, the drive under the right
// end and an emergency stop under the front guard. A few returned trays ride on it.

import { FEET, INSET as FRONT_INSET, LEG as FRONT_LEG } from "../parts/elevation";
import { BODY_RADIUS, foot, LEG, LEG_RADIUS, TOP_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { flowArrow } from "./common";
import { button } from "./details";
import { HOUSING_RADIUS } from "../parts/details";

/** Height of the guards' top and the belt's surface below it (m). */
const GUARD = 0.05;
/** Depth of the frame under the belt and the guards' thickness (m). */
const FRAME = 0.12;
const SHEET = 0.012;
/** Largest distance between two pairs of legs (m). */
const LEG_PITCH = 1.5;
/** Length of the drive housing under the right end (m). */
const DRIVE = 0.4;
/** A tray on the belt (m) and the distance between the trays shown. */
const TRAY = { l: 0.53, d: 0.37, t: 0.018 };
const TRAY_PITCH = 1.1;

export const dishReturnBelt: KindDef = {
  kind: "dishReturnBelt",
  plan(s) {
    const g = SHEET * 1000;
    s.line("detail", [s.L, s.B + g], [s.R, s.B + g]);
    s.line("detail", [s.L, s.F - g], [s.R, s.F - g]);
    for (const x of [s.L + 60, s.R - 60]) s.line("detail", [x, s.B + g], [x, s.F - g]);
    flowArrow(s, s.L + INSET * 3, s.R - INSET * 3, 0, "right");
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const belt = top - GUARD * 1000;
    f.box("detail", l, r, belt - FRAME * 1000, top);
    f.line("detail", [l, belt], [r, belt]);
    const n = Math.max(1, Math.ceil(f.w / 1000 / LEG_PITCH));
    for (let i = 0; i <= n; i++) {
      const x = l + 30 + ((f.w - 60 - FRONT_LEG) * i) / n;
      f.box("detail", x, x + FRONT_LEG, z0 + FEET * 0.5, belt - FRAME * 1000);
    }
    f.box("detail", r - DRIVE * 1000, r - FRONT_INSET, belt - FRAME * 1000 - 250, belt - FRAME * 1000);
    f.circle("detail", l + 120, belt + 25, 15);
  },
  mesh(p, s) {
    const top = s.h;
    const belt = top - GUARD;
    const frame0 = belt - FRAME;
    const zb = -s.d / 2;
    const zf = s.d / 2;
    // Legs on feet under the frame, in pairs along the length.
    const n = Math.max(1, Math.ceil(s.w / LEG_PITCH));
    for (let i = 0; i <= n; i++) {
      const x = -s.w / 2 + 0.05 + ((s.w - 0.1) * i) / n;
      for (const z of [zb + 0.05, zf - 0.05]) {
        p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, 0.08, frame0, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
        foot(p, x, z, 0.08, LEG * 0.55);
      }
    }
    // The frame, the belt of slats and the rollers at its ends.
    p.roundedBox("steel", -s.w / 2, s.w / 2, frame0, belt - 0.02, zb + SHEET, zf - SHEET, BODY_RADIUS);
    p.box("panelDark", -s.w / 2 + 0.04, s.w / 2 - 0.04, belt - 0.02, belt, zb + SHEET * 1.5, zf - SHEET * 1.5);
    const slats = Math.floor((s.w - 0.08) / 0.1);
    for (let i = 1; i < slats; i++) {
      const x = -s.w / 2 + 0.04 + ((s.w - 0.08) * i) / slats;
      p.box("slot", x - 0.0015, x + 0.0015, belt - 0.001, belt + 0.0005, zb + SHEET * 1.5, zf - SHEET * 1.5);
    }
    for (const x of [-s.w / 2 + 0.04, s.w / 2 - 0.04]) {
      p.lathe("satin", x, belt - 0.02, zb + SHEET * 1.5, [
        [0, 0],
        [0.018, 0],
        [0.02, 0.004],
        [0.02, s.d - SHEET * 3 - 0.004],
        [0.018, s.d - SHEET * 3],
        [0, s.d - SHEET * 3],
      ], { axis: "z" });
    }
    // The guards along the back and the front, their tops rounded.
    for (const [a, b] of [
      [zb, zb + SHEET],
      [zf - SHEET, zf],
    ]) {
      p.roundedBox("steel", -s.w / 2, s.w / 2, frame0, top, a, b, TOP_RADIUS, "top");
    }
    // The drive under the right end: a housing with the motor and the emergency stop.
    const dx1 = s.w / 2 - 0.03;
    const dx0 = Math.max(-s.w / 2 + 0.1, dx1 - DRIVE);
    p.roundedBox("steel", dx0, dx1, frame0 - 0.25, frame0, zb + 0.08, zf - 0.08, HOUSING_RADIUS);
    // The geared motor stands out of the housing's front.
    const motor = 0.06;
    p.lathe("paintGray", dx0 + 0.1, frame0 - 0.15, zf - 0.085, [
      [0, 0],
      [0.06, 0],
      [0.065, 0.01],
      [0.065, motor],
      [0, motor],
    ], { axis: "z" });
    // The emergency stop in its box under the frame at the loading end.
    const ex = -s.w / 2 + 0.16;
    p.roundedBox("panelDark", ex - 0.045, ex + 0.045, frame0 - 0.12, frame0 - 0.01, zf - 0.09, zf - 0.02, 0.006);
    button(p, ex, frame0 - 0.065, zf - 0.02, 0.016, "knob");
    // Returned trays riding on the belt, a plate and a bowl on each.
    const tl = Math.min(TRAY.l, s.w / 3);
    const td = Math.min(TRAY.d, s.d - SHEET * 4);
    for (let x = -s.w / 2 + 0.06 + tl / 2 + 0.2; x + tl / 2 < s.w / 2 - 0.1; x += TRAY_PITCH) {
      p.roundedBox("paintGray", x - tl / 2, x + tl / 2, belt, belt + TRAY.t, -td / 2, td / 2, 0.008);
      p.lathe("panel", x - tl * 0.12, belt + TRAY.t - 0.002, 0, [
        [0, 0],
        [0.07, 0],
        [0.12, 0.016],
        [0.13, 0.02],
        [0.12, 0.02],
        [0.06, 0.008],
        [0, 0.008],
      ]);
      // A small bowl beside the plate, low enough to pass under the hatch.
      p.lathe("panel", x + tl * 0.33, belt + TRAY.t - 0.002, td * 0.18, [
        [0, 0],
        [0.03, 0],
        [0.055, 0.025],
        [0.05, 0.026],
        [0.028, 0.008],
        [0, 0.008],
      ]);
    }
  },
};
