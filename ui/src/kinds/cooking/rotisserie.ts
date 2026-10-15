// Spit roasters on a counter: the rotisserie (Hähnchengrill: horizontal spits with chickens
// turning in front of the heaters at the back, behind two glass doors, the drive at the right)
// and the doner grill (Dönergrill: a vertical spit with the meat cone turning in front of a tall
// heating panel, a drip tray under it).

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, SHEET } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { gripX, pilot, tableFeet } from "./details";
import { controlPanel, housing } from "../parts/details";

/** Height of the feet, the base and the top of the rotisserie (m). */
const FEET = 0.03;
const BASE = 0.1;
const CAP = 0.08;
/** Width of the drive and control column at the right (m). */
const DRIVE = 0.14;
/** Spits over the height, and the distance of the chickens on a spit (m). */
const SPITS = 4;
const BIRD_PITCH = 0.17;

export const rotisserie: KindDef = {
  kind: "rotisserie",
  placement: "tableTop",
  plan(s) {
    const x1 = s.R - DRIVE * 1000;
    s.rect("detail", s.L + INSET / 2, s.B + INSET, x1 - INSET / 2, s.F - INSET / 2);
    s.line("detail", [s.L + INSET, 0], [x1 - INSET, 0]);
    s.line("detail", [x1, s.B], [x1, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const x1 = r - DRIVE * 1000;
    const b = z0 + (FEET + BASE) * 1000;
    const t = top - CAP * 1000;
    f.box("detail", l + FRONT_INSET / 2, (l + x1) / 2, b, t, "glass");
    f.box("detail", (l + x1) / 2, x1 - FRONT_INSET / 4, b, t, "glass");
    for (let i = 0; i < SPITS; i++) {
      const y = b + ((t - b) / SPITS) * (i + 0.5);
      f.line("detail", [l + FRONT_INSET, y], [x1 - FRONT_INSET, y]);
    }
    f.box("detail", x1 + FRONT_INSET / 4, r - FRONT_INSET / 4, t - 250, t - FRONT_INSET / 2, "item-dark");
  },
  mesh(p, s) {
    const y0 = tableFeet(p, s.w, s.d, FEET, 0.04);
    const zf = s.d / 2;
    const x1 = s.w / 2 - DRIVE;
    const b = y0 + BASE;
    const t = s.h - CAP;
    // The base with the drip tray drawer, the cap with its vents, the side and the drive column.
    housing(p, "steel", -s.w / 2, s.w / 2, y0, b, -s.d / 2, zf - 0.004, 0.006);
    housing(p, "steel", -s.w / 2, s.w / 2, t, s.h, -s.d / 2, zf - 0.004, 0.006);
    p.roundedBox("steel", -s.w / 2 + 0.03, x1 - 0.03, y0 + 0.015, b - 0.015, zf - 0.03, zf - 0.002, BODY_RADIUS, "top", "z");
    gripX(p, (-s.w / 2 + x1) / 2 - 0.06, (-s.w / 2 + x1) / 2 + 0.06, (y0 + b) / 2, zf - 0.006, 0.006);
    p.roundedBox("steel", -s.w / 2, -s.w / 2 + 0.02, b - 0.01, t + 0.01, -s.d / 2, zf - 0.004, BODY_RADIUS, "vertical");
    housing(p, "steel", x1, s.w / 2, b - 0.01, t + 0.01, -s.d / 2, zf - 0.012, 0.006);
    // The heaters on the back wall: a dark reflector with the elements before it.
    p.box("top", -s.w / 2 + 0.02, x1, b, t, -s.d / 2, -s.d / 2 + SHEET);
    for (let i = 0; i < SPITS; i++) {
      const y = b + ((t - b) / SPITS) * (i + 0.85);
      p.rod("satin", "x", (-s.w / 2 + 0.02 + x1) / 2, y, -s.d / 2 + 0.03, x1 + s.w / 2 - 0.06, 0.006);
    }
    // The spits with the chickens, turning from the drive column.
    const n = Math.max(2, Math.floor((x1 + s.w / 2 - 0.08) / BIRD_PITCH));
    const span = x1 + s.w / 2 - 0.04;
    for (let i = 0; i < SPITS; i++) {
      const y = b + ((t - b) / SPITS) * (i + 0.42);
      p.rod("satin", "x", (-s.w / 2 + 0.02 + x1) / 2, y, 0, span, 0.004);
      for (let k = 0; k < n; k++) {
        const x = -s.w / 2 + 0.04 + (span / n) * (k + 0.5) - 0.02;
        p.lathe("foodBrown", x - 0.06, y, 0, [
          [0, 0],
          [0.03, 0.006],
          [0.045, 0.03],
          [0.05, 0.06],
          [0.044, 0.095],
          [0.026, 0.115],
          [0, 0.12],
        ], { axis: "x" });
      }
    }
    // Two glass doors in thin frames, each with a knob-shaped grip.
    const zd = zf - 0.03;
    const mid = (-s.w / 2 + x1) / 2;
    for (const [a, c] of [
      [-s.w / 2 + 0.02, mid],
      [mid, x1],
    ]) {
      p.plate("glass", a + 0.006, c - 0.006, b + 0.006, t - 0.006, zd, zd + 0.006, 0.004);
      p.lathe("steel", (a + c) / 2, (b + t) / 2, zd - 0.002, [
        [0, 0],
        [0.006, 0],
        [0.006, 0.01],
        [0, 0.01],
        [0, 0],
      ], { axis: "z", rect: [(c - a) / 2 - 0.006, (t - b) / 2 - 0.006], caps: false });
    }
    gripX(p, mid - 0.06, mid - 0.02, (b + t) / 2, zd + 0.015, 0.008);
    gripX(p, mid + 0.02, mid + 0.06, (b + t) / 2, zd + 0.015, 0.008);
    // The panel on the drive column: two knobs (heat, spits) and a pilot light.
    const px = (x1 + s.w / 2) / 2;
    const zFace = zf - 0.008;
    controlPanel(p, x1 + 0.015, s.w / 2 - 0.015, t - 0.3, t - 0.02, zf - 0.012, zFace);
    p.knob(px, t - 0.08, zFace, zf, 0.02);
    p.knob(px, t - 0.17, zFace, zf, 0.02);
    pilot(p, px, t - 0.25, zFace);
  },
};

/** The doner grill: height of the drip tray base and the size of the heating panel (m). */
const DONER_BASE = 0.12;
const PANEL_DEPTH = 0.12;

export const donerGrill: KindDef = {
  kind: "donerGrill",
  placement: "tableTop",
  plan(s) {
    const zc = s.B + (PANEL_DEPTH + 0.2) * 1000;
    s.rect("detail", s.L + INSET / 2, s.B, s.R - INSET / 2, s.B + PANEL_DEPTH * 1000);
    s.circle("detail", 0, zc, 140);
    s.circle("detail", 0, zc, 15);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const c = (l + r) / 2;
    const b = z0 + DONER_BASE * 1000;
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, z0 + 20, b);
    f.line("detail", [c - 160, top - 140], [c + 160, top - 140], [c + 90, b + 60], [c - 90, b + 60], [c - 160, top - 140]);
    f.line("detail", [c, b], [c, top - 20]);
  },
  mesh(p, s, item) {
    const y0 = tableFeet(p, s.w, s.d, 0.02, 0.04);
    const zf = s.d / 2;
    const b = y0 + DONER_BASE;
    const zp = -s.d / 2 + PANEL_DEPTH;
    const zc = zp + 0.2;
    // The base with the drip tray and the motor under the spit.
    housing(p, "steel", -s.w / 2, s.w / 2, y0, b, -s.d / 2, zf, 0.006);
    p.tub("steelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, b - 0.03, b + 0.002, zp + 0.01, zf - 0.02, SHEET / 2);
    p.lathe("satin", 0, b - 0.02, zc, [
      [0, 0],
      [0.05, 0],
      [0.05, 0.03],
      [0.035, 0.045],
      [0, 0.045],
    ]);
    // The heating panel at the back, full height, with its burners or elements and the knobs on
    // its front at the side.
    housing(p, "steel", -s.w / 2, s.w / 2, b - 0.01, s.h, -s.d / 2, zp, 0.006);
    const rows = 3;
    const rh = (s.h - b - 0.12) / rows;
    for (let i = 0; i < rows; i++) {
      const y = b + 0.06 + rh * i;
      if (item.energy === "gas") p.plate("concrete", -s.w / 2 + 0.09, s.w / 2 - 0.09, y + 0.01, y + rh - 0.01, zp, zp + 0.004, 0.006);
      else {
        p.box("top", -s.w / 2 + 0.09, s.w / 2 - 0.09, y + 0.01, y + rh - 0.01, zp, zp + 0.002);
        for (let k = 0; k < 3; k++) p.rod("satin", "x", 0, y + 0.03 + k * (rh - 0.06) / 2, zp + 0.015, s.w - 0.2, 0.005);
      }
      p.knob(s.w / 2 - 0.045, y + rh / 2, zp, zp + 0.03, 0.016);
    }
    pilot(p, -s.w / 2 + 0.045, b + 0.08, zp);
    // The spit and the meat cone, narrow at the bottom and wide at the top, on its plate.
    const coneTop = s.h - 0.13;
    const ch = coneTop - (b + 0.06);
    p.rod("satin", "y", 0, (b + s.h - 0.02) / 2, zc, s.h - 0.02 - b, 0.008);
    p.lathe("satin", 0, b + 0.05, zc, [
      [0, 0],
      [0.1, 0],
      [0.1, 0.008],
      [0, 0.008],
    ]);
    p.lathe("foodBrown", 0, b + 0.058, zc, [
      [0, 0],
      [0.08, 0],
      [0.1, ch * 0.2],
      [0.13, ch * 0.55],
      [0.15, ch * 0.85],
      [0.14, ch * 0.97],
      [0.08, ch],
      [0, ch],
    ]);
    // The upper bearing on an arm from the panel.
    p.roundedBox("steel", -0.02, 0.02, s.h - 0.06, s.h - 0.03, zp - 0.01, zc + 0.02, BODY_RADIUS);
    p.lathe("satin", 0, s.h - 0.08, zc, [
      [0, 0],
      [0.02, 0],
      [0.02, 0.05],
      [0, 0.05],
    ]);
  },
};
