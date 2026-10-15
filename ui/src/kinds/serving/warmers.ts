// Table-top warmers of the buffet and the counter: the soup kettle (Suppenkessel), the electric
// chafing dish with its roll-top lid (Chafing Dish), the carving lamp over a heated board
// (Tranchierlampe) and the heated display for pizza and snacks (Warmhaltevitrine). They stand on
// a counter at its height.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, foot, type Point2 } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { dish, foodMound, GLASS, pilotLamp, rocker } from "./common";

// ---------------------------------------------------------------------------------------------
// Soup kettle

/** Height of the kettle's base (share of the height) and of its lid (m). */
const KETTLE_BASE = 0.62;
const KETTLE_LID = 0.06;

export const soupKettle: KindDef = {
  kind: "soupKettle",
  placement: "tableTop",
  plan(s) {
    const r = Math.min(s.w, s.d) / 2 - INSET;
    s.circle("detail", 0, 0, r);
    s.circle("detail", 0, 0, r * 0.85);
    s.circle("detail", 0, 0, r * 0.12);
  },
  elevation(f) {
    const { l, r, z0, top, w } = f;
    const cx = (l + r) / 2;
    const zb = z0 + f.item.height * KETTLE_BASE;
    f.line("detail", [l + FRONT_INSET, zb], [r - FRONT_INSET, zb]);
    f.line("detail", [l + FRONT_INSET, top - KETTLE_LID * 1000], [r - FRONT_INSET, top - KETTLE_LID * 1000]);
    f.circle("detail", cx, z0 + f.item.height * 0.3, Math.min(25, w / 12));
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const r = Math.min(w, d) / 2 - 0.022;
    const hb = h * KETTLE_BASE;
    // The base: a drip plate over the footprint, a dark turned housing on it with its
    // thermostat and pilot lamp at the front.
    p.roundedBox("steelDark", -w / 2, w / 2, 0, 0.006, -d / 2, d / 2 - 0.02, 0.01);
    p.lathe("panelDark", 0, 0.005, 0, [
      [0, 0],
      [r * 0.86, 0],
      [r * 0.9, 0.012],
      [r * 0.95, 0.02],
      [r, hb * 0.3],
      [r, hb - 0.012],
      [r * 0.97, hb],
      [0, hb],
    ]);
    p.knob(0, hb * 0.32, r - 0.004, d / 2, 0.018);
    pilotLamp(p, 0, hb * 0.62, r - 0.002, "oil", 0.005);
    // The steel insert with its rolled rim, the domed lid with its knob.
    const yr = h - KETTLE_LID;
    p.lathe("steel", 0, hb - 0.004, 0, [
      [r * 0.92, 0],
      [r * 0.96, 0],
      [r * 0.96, yr - hb - 0.004],
      [r * 0.99, yr - hb],
      [r * 0.9, yr - hb],
      [r * 0.9, 0.01],
      [0, 0.01],
      [0, 0],
    ]);
    p.lathe("steel", 0, yr - 0.002, 0, [
      [0, 0],
      [r * 0.95, 0],
      [r * 0.95, 0.006],
      [r * 0.8, KETTLE_LID * 0.45],
      [r * 0.35, KETTLE_LID * 0.62],
      [0, KETTLE_LID * 0.62],
    ]);
    p.lathe("knob", 0, yr - 0.002 + KETTLE_LID * 0.62 - 0.001, 0, [
      [0, 0],
      [0.014, 0],
      [0.01, 0.008],
      [0.018, 0.016],
      [0.018, 0.021],
      [0.012, KETTLE_LID * 0.38 + 0.003],
      [0, KETTLE_LID * 0.38 + 0.003],
    ]);
    // The carrying handles on both sides.
    for (const sx of [-1, 1]) {
      p.tube(
        "knob",
        [
          { x: sx * (r - 0.004), y: hb - 0.05, z: -0.05 },
          { x: sx * (w / 2 - 0.008), y: hb - 0.05, z: -0.05 },
          { x: sx * (w / 2 - 0.008), y: hb - 0.05, z: 0.05 },
          { x: sx * (r - 0.004), y: hb - 0.05, z: 0.05 },
        ],
        0.008,
        { bend: 0.015 },
      );
    }
    // A notch in the lid for the ladle: the handle comes out at the back.
    p.tube(
      "handle",
      [
        { x: r * 0.3, y: yr + 0.01, z: -r * 0.5 },
        { x: r * 0.3, y: yr + 0.03, z: -d / 2 + 0.005 },
      ],
      0.005,
    );
  },
};

// ---------------------------------------------------------------------------------------------
// Chafing dish

/** Width taken by one chafing dish along the counter (mm, a GN 1/1 dish crosswise). */
const CHAFING = 600;
/** Height of the stand under the water pan (m), of the pan's rim and of the roll-top lid. */
const STAND = 0.11;
const PAN = 0.11;

/** Number of dishes on a station of the given width (mm). */
export function chafingCount(width: number): number {
  return Math.max(1, Math.floor(width / CHAFING));
}

/** Centres of the dishes along the width (mm). */
function chafingXs(width: number): number[] {
  const n = chafingCount(width);
  return Array.from({ length: n }, (_, i) => -width / 2 + (width / n) * (i + 0.5));
}

export const chafingDish: KindDef = {
  kind: "chafingDish",
  placement: "tableTop",
  plan(s) {
    const n = chafingXs(s.w).length;
    const dw = s.w / n;
    for (const x of chafingXs(s.w)) {
      s.rect("detail", x - dw / 2 + INSET, s.B + INSET, x + dw / 2 - INSET, s.F - INSET);
      s.line("detail", [x - dw / 2 + INSET, 0], [x + dw / 2 - INSET, 0]);
    }
  },
  elevation(f) {
    const { z0, top } = f;
    const scale = f.w / f.item.width;
    const dw = (f.item.width / chafingXs(f.item.width).length) * scale;
    for (const x0 of chafingXs(f.item.width)) {
      const x = (f.l + f.r) / 2 + x0 * scale;
      f.box("detail", x - dw / 2 + 20, x + dw / 2 - 20, z0 + STAND * 1000, z0 + (STAND + PAN) * 1000);
      f.line("detail", [x - dw / 2 + 40, z0], [x - dw / 2 + 40, z0 + STAND * 1000]);
      f.line("detail", [x + dw / 2 - 40, z0], [x + dw / 2 - 40, z0 + STAND * 1000]);
      f.circle("detail", x, top - 20, 15);
    }
  },
  mesh(p, s, item) {
    const { d, h } = s;
    const n = chafingXs(item.width).length;
    const dw = s.w / n;
    for (const [i, xm] of chafingXs(item.width).entries()) {
      const x = xm / 1000;
      // Neighbouring dishes keep a gap; the outer ones reach the ends of the footprint.
      const x0 = x - dw / 2 + (i === 0 ? 0 : 0.005);
      const x1 = x + dw / 2 - (i === n - 1 ? 0 : 0.005);
      const z0 = -d / 2;
      const z1 = d / 2;
      // The stand: four turned legs on feet with a frame, the heating plate in it.
      for (const lx of [x0 + 0.03, x1 - 0.03]) {
        for (const lz of [z0 + 0.03, z1 - 0.03]) {
          foot(p, lx, lz, 0.02, 0.012);
          p.lathe("satin", lx, 0.019, lz, [
            [0, 0],
            [0.008, 0],
            [0.008, STAND - 0.025],
            [0.012, STAND - 0.019],
            [0, STAND - 0.019],
          ]);
        }
      }
      p.roundedBox("steelDark", x0 + 0.04, x1 - 0.04, STAND - 0.05, STAND - 0.03, z0 + 0.04, z1 - 0.04, 0.006, "vertical");
      p.roundedBox("ceramic", x0 + 0.06, x1 - 0.06, STAND - 0.03, STAND - 0.028, z0 + 0.06, z1 - 0.06, 0.006, "vertical");
      // Water pan, the food pan in it and the food (seen under the open half of the lid).
      p.pan("steel", x0, x1, STAND, STAND + PAN, z0, z1, { wall: 0.003, r: 0.03, rim: 0.012 });
      foodMound(p, "foodBrown", x0 + 0.03, x1 - 0.03, STAND + 0.04, STAND + PAN - 0.025, z0 + 0.03, z1 - 0.03);
      // The roll-top lid: an arched hood along the width, rolled back over the rear half; its
      // grip in the middle of the top.
      const yl = STAND + PAN;
      const lh = h - yl;
      const half = (z1 - z0) / 2;
      const arch: Point2[] = [];
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI;
        arch.push([(z0 + z1) / 2 - half * Math.cos(a), yl + lh * Math.sin(a)]);
      }
      for (let k = 12; k >= 0; k--) {
        const a = (k / 12) * Math.PI;
        arch.push([(z0 + z1) / 2 - (half - 0.004) * Math.cos(a), yl + (lh - 0.004) * Math.sin(a)]);
      }
      const back = arch.filter(([z]) => z <= (z0 + z1) / 2 + 0.06);
      p.extrude("steel", "x", x0 + 0.004, x1 - 0.004, back);
      // The lid's round ends, as far as it covers.
      const outer = arch.slice(0, 13).filter(([z]) => z <= (z0 + z1) / 2 + 0.06);
      const last = outer[outer.length - 1];
      for (const ex of [x0, x1 - 0.004]) p.extrude("steel", "x", ex, ex + 0.004, [...outer, [last[0], yl]]);
      p.lathe("knob", x, h - 0.014, (z0 + z1) / 2 + 0.03, [
        [0, 0],
        [0.012, 0],
        [0.016, 0.008],
        [0.012, 0.014],
        [0, 0.014],
      ]);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Carving lamp

/** Height of the heated base and of the board on it (m), the lamp shade's radius and height (m). */
const BASE = 0.05;
const BOARD = 0.03;
const SHADE_R = 0.12;
const SHADE_H = 0.13;

export const carvingLamp: KindDef = {
  kind: "carvingLamp",
  placement: "tableTop",
  plan(s) {
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, s.F - INSET);
    s.circle("hidden", 0, 0, SHADE_R * 1000);
    s.line("detail", [0, s.B + INSET / 2], [0, 0]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const cx = (l + r) / 2;
    f.box("detail", l, r, z0, z0 + BASE * 1000);
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, z0 + BASE * 1000, z0 + (BASE + BOARD) * 1000);
    f.box("detail", cx - SHADE_R * 1000, cx + SHADE_R * 1000, top - SHADE_H * 1000 - 30, top - 30);
    f.circle("detail", r - FRONT_INSET * 1.5, z0 + (BASE * 1000) / 2, 12);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    // The heated base with its knob and pilot lamp, the wooden board and a roast on it.
    p.roundedBox("steel", -w / 2, w / 2, 0, BASE, -d / 2, d / 2 - 0.02, BODY_RADIUS * 4);
    p.knob(w / 2 - 0.06, BASE / 2, d / 2 - 0.02, d / 2, 0.015);
    pilotLamp(p, w / 2 - 0.11, BASE / 2, d / 2 - 0.02, "oil", 0.005);
    p.roundedBox("wood", -w / 2 + 0.04, w / 2 - 0.04, BASE, BASE + BOARD, -d / 2 + 0.06, d / 2 - 0.06, 0.008);
    p.lathe(
      "foodBrown",
      -0.08,
      BASE + BOARD + 0.045,
      0.02,
      [
        [0, 0],
        [0.035, 0.002],
        [0.05, 0.025],
        [0.055, 0.08],
        [0.05, 0.13],
        [0.035, 0.158],
        [0, 0.16],
      ],
      { axis: "x" },
    );
    // The lamp on its bent arm from the back of the base: a column, a bend forward and the shade
    // over the middle of the board with its red infrared bulb.
    const arm = 0.012;
    const ys = h - 0.03;
    p.lathe("satin", 0, BASE, -d / 2 + 0.05, [
      [0, 0],
      [0.035, 0],
      [0.03, 0.012],
      [0, 0.012],
    ]);
    p.tube(
      "satin",
      [
        { x: 0, y: BASE + 0.01, z: -d / 2 + 0.05 },
        { x: 0, y: h - arm, z: -d / 2 + 0.05 },
        { x: 0, y: h - arm, z: 0 },
        { x: 0, y: ys, z: 0 },
      ],
      arm,
      { bend: 0.07 },
    );
    p.lathe("steelDark", 0, ys - SHADE_H, 0, [
      [SHADE_R * 0.97, 0],
      [SHADE_R, 0.004],
      [SHADE_R * 0.85, SHADE_H * 0.4],
      [SHADE_R * 0.45, SHADE_H * 0.85],
      [SHADE_R * 0.2, SHADE_H],
      [0, SHADE_H],
      [0, SHADE_H - 0.004],
      [SHADE_R * 0.42, SHADE_H * 0.82],
      [SHADE_R * 0.8, SHADE_H * 0.4],
      [SHADE_R * 0.95, 0.004],
      [SHADE_R * 0.97, 0],
    ]);
    p.lathe("foodRed", 0, ys - SHADE_H - 0.004, 0, [
      [0, 0],
      [SHADE_R * 0.3, 0.004],
      [SHADE_R * 0.5, SHADE_H * 0.3],
      [SHADE_R * 0.2, SHADE_H * 0.55],
      [0, SHADE_H * 0.55],
    ]);
    rocker(p, -w / 2 + 0.06, BASE / 2, d / 2 - 0.02, d / 2);
  },
};

// ---------------------------------------------------------------------------------------------
// Heated display

/** Height of the base with the controls (m), of the lit canopy (m); shelves in the display. */
const DISPLAY_BASE = 0.1;
const CANOPY = 0.06;
const DISPLAY_SHELVES = 2;
/** Radius of a pizza on the shelves (m). */
const PIZZA_R = 0.13;

export const displayWarmer: KindDef = {
  kind: "displayWarmer",
  placement: "tableTop",
  plan(s) {
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
    s.line("detail", [s.L + INSET / 2, s.F - INSET], [s.R - INSET / 2, s.F - INSET]);
    s.line("detail", [0, s.F - INSET], [0, s.F - INSET / 2]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    f.line("detail", [l, z0 + DISPLAY_BASE * 1000], [r, z0 + DISPLAY_BASE * 1000]);
    f.line("detail", [l, top - CANOPY * 1000], [r, top - CANOPY * 1000]);
    f.box("detail", l + I / 2, r - I / 2, z0 + DISPLAY_BASE * 1000, top - CANOPY * 1000, "glass");
    for (let k = 1; k <= DISPLAY_SHELVES; k++) {
      const z = z0 + DISPLAY_BASE * 1000 + ((top - CANOPY * 1000 - z0 - DISPLAY_BASE * 1000) * k) / (DISPLAY_SHELVES + 1);
      f.line("detail", [l + I / 2, z], [r - I / 2, z]);
    }
    f.line("detail", [(l + r) / 2, z0 + DISPLAY_BASE * 1000], [(l + r) / 2, top - CANOPY * 1000]);
    f.circle("detail", r - I * 2, z0 + (DISPLAY_BASE * 1000) / 2, 14);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const yb = DISPLAY_BASE;
    const yc = h - CANOPY;
    // The base with its controls, and the canopy with its lights in the underside.
    p.roundedBox("steel", -w / 2, w / 2, 0, yb, -d / 2, d / 2 - 0.02, BODY_RADIUS * 4);
    p.plate("panelDark", w / 2 - 0.2, w / 2 - 0.03, 0.02, yb - 0.02, d / 2 - 0.02, d / 2 - 0.018, 0.006, true);
    p.knob(w / 2 - 0.07, yb / 2, d / 2 - 0.018, d / 2, 0.016);
    pilotLamp(p, w / 2 - 0.13, yb / 2, d / 2 - 0.018);
    rocker(p, w / 2 - 0.17, yb / 2, d / 2 - 0.018, d / 2);
    p.roundedBox("steel", -w / 2, w / 2, yc, h, -d / 2, d / 2 - 0.02, BODY_RADIUS * 4);
    p.roundedBox("panel", -w / 2 + 0.05, w / 2 - 0.05, yc - 0.004, yc + 0.001, -0.03, 0.03, 0.01, "vertical");
    // Glass all round: the ends and the guest side fixed, two sliding doors on the staff side
    // (the front) with their finger grips.
    const t = GLASS;
    for (const x of [-w / 2 + 0.004, w / 2 - 0.004 - t]) p.box("glass", x, x + t, yb, yc, -d / 2 + 0.004, d / 2 - 0.024);
    p.box("glass", -w / 2 + 0.004, w / 2 - 0.004, yb, yc, -d / 2 + 0.004, -d / 2 + 0.004 + t);
    for (const [k, z] of [
      [0, d / 2 - 0.022 - t * 2],
      [1, d / 2 - 0.022 - t],
    ] as const) {
      const x0 = k === 0 ? -w / 2 + 0.01 : -0.02;
      const x1 = k === 0 ? 0.02 : w / 2 - 0.01;
      p.box("glass", x0, x1, yb + 0.004, yc - 0.004, z, z + t);
      const gx = k === 0 ? x0 + 0.04 : x1 - 0.04;
      p.roundedBox("handle", gx - 0.012, gx + 0.012, (yb + yc) / 2 - 0.03, (yb + yc) / 2 + 0.03, z + t, z + t + 0.004, 0.004, "top", "z");
    }
    // Wire shelves with pizzas and pastries on them, and the heated floor with its tray.
    const levels = [yb, ...Array.from({ length: DISPLAY_SHELVES }, (_, i) => yb + ((yc - yb) * (i + 1)) / (DISPLAY_SHELVES + 1))];
    levels.forEach((y, i) => {
      if (i > 0) p.grid(-w / 2 + 0.015, w / 2 - 0.015, y - 0.006, y, -d / 2 + 0.02, d / 2 - 0.05, 0.03, "x");
      else p.roundedBox("steelDark", -w / 2 + 0.015, w / 2 - 0.015, y, y + 0.004, -d / 2 + 0.015, d / 2 - 0.045, 0.004, "vertical");
      const n = Math.max(1, Math.floor((w - 0.06) / (PIZZA_R * 2 + 0.03)));
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + 0.03 + ((w - 0.06) / n) * (k + 0.5);
        const r = Math.min(PIZZA_R, (d - 0.12) / 2);
        if ((i + k) % 2 === 0) {
          p.lathe("foodCream", x, y + 0.004, -0.015, [
            [0, 0],
            [r, 0],
            [r, 0.012],
            [r * 0.92, 0.016],
            [0, 0.012],
          ]);
          p.lathe("foodRed", x, y + 0.012, -0.015, [
            [0, 0],
            [r * 0.86, 0],
            [r * 0.86, 0.004],
            [0, 0.004],
          ]);
        } else {
          dish(p, x, y + 0.004, -0.015, r * 0.85, "foodBrown");
        }
      }
    });
  },
};

// ---------------------------------------------------------------------------------------------
// Holding drawers

/** Width of the control column at the right (mm). */
const DRAWER_CONTROLS = 140;

/** Number of drawers stacked in a cabinet of the given height (mm): one per 230 mm or so. */
export function holdingDrawerCount(height: number): number {
  return Math.max(1, Math.min(4, Math.round((height - 150) / 230)));
}

export const holdingDrawers: KindDef = {
  kind: "holdingDrawers",
  plan(s) {
    s.line("detail", [s.R - DRAWER_CONTROLS, s.F - INSET], [s.R - DRAWER_CONTROLS, s.F]);
    s.line("detail", [s.L + INSET, s.F - INSET / 2], [s.R - DRAWER_CONTROLS - INSET, s.F - INSET / 2]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    f.worktop();
    const n = holdingDrawerCount(f.item.height);
    const x1 = r - DRAWER_CONTROLS;
    const y0 = z0 + 150;
    const dh = (top - 40 - y0) / n;
    for (let i = 0; i < n; i++) {
      const b = y0 + i * dh;
      f.box("detail", l + I / 2, x1 - I / 4, b + I / 8, b + dh - I / 8);
      f.line("detail", [(l + x1) / 2 - I * 3, b + dh - I * 1.5], [(l + x1) / 2 + I * 3, b + dh - I * 1.5]);
      f.circle("detail", (x1 + r) / 2, b + dh / 2, 16);
    }
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    const zBody = d / 2 - 0.02;
    const zFace = d / 2 - 0.01;
    plinthAndBody(p, w, d, h, zBody);
    const n = holdingDrawerCount(item.height);
    const x1 = w / 2 - DRAWER_CONTROLS / 1000;
    const y0 = 0.15;
    const dh = (h - 0.04 - y0) / n;
    // Each drawer: a rounded front with its bar handle and vent slots; in the control column a
    // thermostat knob, a humidity vent slider and a pilot lamp per drawer.
    p.plate("panelDark", x1 + 0.004, w / 2 - 0.004, y0, h - 0.044, zBody, zBody + 0.003, 0.004, true);
    for (let i = 0; i < n; i++) {
      const b = y0 + i * dh;
      p.roundedBox("steel", -w / 2 + 0.004, x1 - 0.004, b + 0.004, b + dh - 0.004, zBody, zFace, 0.002, "top", "z");
      const len = Math.min(0.3, (x1 + w / 2) * 0.5);
      const cx = (x1 - w / 2) / 2;
      p.barHandle("x", cx - len / 2, cx + len / 2, b + dh - 0.05, zFace, d / 2);
      for (let k = 0; k < 4; k++) p.plate("slot", cx - 0.1 + k * 0.06, cx - 0.06 + k * 0.06, b + 0.03, b + 0.038, zFace - 0.0005, zFace + 0.0005, 0.004);
      const kx = (x1 + w / 2) / 2;
      p.knob(kx, b + dh * 0.55, zBody + 0.003, d / 2, 0.018);
      pilotLamp(p, kx, b + dh * 0.85, zBody + 0.003, "oil", 0.005);
      p.roundedBox("satin", kx - 0.03, kx + 0.03, b + dh * 0.2 - 0.005, b + dh * 0.2 + 0.005, zBody + 0.003, zBody + 0.008, 0.003, "top", "z");
    }
  },
};

/** The base of the drawer cabinet: plinth, body and its top (m). */
function plinthAndBody(p: Parameters<KindDef["mesh"]>[0], w: number, d: number, h: number, zBody: number): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (w / 2 - 0.04), sz * (d / 2 - 0.05), 0.1);
  p.roundedBox("steelDark", -w / 2 + 0.04, w / 2 - 0.04, 0.012, 0.1, -d / 2 + 0.04, zBody - 0.05, 0.002, "vertical");
  p.roundedBox("steel", -w / 2, w / 2, 0.1, h - 0.04, -d / 2, zBody, BODY_RADIUS, "vertical");
  p.box("top", -w / 2 + 0.002, w / 2 - 0.002, 0.102, h - 0.042, zBody, zBody + 0.001);
  p.roundedBox("steel", -w / 2, w / 2, h - 0.04, h, -d / 2, d / 2, 0.003);
}
