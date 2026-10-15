// Trolleys of the dish return and the dish room: the cutlery soaking trolley (a tub of water with
// cutlery quivers in it), the tray return trolley (two columns of tray runners, open front and
// back, closed sides) and the rack dispenser (a spring-loaded stack of dish racks that keeps the
// top rack at working height). All stand on swivel castors.

import { INSET as FRONT_INSET, LEG as FRONT_LEG } from "../parts/elevation";
import { BODY_RADIUS, castor, LEG, LEG_RADIUS, SHEET, TOP, TOP_RADIUS, type Parts } from "../parts/mesh";
import { INSET, type PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { plasticRack } from "./details";

/** Wheel radius of the castors and the height of the frame's base above the floor (m). */
const WHEEL = 0.05;
const BASE = 0.13;

/** Castors under the corners of a trolley w × d, inset by the wheel's radius (m). */
function castors(p: Parts, w: number, d: number, top = BASE - 0.02): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) castor(p, sx * (w / 2 - WHEEL), sz * (d / 2 - WHEEL), WHEEL, top);
}

/** Castors in the plan (mm). */
function castorsPlan(s: PlanSketch): void {
  const r = WHEEL * 1000;
  for (const x of [s.L + r, s.R - r]) for (const y of [s.B + r, s.F - r]) s.circle("detail", x, y, r * 0.5);
}

// ---------------------------------------------------------------------------------------------
// Cutlery soaking trolley (Besteckeinweichwagen)

/** The tub (m): margin from the frame's edges and depth. */
const TUB_MARGIN = 0.06;
const TUB_DEPTH = 0.2;
/** Room at the right end of the top for the push handle (m). */
const HANDLE_ROOM = 0.06;
/** Cutlery quivers standing in the tub: radius and height (m). */
const QUIVER = { r: 0.045, h: 0.17 };

export const cutlerySoakTrolley: KindDef = {
  kind: "cutlerySoakTrolley",
  plan(s) {
    const m = TUB_MARGIN * 1000;
    s.rect("detail", s.L + m, s.B + m, s.R - m - 60, s.F - m);
    const n = quiverCount(s.w / 1000);
    for (let i = 0; i < n; i++) s.circle("detail", s.L + m + ((s.w - 2 * m - 60) * (i + 0.5)) / n, 0, QUIVER.r * 1000);
    s.line("detail", [s.R - 25, s.B + m], [s.R - 25, s.F - m]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const z = (v: number) => z0 + v * 1000;
    f.worktop();
    f.box("hidden", l + TUB_MARGIN * 1000, r - TUB_MARGIN * 1000 - 60, top - TUB_DEPTH * 1000, top - FRONT_INSET);
    f.box("detail", l, l + FRONT_LEG, z(BASE), top - 40);
    f.box("detail", r - FRONT_LEG - 60, r - 60, z(BASE), top - 40);
    f.line("detail", [l + FRONT_LEG, z(BASE + 0.03)], [r - 60, z(BASE + 0.03)]);
    f.line("detail", [r - 25, top - 120], [r - 25, top]);
    for (const x of [l + WHEEL * 1000, r - WHEEL * 1000]) f.circle("detail", x, z(WHEEL), WHEEL * 1000);
  },
  mesh(p, s) {
    const x1 = s.w / 2 - HANDLE_ROOM;
    const yTop = s.h - 0.06;
    castors(p, s.w, s.d);
    // The frame: corner posts, a bottom shelf and the top with the tub let into it.
    for (const x of [-s.w / 2, x1 - LEG]) {
      for (const z of [-s.d / 2, s.d / 2 - LEG]) p.roundedBox("steel", x, x + LEG, BASE - 0.02, yTop - TOP, z, z + LEG, LEG_RADIUS, "vertical");
    }
    p.roundedBox("steel", -s.w / 2, x1, BASE, BASE + SHEET * 2, -s.d / 2 + 0.005, s.d / 2 - 0.005, TOP_RADIUS);
    const t = { x0: -s.w / 2 + TUB_MARGIN, x1: x1 - TUB_MARGIN, z0: -s.d / 2 + TUB_MARGIN, z1: s.d / 2 - TUB_MARGIN };
    p.topWithHoles("steel", s.w, s.d, yTop - TOP, yTop, [t]);
    p.tub("steel", t.x0, t.x1, yTop - TUB_DEPTH, yTop, t.z0, t.z1);
    p.roundedBox("water", t.x0 + 0.012, t.x1 - 0.012, yTop - TUB_DEPTH + 0.012, yTop - 0.07, t.z0 + 0.012, t.z1 - 0.012, 0.008, "vertical");
    // Cutlery quivers standing in the water, a few handles sticking out of each.
    const n = quiverCount(s.w);
    for (let i = 0; i < n; i++) {
      const qx = t.x0 + ((t.x1 - t.x0) * (i + 0.5)) / n;
      const qy = yTop - TUB_DEPTH + 0.012;
      p.lathe("satin", qx, qy, 0, [
        [0, 0],
        [QUIVER.r * 0.9, 0],
        [QUIVER.r, 0.01],
        [QUIVER.r, QUIVER.h],
        [QUIVER.r - 0.002, QUIVER.h],
        [QUIVER.r - 0.002, 0.012],
        [0, 0.012],
      ]);
      for (const [dx, dz, lean] of [
        [-0.015, -0.01, -0.012],
        [0.012, -0.014, 0.01],
        [0.004, 0.016, 0.004],
      ]) {
        p.bar("handle", { x: qx + dx, y: qy + 0.03, z: dz }, { x: qx + dx + lean, y: Math.min(s.h - 0.01, qy + QUIVER.h + 0.09), z: dz + lean * 0.5 }, 0.004);
      }
    }
    // The push handle at the right end, bent up from the frame.
    p.tube("handle", [
      { x: s.w / 2 - 0.03, y: yTop, z: -s.d / 2 + 0.06 },
      { x: s.w / 2 - 0.03, y: s.h - 0.014, z: -s.d / 2 + 0.06 },
      { x: s.w / 2 - 0.03, y: s.h - 0.014, z: s.d / 2 - 0.06 },
      { x: s.w / 2 - 0.03, y: yTop, z: s.d / 2 - 0.06 },
    ], 0.014, { bend: 0.04 });
  },
};

/** Quivers in a row in a tub on a trolley `w` wide (m). */
const quiverCount = (w: number) => Math.max(2, Math.min(6, Math.floor((w - 0.2) / 0.11)));

// ---------------------------------------------------------------------------------------------
// Tray return trolley (Tablettrückgabewagen)

/** Levels of tray runners from this height to this distance below the top (m). */
const TRAY_FIRST = 0.3;
const TRAY_LAST = 0.14;
const TRAY_PITCH = 0.12;
/** A tray (m): its size and how many levels hold one in the model. */
const TRAY = { w: 0.37, d: 0.53, t: 0.018 };
/** Side panel and middle wall (m). */
const PANEL_T = 0.012;

/** Heights of the tray levels of a trolley `h` high (m). */
function trayLevels(h: number): number[] {
  const n = Math.max(2, Math.floor((h - TRAY_LAST - TRAY_FIRST) / TRAY_PITCH) + 1);
  const step = (h - TRAY_LAST - TRAY_FIRST) / (n - 1);
  return Array.from({ length: n }, (_, i) => TRAY_FIRST + i * step);
}

/** Which levels of a column hold a tray in the model (a half-filled trolley). */
const loaded = (col: number, i: number) => (i + col) % 3 !== 2 && i < 6;

export const trayReturnTrolley: KindDef = {
  kind: "trayReturnTrolley",
  plan(s) {
    castorsPlan(s);
    const pt = PANEL_T * 1000;
    s.line("detail", [s.L + pt, s.B], [s.L + pt, s.F]);
    s.line("detail", [s.R - pt, s.B], [s.R - pt, s.F]);
    s.line("detail", [0, s.B], [0, s.F]);
    const tw = Math.min(TRAY.w * 1000, s.w / 2 - pt * 2 - 20);
    const td = Math.min(TRAY.d * 1000, s.d - 20);
    for (const sx of [-1, 1]) s.rect("hidden", (sx * s.w) / 4 - tw / 2, -td / 2, (sx * s.w) / 4 + tw / 2, td / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const c = (l + r) / 2;
    const z = (v: number) => z0 + v * 1000;
    f.box("detail", l, l + PANEL_T * 1000, z(BASE), top);
    f.box("detail", r - PANEL_T * 1000, r, z(BASE), top);
    f.line("detail", [c, z(BASE)], [c, top]);
    f.box("detail", l, r, z(BASE - 0.03), z(BASE));
    for (const y of trayLevels(f.item.height / 1000)) {
      f.line("detail", [l + PANEL_T * 1000, z(y)], [c - 10, z(y)]);
      f.line("detail", [c + 10, z(y)], [r - PANEL_T * 1000, z(y)]);
    }
    for (const x of [l + WHEEL * 1000, r - WHEEL * 1000]) f.circle("detail", x, z(WHEEL), WHEEL * 1000);
    f.line("detail", [l + FRONT_INSET, top - 20], [r - FRONT_INSET, top - 20]);
  },
  mesh(p, s) {
    const x0 = -s.w / 2;
    const x1 = s.w / 2;
    castors(p, s.w, s.d);
    // The base frame, the two closed side panels with a grip cut-out, the middle wall and the top.
    p.roundedBox("steel", x0, x1, BASE - 0.03, BASE, -s.d / 2, s.d / 2, BODY_RADIUS);
    for (const sx of [-1, 1]) {
      // The panel stands a millimetre in from the side, so the grip's dark cut-out lies on it.
      const xo = (sx * s.w) / 2;
      const xi = xo - sx * PANEL_T;
      const xm = xo - sx * 0.001;
      p.roundedBox("steel", Math.min(xi, xm), Math.max(xi, xm), BASE, s.h - 0.02, -s.d / 2, s.d / 2, BODY_RADIUS, "all");
      p.roundedBox("slot", Math.min(xo, xm - sx * 0.0005), Math.max(xo, xm - sx * 0.0005), s.h - 0.13, s.h - 0.09, -0.12, 0.12, 0.02, "vertical", "x");
    }
    p.roundedBox("steel", -PANEL_T / 2, PANEL_T / 2, BASE, s.h - 0.02, -s.d / 2 + 0.02, s.d / 2 - 0.02, BODY_RADIUS, "vertical");
    p.roundedBox("steel", x0, x1, s.h - 0.02, s.h, -s.d / 2, s.d / 2, TOP_RADIUS);
    // Runners along the depth at every level on both sides of each column, trays on some.
    const levels = trayLevels(s.h);
    const ri = 0.012;
    const tw = Math.min(TRAY.w, s.w / 2 - PANEL_T * 1.5 - 0.02);
    const td = Math.min(TRAY.d, s.d - 0.02);
    for (const [col, a, b] of [
      [0, x0 + PANEL_T, -PANEL_T / 2],
      [1, PANEL_T / 2, x1 - PANEL_T],
    ] as const) {
      const cx = (a + b) / 2;
      levels.forEach((y, i) => {
        for (const x of [a + ri / 2, b - ri / 2]) p.rod("steelDark", "z", x, y - 0.004, 0, s.d - 0.04, 0.004);
        if (!loaded(col, i)) return;
        p.roundedBox("paintGray", cx - tw / 2, cx + tw / 2, y, y + TRAY.t, -td / 2, td / 2, 0.008);
        // A used plate and a cup on the tray.
        p.lathe("panel", cx - tw * 0.1, y + TRAY.t - 0.002, -td * 0.12, [
          [0, 0],
          [0.07, 0],
          [0.12, 0.016],
          [0.13, 0.02],
          [0.12, 0.02],
          [0.06, 0.008],
          [0, 0.008],
        ]);
        if (col === 0 && i % 2 === 0) p.lathe("panel", cx + tw * 0.25, y + TRAY.t - 0.002, td * 0.3, [
          [0, 0],
          [0.028, 0],
          [0.04, 0.07],
          [0.036, 0.07],
          [0.024, 0.008],
          [0, 0.008],
        ]);
      });
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Rack dispenser (Korbspender)

/** Size and height of the dish racks in the stack (m). */
const RACK = 0.5;
const RACK_H = 0.1;

/** Racks in the stack of a dispenser `h` high (m): from the platform up to the top. */
const rackCount = (h: number) => Math.max(1, Math.floor((h - BASE - 0.06) / RACK_H));

export const rackDispenser: KindDef = {
  kind: "rackDispenser",
  plan(s) {
    castorsPlan(s);
    const r = Math.min(RACK * 1000, s.w - 2 * INSET, s.d - 2 * INSET) / 2;
    s.rect("detail", -r, -r, r, r);
    s.rect("detail", -r + INSET / 2, -r + INSET / 2, r - INSET / 2, r - INSET / 2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const c = (l + r) / 2;
    const z = (v: number) => z0 + v * 1000;
    const half = Math.min(RACK * 500, f.w / 2 - FRONT_INSET);
    f.box("detail", l, r, z(BASE - 0.03), z(BASE + 0.02));
    for (const x of [l, r - FRONT_LEG]) f.box("detail", x, x + FRONT_LEG, z(BASE + 0.02), top);
    const n = rackCount(f.item.height / 1000);
    for (let i = 0; i < n; i++) f.box("detail", c - half, c + half, top - (i + 1) * RACK_H * 1000, top - i * RACK_H * 1000 - 4);
    for (const x of [l + WHEEL * 1000, r - WHEEL * 1000]) f.circle("detail", x, z(WHEEL), WHEEL * 1000);
  },
  mesh(p, s) {
    castors(p, s.w, s.d);
    // The base with a rubber bumper round it, the four corner guides with the top frame.
    p.roundedBox("steel", -s.w / 2 + 0.01, s.w / 2 - 0.01, BASE - 0.03, BASE + 0.02, -s.d / 2 + 0.01, s.d / 2 - 0.01, BODY_RADIUS);
    p.lathe("rubber", 0, BASE - 0.025, 0, [
      [0.006, 0],
      [0.02, 0],
      [0.02, 0.04],
      [0.006, 0.04],
      [0.006, 0],
    ], { rect: [s.w / 2 - 0.02, s.d / 2 - 0.02], caps: false });
    const g = LEG;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - 0.02 - g / 2);
        const z = sz * (s.d / 2 - 0.02 - g / 2);
        p.roundedBox("steel", x - g / 2, x + g / 2, BASE + 0.02, s.h - 0.02, z - g / 2, z + g / 2, LEG_RADIUS, "vertical");
      }
    }
    p.lathe("steel", 0, s.h - 0.02, 0, [
      [0.01, 0],
      [0.02, 0],
      [0.02, 0.02],
      [0.01, 0.02],
      [0.01, 0],
    ], { rect: [s.w / 2 - 0.04, s.d / 2 - 0.04], caps: false });
    // The stack of racks on the spring-loaded platform, the top rack just under the frame.
    const rack = Math.min(RACK, s.w - 0.13, s.d - 0.13);
    const n = rackCount(s.h);
    for (let i = 0; i < n; i++) plasticRack(p, 0, 0, s.h - 0.04 - (i + 1) * RACK_H, rack, RACK_H - 0.004);
    const platform = s.h - 0.04 - n * RACK_H;
    if (platform > BASE + 0.04) p.roundedBox("steelDark", -rack / 2, rack / 2, platform - 0.01, platform, -rack / 2, rack / 2, BODY_RADIUS);
  },
};
