// Small table-top units on a counter: the induction wok (Induktions-Wok: a black glass bowl in a
// stainless body), the conveyor toaster (Durchlauftoaster: a wire belt through a heated tunnel,
// the toast sliding out at the front), the egg boiler (Eierkocher: a water basin with baskets on
// lifting arms), the rice cooker (Reiskocher: a round pot with a domed lid) and the sous-vide
// bath (Sous-vide-Wasserbad: a GN tank with a circulator clamped to its back wall).

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, BOWL_RADIUS, GN_RADIUS, SHEET, TOP_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { frontSlots, gripX, pilot, tableFeet, topSlots } from "./details";
import { controlPanel, display, housing, ratingPlate } from "../parts/details";

/** Height of the short feet (m). */
const FEET = 0.02;

// ---------------------------------------------------------------------------------------------
// Induction wok

/** Depth of the wok bowl under the glass, and the height of the glass top over the body (m). */
const WOK_BOWL = 0.1;
const WOK_GLASS = 0.006;

export const wokTable: KindDef = {
  kind: "wokTable",
  placement: "tableTop",
  plan(s) {
    const r = Math.min(s.w, s.d - 100) / 2 - INSET;
    s.circle("detail", 0, s.B + INSET + r, r);
    s.circle("detail", 0, s.B + INSET + r, r * 0.5);
    s.line("detail", [s.L, s.F - 90], [s.R, s.F - 90]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, z0 + 40, top - 30, "item-dark");
    f.circle("detail", (l + r) / 2, (z0 + top) / 2 + 5, 15);
  },
  mesh(p, s) {
    const y0 = tableFeet(p, s.w, s.d, FEET, 0.035, 0.014);
    const zf = s.d / 2;
    const top = s.h - WOK_GLASS;
    const r = Math.min(s.w, s.d - 0.1) / 2 - 0.05;
    const cz = -s.d / 2 + 0.05 + r;
    // The body under the glass, set back at the front under the glass's edge: solid below the
    // bowl, only sheets round it.
    const zb = zf - 0.01;
    const yb = top - WOK_BOWL - 0.02;
    housing(p, "steel", -s.w / 2, s.w / 2, y0, yb + 0.01, -s.d / 2, zb, 0.006);
    for (const sx of [-1, 1]) p.roundedBox("steel", sx < 0 ? -s.w / 2 : s.w / 2 - SHEET, sx < 0 ? -s.w / 2 + SHEET : s.w / 2, yb, top, -s.d / 2, zb, BODY_RADIUS, "vertical");
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, yb, top, -s.d / 2, -s.d / 2 + SHEET);
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, yb, top, zb - 0.08, zb);
    // The black glass top with the round opening and the glass bowl under it, a bright ring on
    // its edge.
    p.topWithHoles("ceramic", s.w, s.d, top, s.h, [{ x0: -r, x1: r, z0: cz - r, z1: cz + r, r }]);
    p.tub("ceramic", -r, r, top - WOK_BOWL, top + 0.002, cz - r, cz + r, SHEET / 2, r);
    p.ring("handle", 0, cz, s.h - 0.003, r, 0.003);
    p.lathe("zone", 0, top - WOK_BOWL + SHEET / 2, cz, [
      [r * 0.4, 0],
      [r * 0.45, 0],
      [r * 0.45, 0.001],
      [r * 0.4, 0.001],
      [r * 0.4, 0],
    ]);
    // The front panel with the knob and a display.
    const py = (y0 + top) / 2;
    controlPanel(p, -s.w / 2 + 0.03, s.w / 2 - 0.03, y0 + 0.015, top - 0.02, zb - 0.002, zb + 0.001);
    p.knob(s.w * 0.2, py, zb + 0.001, zf, 0.02);
    display(p, -s.w * 0.12, py, Math.min(0.08, s.w * 0.25), 0.025, zb + 0.001);
  },
};

// ---------------------------------------------------------------------------------------------
// Conveyor toaster

/** Height of the tunnel opening at the front, and of the slide the toast comes out on (m). */
const TOASTER_OPENING = 0.07;
const TOASTER_SLIDE = 0.06;

export const conveyorToaster: KindDef = {
  kind: "conveyorToaster",
  placement: "tableTop",
  plan(s) {
    // The belt from the feed at the back of the top down through the tunnel, the slide in front.
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, s.B + s.d * 0.35);
    s.rect("detail", s.L + INSET, s.F - TOASTER_SLIDE * 2000, s.R - INSET, s.F);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const o0 = z0 + (FEET + TOASTER_SLIDE) * 1000;
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, o0, o0 + TOASTER_OPENING * 1000, "item-dark");
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, top - 90, top - 25);
    f.circle("detail", l + f.w * 0.3, top - 57, 15);
    f.circle("detail", l + f.w * 0.7, top - 57, 15);
  },
  mesh(p, s) {
    const y0 = tableFeet(p, s.w, s.d, FEET, 0.035, 0.014);
    const zf = s.d / 2;
    const zb = zf - 0.1;
    // The housing, open at the bottom of its front where the toast leaves the tunnel.
    const o0 = y0 + TOASTER_SLIDE;
    const o1 = o0 + TOASTER_OPENING;
    housing(p, "steel", -s.w / 2, s.w / 2, o1, s.h, -s.d / 2, zb, 0.006);
    housing(p, "steel", -s.w / 2, s.w / 2, y0, o0, -s.d / 2, zb, 0.004);
    for (const sx of [-1, 1]) p.roundedBox("steel", sx < 0 ? -s.w / 2 : s.w / 2 - SHEET, sx < 0 ? -s.w / 2 + SHEET : s.w / 2, o0 - 0.002, o1 + 0.002, -s.d / 2, zb, BODY_RADIUS, "vertical");
    p.box("top", -s.w / 2 + SHEET, s.w / 2 - SHEET, o0, o1, -s.d / 2 + 0.05, zb - 0.06);
    // The wire belt running out of the tunnel, and the slide in front catching the toast.
    p.grid(-s.w / 2 + SHEET * 2, s.w / 2 - SHEET * 2, o0 + 0.01, o0 + 0.016, zb - 0.06, zb - 0.004, 0.012, "x");
    p.extrude("steel", "x", -s.w / 2 + 0.02, s.w / 2 - 0.02, [
      [zb - 0.01, o0 + 0.004],
      [zf - 0.004, y0 + 0.004],
      [zf, y0 + 0.012],
      [zf - 0.01, y0 + 0.02],
      [zb - 0.002, o0 + 0.012],
    ]);
    // The feed at the back of the top: an opening with the belt in it.
    const fz0 = -s.d / 2 + 0.03;
    const fz1 = -s.d / 2 + s.d * 0.32;
    p.roundedBox("slot", -s.w / 2 + 0.03, s.w / 2 - 0.03, s.h - 0.0015, s.h, fz0, fz1, 0.01, "vertical");
    p.grid(-s.w / 2 + 0.04, s.w / 2 - 0.04, s.h - 0.03, s.h - 0.024, fz0 + 0.01, fz1 - 0.01, 0.012, "x");
    // The control panel across the top of the front: two knobs (speed, heat) and a pilot light.
    const zFace = zb + 0.003;
    controlPanel(p, -s.w / 2 + 0.02, s.w / 2 - 0.02, s.h - 0.1, s.h - 0.02, zb, zFace);
    p.knob(-s.w * 0.2, s.h - 0.06, zFace, zFace + 0.025, 0.02);
    p.knob(s.w * 0.2, s.h - 0.06, zFace, zFace + 0.025, 0.02);
    pilot(p, 0, s.h - 0.06, zFace);
    frontSlots(p, -s.w / 2 + 0.04, s.w / 2 - 0.04, o1 + 0.04, o1 + 0.06, zb, 8);
    topSlots(p, -s.w / 2 + 0.04, s.w / 2 - 0.04, fz1 + 0.04, fz1 + 0.1, s.h - 0.001, 8);
  },
};

// ---------------------------------------------------------------------------------------------
// Egg boiler

/** Baskets of the egg boiler, and their radius and depth (m). */
const EGG_BASKETS = 4;
const EGG_BASKET_R = 0.035;
const EGG_BASKET_H = 0.07;
/** Depth of the basin, and the height of the column carrying the lifting arms (m). */
const EGG_BASIN = 0.12;
const EGG_COLUMN = 0.09;

export const eggBoiler: KindDef = {
  kind: "eggBoiler",
  placement: "tableTop",
  plan(s) {
    const cols = EGG_BASKETS / 2;
    const cw = (s.w - INSET * 2) / cols;
    for (let c = 0; c < cols; c++) {
      for (let k = 0; k < 2; k++) s.circle("detail", s.L + INSET + cw * (c + 0.5), s.B + EGG_COLUMN * 1000 + 80 + k * 120, EGG_BASKET_R * 1000);
    }
    s.line("detail", [s.L, s.B + EGG_COLUMN * 1000], [s.R, s.B + EGG_COLUMN * 1000]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const b = top - EGG_BASIN * 1000 - 120;
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, z0 + 40, b);
    f.line("detail", [l, top - EGG_BASIN * 1000 - 20], [r, top - EGG_BASIN * 1000 - 20]);
    for (let i = 0; i < 2; i++) f.circle("detail", l + f.w * (0.3 + i * 0.4), (z0 + b) / 2, 15);
  },
  mesh(p, s) {
    const y0 = tableFeet(p, s.w, s.d, FEET, 0.035, 0.014);
    const zf = s.d / 2;
    const rim = s.h - 0.11;
    const zc = -s.d / 2 + EGG_COLUMN;
    // The body with the basin let into its top, the column with the arms at the back.
    const holes = [{ x0: -s.w / 2 + 0.03, x1: s.w / 2 - 0.03, z0: zc + 0.01, z1: zf - 0.03 }];
    // The body stands back a little under the top's front edge, the panel on its front.
    const zb = zf - 0.012;
    housing(p, "steel", -s.w / 2, s.w / 2, y0, rim - EGG_BASIN - 0.01, -s.d / 2, zb, 0.006);
    for (const sx of [-1, 1]) p.box("steel", sx < 0 ? -s.w / 2 : s.w / 2 - SHEET, sx < 0 ? -s.w / 2 + SHEET : s.w / 2, rim - EGG_BASIN - 0.02, rim - 0.01, -s.d / 2, zb);
    p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, rim - EGG_BASIN - 0.02, rim - 0.01, zb - SHEET, zb);
    p.topWithHoles("steel", s.w, s.d, rim - 0.012, rim, holes);
    const h = holes[0];
    p.tub("steelDark", h.x0, h.x1, rim - EGG_BASIN, rim, h.z0, h.z1, SHEET / 2);
    p.roundedBox("water", h.x0 + 0.005, h.x1 - 0.005, rim - EGG_BASIN + 0.005, rim - 0.035, h.z0 + 0.005, h.z1 - 0.005, BOWL_RADIUS - 0.005, "vertical");
    housing(p, "steel", -s.w / 2, s.w / 2, rim - 0.002, s.h, -s.d / 2, zc, 0.006);
    // The baskets, two rows, each hanging on its arm from the column with a black knob on top.
    const cols = EGG_BASKETS / 2;
    const cw = (h.x1 - h.x0) / cols;
    for (let c = 0; c < cols; c++) {
      for (let k = 0; k < 2; k++) {
        const x = h.x0 + cw * (c + 0.5);
        const z = h.z0 + 0.06 + k * 0.12;
        p.wireCage(x, z, rim - 0.03 - EGG_BASKET_H, rim - 0.03, EGG_BASKET_R, 8);
        const ay = s.h - 0.03 - k * 0.025;
        p.tube("handle", [
          { x, y: rim - 0.034, z },
          { x, y: ay, z },
          { x, y: ay, z: zc - 0.01 },
        ], 0.003, { bend: 0.01 });
        p.lathe("knob", x, ay + 0.002, z, [
          [0, 0],
          [0.008, 0],
          [0.009, 0.01],
          [0.006, 0.016],
          [0, 0.016],
        ]);
      }
    }
    // The panel: one timer knob per basket row and a switch.
    const zFace = zb + 0.003;
    const py = (y0 + rim - EGG_BASIN) / 2;
    controlPanel(p, -s.w / 2 + 0.03, s.w / 2 - 0.03, y0 + 0.03, rim - EGG_BASIN - 0.025, zb - 0.002, zFace);
    for (let i = 0; i < cols; i++) p.knob(h.x0 + cw * (i + 0.5), py, zFace, zf, 0.018);
    pilot(p, 0, py - 0.04, zFace);
    ratingPlate(p, s.w / 2 - 0.065, y0 + 0.0175, zb, 0.05, 0.015);
  },
};

// ---------------------------------------------------------------------------------------------
// Rice cooker

/** Height of the lid's dome over the pot's rim (m). */
const RICE_LID = 0.08;

export const riceCooker: KindDef = {
  kind: "riceCooker",
  placement: "tableTop",
  plan(s) {
    const r = Math.min(s.w, s.d) / 2 - INSET;
    s.circle("detail", 0, 0, r);
    s.circle("detail", 0, 0, r * 0.2);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const rim = top - RICE_LID * 1000;
    f.line("detail", [l + 30, rim], [r - 30, rim]);
    f.box("detail", (l + r) / 2 - 50, (l + r) / 2 + 50, z0 + 60, z0 + 130, "item-dark");
  },
  mesh(p, s) {
    const R = Math.min(s.w, s.d) / 2;
    const r = R - 0.04;
    const rim = s.h - RICE_LID;
    // The round body on a dark base ring, its side handles standing out to the full size.
    p.lathe("steelDark", 0, 0, 0, [
      [0, 0],
      [r * 0.9, 0],
      [r * 0.92, 0.012],
      [r * 0.95, 0.02],
      [0, 0.02],
    ]);
    p.lathe("steel", 0, 0.018, 0, [
      [0, 0],
      [r * 0.95, 0],
      [r, 0.03],
      [r, rim - 0.018 - 0.012],
      [r - 0.004, rim - 0.018],
      [0, rim - 0.018],
    ]);
    // The lid: a domed cover with a turned knob and the steam vent.
    p.lathe("satin", 0, rim - 0.004, 0, [
      [0, 0],
      [r + 0.006, 0],
      [r + 0.006, 0.01],
      [r * 0.85, RICE_LID * 0.45],
      [r * 0.5, RICE_LID * 0.7],
      [0, RICE_LID * 0.76],
    ]);
    p.lathe("knob", 0, rim - 0.004 + RICE_LID * 0.74, 0, [
      [0, 0],
      [0.03, 0],
      [0.032, 0.006],
      [0.022, RICE_LID * 0.26 + 0.004],
      [0, RICE_LID * 0.26 + 0.004],
    ]);
    p.lathe("knob", r * 0.55, rim + RICE_LID * 0.52, -r * 0.2, [
      [0, 0],
      [0.012, 0],
      [0.012, 0.012],
      [0, 0.012],
    ]);
    for (const sx of [-1, 1]) {
      const x0 = sx * (r - 0.004);
      const x1 = sx * R;
      p.tube("knob", [
        { x: x0, y: rim - 0.06, z: -0.05 },
        { x: (x1 * 0.7 + x0 * 0.3), y: rim - 0.05, z: -0.05 },
        { x: (x1 * 0.7 + x0 * 0.3), y: rim - 0.05, z: 0.05 },
        { x: x0, y: rim - 0.06, z: 0.05 },
      ], 0.01, { bend: 0.015 });
      p.roundedBox("knob", Math.min(x1 - sx * 0.022, x1), Math.max(x1 - sx * 0.022, x1), rim - 0.062, rim - 0.038, -0.03, 0.03, 0.008);
    }
    // The switch box on the front with the cook switch and the cook and keep-warm lights, the
    // lid's hinge block at the back.
    const zf = R;
    const zFace = zf - 0.012;
    p.roundedBox("panelDark", -0.065, 0.065, 0.06, 0.15, r - 0.02, zFace, 0.01, "top", "z");
    p.roundedBox("knob", -0.02, 0.02, 0.075, 0.115, zFace - 0.004, zf, 0.006, "top", "z");
    pilot(p, -0.04, 0.132, zFace, 0.005);
    pilot(p, 0.04, 0.132, zFace, 0.005);
    p.roundedBox("steelDark", -0.045, 0.045, rim - 0.03, rim + 0.025, -R, -r + 0.01, 0.006);
  },
};

// ---------------------------------------------------------------------------------------------
// Sous-vide water bath

/** Height of the tank, the radius of the circulator and its depth from the back (m). */
const SV_TANK = 0.2;
const SV_HEAD = 0.035;

export const sousVide: KindDef = {
  kind: "sousVide",
  placement: "tableTop",
  plan(s) {
    s.rect("detail", s.L + 15, s.B + 15, s.R - 15, s.F - 15);
    s.circle("detail", 0, s.B + 70, SV_HEAD * 1000);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const c = (l + r) / 2;
    f.line("detail", [l, z0 + (SV_TANK + FEET) * 1000 - 15], [r, z0 + (SV_TANK + FEET) * 1000 - 15]);
    f.box("detail", c - SV_HEAD * 1000, c + SV_HEAD * 1000, z0 + (SV_TANK + FEET) * 1000 - 60, top);
  },
  mesh(p, s) {
    const y0 = tableFeet(p, s.w, s.d, FEET, 0.03, 0.012);
    const rim = y0 + SV_TANK;
    // The tank: a GN container with its rim, water in it and vacuum bags of food.
    p.pan("steel", -s.w / 2, s.w / 2, y0, rim, -s.d / 2, s.d / 2, { wall: 0.003, r: GN_RADIUS * 2, rim: 0.012 });
    const iw = s.w / 2 - 0.02;
    const id = s.d / 2 - 0.02;
    p.roundedBox("water", -iw, iw, y0 + 0.006, rim - 0.03, -id, id, GN_RADIUS, "vertical");
    for (let i = 0; i < 3; i++) {
      const z = -id + 0.15 + i * ((2 * id - 0.18) / 3);
      p.roundedBox(i === 1 ? "foodBrown" : "foodRed", -iw + 0.03, iw - 0.03, y0 + 0.03 + i * 0.012, y0 + 0.055 + i * 0.012, z - 0.05, z + 0.05, 0.012);
    }
    // The circulator clamped on the back wall: a tube in the water, the head with a display and
    // a knob over the rim.
    const cz = -s.d / 2 + 0.07;
    p.lathe("satin", 0, y0 + 0.03, cz, [
      [0, 0],
      [SV_HEAD * 0.8, 0],
      [SV_HEAD * 0.8, rim - y0 - 0.03],
      [0, rim - y0 - 0.03],
    ]);
    p.lathe("paintGray", 0, rim, cz, [
      [0, 0],
      [SV_HEAD, 0],
      [SV_HEAD, s.h - rim - 0.02],
      [SV_HEAD * 0.9, s.h - rim - 0.004],
      [SV_HEAD * 0.6, s.h - rim],
      [0, s.h - rim],
    ]);
    p.roundedBox("steelDark", -0.02, 0.02, rim - 0.05, rim + 0.02, -s.d / 2 + 0.005, cz - SV_HEAD * 0.8, BODY_RADIUS);
    display(p, 0, s.h - 0.045, SV_HEAD * 1.1, 0.02, cz + SV_HEAD - 0.002);
    p.knob(0, s.h - 0.08, cz + SV_HEAD - 0.003, cz + SV_HEAD + 0.015, 0.012);
    // A light lid over the front part of the tank keeps the heat in.
    p.roundedBox("steel", -s.w / 2 + 0.006, s.w / 2 - 0.006, rim, rim + 0.008, cz + SV_HEAD + 0.02, s.d / 2 - 0.006, TOP_RADIUS);
    gripX(p, -0.05, 0.05, rim + 0.016, s.d / 2 - 0.05, 0.007);
  },
};
