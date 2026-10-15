// Boot washer (Stiefelwaschanlage): a walk-through tub at the entrance of the kitchen or the
// production. The staff walk over a grate from left to right: brush rollers under it clean the
// soles, upright brushes at both sides the uppers, water and cleaning agent spray onto them.
// Handrails run along both sides, the control box with its emergency stop sits on a post.

import { INSET as FRONT_INSET, LEG as FRONT_LEG } from "../parts/elevation";
import { BODY_RADIUS, foot, SHELF_PITCH, TOP_RADIUS, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { flowArrow } from "./common";
import { button } from "./details";
import { HOUSING_RADIUS } from "../parts/details";

/** Height of the tub with the grate on it (m). */
const TUB = 0.22;
/** Radius of the sole brush rollers and the side brushes (m). */
const ROLLER = 0.05;
const SIDE_BRUSH = 0.06;
/** Height of the side brushes above the grate (m). */
const SIDE_H = 0.3;
/** Handrail: post radius, rail radius and their distance from the sides (m). */
const POST = 0.02;
const RAIL = 0.017;

/** A brush: a dark core with the bristles round it, turned along `axis` (m). */
function brush(p: Parts, x: number, y: number, z: number, r: number, len: number, axis: "y" | "z"): void {
  p.lathe("knob", x, y, z, [
    [0, 0],
    [r * 0.85, 0],
    [r, r * 0.25],
    [r, len - r * 0.25],
    [r * 0.85, len],
    [0, len],
  ], { axis });
}

export const bootWasher: KindDef = {
  kind: "bootWasher",
  plan(s) {
    const g = (POST * 4 + 0.02) * 1000;
    s.rect("detail", s.L + INSET, s.B + g + INSET, s.R - INSET, s.F - g - INSET);
    const p2 = POST * 2000;
    for (const y of [s.B + p2, s.F - p2]) s.line("detail", [s.L + p2, y], [s.R - p2, y]);
    for (const x of [-120, 0, 120]) s.line("detail", [x, s.B + g + INSET * 2], [x, s.F - g - INSET * 2]);
    flowArrow(s, s.L + INSET * 3, s.R - INSET * 3, 0, "right");
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const z = (v: number) => z0 + v * 1000;
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, z0, z(TUB));
    for (const x of [l, r - FRONT_LEG]) f.box("detail", x, x + FRONT_LEG, z(TUB), top);
    f.line("detail", [l + FRONT_LEG, top - 20], [r - FRONT_LEG, top - 20]);
    f.line("detail", [l + FRONT_LEG, z(TUB + 0.5)], [r - FRONT_LEG, z(TUB + 0.5)]);
    const c = (l + r) / 2;
    f.box("detail", c - 70, c + 70, z(TUB), z(TUB + SIDE_H));
    f.box("detail", r - FRONT_LEG - 160, r - FRONT_LEG - 10, top - 300, top - 80);
  },
  mesh(p, s) {
    const zb = -s.d / 2;
    const zf = s.d / 2;
    // Posts stand in by their foot flange's radius.
    const zr = zf - POST * 2;
    const inner = s.d / 2 - POST * 4 - 0.01;
    // The tub on feet, its rim rounded, the grate over the sole brushes.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (s.w / 2 - 0.08), sz * (inner - 0.04), 0.05, 0.02);
    p.roundedBox("steel", -s.w / 2 + 0.04, s.w / 2 - 0.04, 0.05, TUB - 0.02, -inner, inner, HOUSING_RADIUS);
    p.roundedBox("steel", -s.w / 2 + 0.04, s.w / 2 - 0.04, TUB - 0.024, TUB - 0.004, -inner, inner, TOP_RADIUS);
    for (const x of [-0.12, 0, 0.12]) brush(p, x, TUB - 0.02 - ROLLER - 0.01, -inner + 0.03, ROLLER, inner * 2 - 0.06, "z");
    p.box("slot", -s.w / 2 + 0.1, s.w / 2 - 0.1, TUB - 0.0045, TUB - 0.0035, -inner + 0.05, inner - 0.05);
    p.grid(-s.w / 2 + 0.1, s.w / 2 - 0.1, TUB - 0.004, TUB + 0.004, -inner + 0.05, inner - 0.05, SHELF_PITCH, "x");
    // The upright brushes at both sides of the walkway, with their spray bars behind them.
    for (const sz of [-1, 1]) {
      const z = sz * (inner - SIDE_BRUSH - 0.01);
      brush(p, 0, TUB, z, SIDE_BRUSH, SIDE_H, "y");
      p.roundedBox("steel", -0.12, 0.12, TUB, TUB + SIDE_H + 0.03, sz * inner - 0.01, sz * inner + 0.01, BODY_RADIUS, "top");
    }
    // Handrails on posts along both sides, a middle rail lower down.
    const px = s.w / 2 - POST * 2;
    for (const z of [zb + POST * 2, zr]) {
      for (const x of [-px, px]) {
        p.lathe("steelDark", x, 0, z, [
          [0, 0],
          [POST * 2, 0],
          [POST * 2, 0.008],
          [POST, 0.014],
          [POST, s.h - 0.02],
          [0, s.h - 0.02],
        ]);
      }
      p.tube("handle", [
        { x: -px, y: s.h - RAIL - 0.01, z },
        { x: -px, y: s.h - RAIL, z },
        { x: px, y: s.h - RAIL, z },
        { x: px, y: s.h - RAIL - 0.01, z },
      ], RAIL, { bend: 0.03 });
      p.rod("handle", "x", 0, TUB + 0.5, z, px * 2, RAIL * 0.7);
    }
    // The control box with the emergency stop on the front right post.
    const bx = px - POST - 0.08;
    p.roundedBox("panel", bx - 0.07, bx + 0.07, s.h - 0.3, s.h - 0.08, zr - 0.05, zr + 0.018, 0.01);
    button(p, bx, s.h - 0.13, zr + 0.018, 0.016, "knob");
    button(p, bx, s.h - 0.22, zr + 0.018, 0.01, "panelDark");
    p.roundedBox("steel", bx + 0.07, px, s.h - 0.2, s.h - 0.18, zr - 0.01, zr + 0.01, 0.003);
  },
};
