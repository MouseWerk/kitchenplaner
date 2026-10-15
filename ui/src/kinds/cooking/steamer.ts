// Pressureless steamer (Dampfgarer, also for rice): two steam compartments for GN containers
// stacked on a base cabinet with the steam generator, each with a door and its controls at the
// right.

import { FEET, INSET, PANEL } from "../parts/elevation";
import { DOOR, doors, GAP, PLINTH, plinth } from "../parts/mesh";
import { frontDoorSwing, INSET as PLAN_INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { pilot } from "./details";
import { controlPanel, housing, ratingPlate } from "../parts/details";

/** Compartments stacked over the base. */
const COMPARTMENTS = 2;
/** Height of the base cabinet's top above the floor (m). */
const BASE = 0.7;
/** Width of the control panel at the right (m). */
const PANEL_W = 0.15;

export const steamer: KindDef = {
  kind: "steamer",
  plan(s) {
    const panel = Math.min(PANEL_W * 1000, s.w / 4);
    s.rect("detail", s.L + PLAN_INSET, s.B + PLAN_INSET, s.R - panel - PLAN_INSET / 2, s.F - PLAN_INSET);
    s.line("detail", [s.R - panel, s.B + PLAN_INSET], [s.R - panel, s.F]);
    frontDoorSwing(s, s.w - panel);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const base = Math.min(z0 + BASE * 1000, top - 200);
    f.doors(1, z0 + FEET, base - INSET / 2);
    const panel = Math.min(PANEL + INSET, f.w / 4);
    const dr = r - panel;
    const ch = (top - base) / COMPARTMENTS;
    for (let i = 0; i < COMPARTMENTS; i++) {
      const b = base + ch * i;
      f.box("detail", l + INSET, dr - INSET / 2, b + INSET / 2, b + ch - INSET / 2);
      f.line("detail", [dr - INSET * 2, b + ch * 0.3], [dr - INSET * 2, b + ch * 0.7]);
      f.box("detail", dr, r - INSET / 2, b + INSET / 2, b + ch - INSET / 2, "item-dark");
      f.circle("detail", (dr + r) / 2, b + ch * 0.65, Math.min(panel * 0.2, ch * 0.1));
      f.circle("detail", (dr + r) / 2, b + ch * 0.35, Math.min(panel * 0.2, ch * 0.1));
    }
  },
  mesh(p, s) {
    const zf = s.d / 2;
    const base = Math.min(BASE, s.h - 0.2);
    plinth(p, s.w, s.d);
    housing(p, "steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, zf - DOOR, 0.004);
    doors(p, -s.w / 2, s.w / 2, PLINTH, base, s.d, 1, "vertical");
    const panelW = Math.min(PANEL_W, s.w / 4);
    const dx1 = s.w / 2 - panelW;
    const ch = (s.h - base) / COMPARTMENTS;
    const zFace = zf - DOOR / 2;
    for (let i = 0; i < COMPARTMENTS; i++) {
      const b = base + ch * i;
      const t = b + ch;
      // A solid door, hinged at the left, with its gasket showing round it and the locking
      // lever at its free edge.
      p.plate("rubber", -s.w / 2 + GAP, dx1 - GAP, b + GAP, t - GAP, zf - DOOR, zf - DOOR + 0.002, 0.006);
      p.roundedBox("steel", -s.w / 2 + GAP * 2, dx1 - GAP * 2, b + GAP * 2, t - GAP * 2, zf - DOOR, zFace, 0.005, "top", "z");
      const len = Math.min(0.2, ch * 0.5);
      p.barHandle("y", (b + t) / 2 - len / 2, (b + t) / 2 + len / 2, dx1 - 0.04, zFace, zf);
      // The panel: two knobs (timer and mode) and a pilot light.
      controlPanel(p, dx1 + GAP, s.w / 2 - GAP, b + GAP * 2, t - GAP * 2, zf - DOOR, zFace);
      const px = (dx1 + s.w / 2) / 2;
      const kr = Math.min(0.022, panelW / 5);
      p.knob(px, b + ch * 0.6, zFace, zf, kr);
      p.knob(px, b + ch * 0.32, zFace, zf, kr);
      pilot(p, px, b + ch * 0.82, zFace);
    }
    ratingPlate(p, -s.w / 2 + 0.075, base - 0.045, zFace, 0.07, 0.03);
  },
};
