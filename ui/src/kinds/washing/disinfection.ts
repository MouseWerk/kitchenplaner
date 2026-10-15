// Hand disinfection (Händedesinfektion): the wall dispenser with an elbow lever over a drip tray,
// and the free-standing column (Desinfektionssäule) with a touchless dispenser, a drip tray and a
// sign holder at its top, for the entrance of a kitchen or a changing room.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, foot, TOP_RADIUS, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { wallDispenser } from "./details";

/** Wall plate behind the dispenser (m). */
const PLATE = 0.006;
/** Height of the drip tray at the bottom (m) and the room between it and the dispenser. */
const TRAY = 0.03;
const UNDER = 0.07;
/** How far the dispenser's body stays back from the front, for its lever (m). */
const LEVER = 0.018;

/** A small drip tray from x0 to x1 at y0 (m), from the wall to `zFront`: a pressed pan. */
function dripTray(p: Parts, x0: number, x1: number, y0: number, z0: number, z1: number): void {
  p.pan("satin", x0, x1, y0, y0 + TRAY, z0, z1, { wall: 0.002, r: 0.012 });
}

export const disinfectionDispenser: KindDef = {
  kind: "disinfectionDispenser",
  placement: "overhead",
  plan(s) {
    s.rect("detail", s.L + INSET / 4, s.B + PLATE * 1000, s.R - INSET / 4, s.F - LEVER * 1000);
    s.line("detail", [0, s.F - LEVER * 1000], [0, s.F]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const I = FRONT_INSET;
    const c = (l + r) / 2;
    const body = z0 + UNDER * 1000;
    f.box("detail", l + I / 8, r - I / 8, body, top - I / 8);
    f.box("detail", c - f.w / 4, c + f.w / 4, body + (top - body) * 0.4, top - (top - body) * 0.12, "glass");
    f.line("detail", [c, top - (top - body) * 0.08], [c, body + (top - body) * 0.15]);
    f.box("detail", l + I / 8, r - I / 8, z0, z0 + TRAY * 1000);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    p.roundedBox("steel", -s.w / 2, s.w / 2, 0, s.h, zb, zb + PLATE, BODY_RADIUS, "top", "z");
    wallDispenser(p, -s.w / 2 + 0.005, s.w / 2 - 0.005, UNDER, s.h - 0.005, zb + PLATE, zf - LEVER, "lever");
    // The outlet nozzle under the body and the drip tray under it.
    p.lathe("knob", 0, UNDER - 0.012, zf - LEVER - 0.03, [
      [0, 0],
      [0.006, 0],
      [0.01, 0.012],
      [0, 0.012],
    ]);
    dripTray(p, -s.w / 2 + 0.005, s.w / 2 - 0.005, 0, zb + PLATE, zf);
  },
};

/** The disinfection column (m): base plate, column, dispenser head, sign holder. */
const BASE = 0.012;
const COLUMN = 0.06;
const HEAD = { w: 0.13, h: 0.26, d: 0.11 };
const SIGN = { w: 0.3, h: 0.22 };

/** Heights of the dispenser head and the sign of a column `h` high (m). */
function column(h: number) {
  const signTop = h;
  const sign0 = h - Math.min(SIGN.h, h * 0.18);
  const head1 = sign0 - 0.03;
  const head0 = head1 - Math.min(HEAD.h, h * 0.2);
  return { sign0, signTop, head0, head1, tray: head0 - 0.12 };
}

export const disinfectionStand: KindDef = {
  kind: "disinfectionStand",
  plan(s) {
    const c = COLUMN * 500;
    s.rect("detail", -c, -c - INSET, c, c - INSET);
    s.rect("detail", -HEAD.w * 500, c - INSET, HEAD.w * 500, Math.min(s.F - INSET / 4, c - INSET + HEAD.d * 1000));
  },
  elevation(f) {
    const { z0 } = f;
    const c = (f.l + f.r) / 2;
    const k = column(f.item.height / 1000);
    const z = (v: number) => z0 + v * 1000;
    f.box("detail", f.l, f.r, z0, z0 + BASE * 1000);
    f.box("detail", c - COLUMN * 500, c + COLUMN * 500, z0 + BASE * 1000, z(k.sign0));
    f.box("detail", c - HEAD.w * 500, c + HEAD.w * 500, z(k.head0), z(k.head1));
    f.box("detail", c - HEAD.w * 300, c + HEAD.w * 300, z(k.head0) + 40, z(k.head1) - 40, "glass");
    f.box("detail", c - HEAD.w * 500, c + HEAD.w * 500, z(k.tray), z(k.tray) + 30);
    const sw = Math.min(SIGN.w * 500, f.w / 2);
    f.box("detail", c - sw, c + sw, z(k.sign0), z(k.signTop));
  },
  mesh(p, s) {
    const k = column(s.h);
    const zc = -0.05;
    // The base plate on four flat feet, the column of square tube.
    p.roundedBox("steel", -s.w / 2, s.w / 2, 0.006, 0.006 + BASE, -s.d / 2, s.d / 2, 0.02, "vertical");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (s.w / 2 - 0.04), sz * (s.d / 2 - 0.04), 0.006, 0.02);
    p.roundedBox("steel", -COLUMN / 2, COLUMN / 2, 0.006 + BASE, k.sign0 + 0.02, zc - COLUMN / 2, zc + COLUMN / 2, 0.006, "vertical");
    // The touchless dispenser on the column's front, its sensor window and the drip tray.
    const zh = zc + COLUMN / 2;
    const hz1 = Math.min(s.d / 2 - 0.01, zh + HEAD.d);
    wallDispenser(p, -HEAD.w / 2, HEAD.w / 2, k.head0, k.head1, zh, hz1, "soap");
    p.plate("glassDark", -0.012, 0.012, k.head0 + 0.012, k.head0 + 0.02, hz1 - 0.0005, hz1 + 0.001, 0.003, true);
    p.roundedBox("steel", -0.01, 0.01, k.tray, k.tray + 0.02, zh, zh + 0.03, 0.004);
    dripTray(p, -HEAD.w / 2, HEAD.w / 2, k.tray, zh + 0.02, hz1);
    // The sign holder at the top: a satin frame with a white sign.
    const sw = Math.min(SIGN.w, s.w);
    p.roundedBox("satin", -sw / 2, sw / 2, k.sign0, k.signTop, zh - 0.004, zh + 0.008, TOP_RADIUS, "all");
    p.plate("panel", -sw / 2 + 0.012, sw / 2 - 0.012, k.sign0 + 0.012, k.signTop - 0.012, zh + 0.0075, zh + 0.009, 0.004);
  },
};
