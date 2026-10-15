// Refrigerated counter (Kühltisch): a worktop on a cooled base with the machine compartment behind
// a grille at the left and GN 1/1 sections with doors or with two drawers each. The base is shared
// with the other refrigerated counters of the area (saladette, pizza counter, chef base, cold well).
// The freezer counter carries the frost strip under the handle of every door.

import { INSET as FRONT_INSET, TOP as FRONT_TOP, type Front } from "../parts/elevation";
import { FROST_STRIP, frostFront, frostMark, frostPlan } from "../parts/frost";
import { PLINTH, plinth, TOP, type Parts, type Size } from "../parts/mesh";
import { INSET, upstandLine, type PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import {
  BASE_MM,
  coolDoor,
  coolDrawer,
  counterSections,
  FRONT,
  grille,
  grilleFront,
  hingeLeft,
  LEAF_GAP_MM,
  m,
  machineWidth,
  STANDOFF,
} from "./common";

/** How the sections of a refrigerated base open. */
export type CounterFront = "doors" | "drawers";

/** Drawers stacked in one section of a drawer counter. */
const DRAWERS = 2;
/** Length of a horizontal handle in the elevation (mm). */
const HANDLE_MM = 200;
/** Distance of a freezer door's frost strip below the top of the door, under its handle (m). */
const FROST_DROP = 0.09;

/**
 * The plan of a refrigerated base: the machine compartment (under the top, dashed) at the left and
 * the door or drawer fronts of the sections.
 */
export function counterPlan(s: PlanSketch, front: CounterFront): void {
  const mx = s.L + machineWidth(s.w);
  s.line("hidden", [mx, s.B + INSET], [mx, s.F - INSET]);
  const n = counterSections(s.w);
  const gap = INSET / 2;
  const dw = (s.R - mx - (n + 1) * gap) / n;
  for (let i = 0; i < n; i++) {
    const x = mx + gap + i * (dw + gap);
    s.line("detail", [x, s.F - INSET / 2], [x + dw, s.F - INSET / 2]);
    // Drawers pull out: a second line marks the drawer front.
    if (front === "drawers") s.line("detail", [x, s.F - INSET], [x + dw, s.F - INSET]);
  }
}

/** The front of a refrigerated base from its feet up to `z1` (mm): grille, then the sections. */
export function counterFrontElevation(f: Front, front: CounterFront, z1: number, freezer = false): void {
  const { l, r } = f;
  const z0 = f.z0 + BASE_MM;
  f.line("detail", [l, z0], [r, z0]);
  const mx = l + machineWidth(f.w);
  grilleFront(f, l + LEAF_GAP_MM, mx - LEAF_GAP_MM, z0 + LEAF_GAP_MM, z1 - LEAF_GAP_MM);
  const n = counterSections(f.w);
  const dw = (r - mx) / n;
  const rows = front === "drawers" ? DRAWERS : 1;
  const rh = (z1 - z0) / rows;
  for (let i = 0; i < n; i++) {
    const a = mx + i * dw + LEAF_GAP_MM / 2;
    const b = a + dw - LEAF_GAP_MM;
    for (let k = 0; k < rows; k++) {
      const zb = z0 + k * rh + LEAF_GAP_MM / 2;
      const zt = zb + rh - LEAF_GAP_MM;
      f.box("detail", a, b, zb, zt);
      const c = (a + b) / 2;
      const len = Math.min(HANDLE_MM, (b - a) * 0.6);
      f.line("detail", [c - len / 2, zt - FRONT_INSET], [c + len / 2, zt - FRONT_INSET]);
    }
    if (freezer) frostFront(f, a, b, z1 - (FROST_DROP + FROST_STRIP) * 1000, z1 - FROST_DROP * 1000);
  }
}

/**
 * The 3D refrigerated base from the floor up to `topY` (m): feet, body, grille and sections. The
 * body behind the fronts ends at `bodyTop` (a well let into the top fills the rest itself).
 */
export function counterBase(p: Parts, s: Size, front: CounterFront, topY: number, freezer = false, bodyTop = topY): void {
  const zBody = s.d / 2 - FRONT;
  const zLeaf = s.d / 2 - STANDOFF;
  plinth(p, s.w, s.d);
  p.box("steel", -s.w / 2, s.w / 2, PLINTH, bodyTop, -s.d / 2, zBody);
  const mx = -s.w / 2 + m(machineWidth(s.w * 1000));
  grille(p, -s.w / 2 + 0.01, mx - 0.01, PLINTH + 0.01, topY - 0.01, zBody, zLeaf);
  const n = counterSections(s.w * 1000);
  const dw = (s.w / 2 - mx) / n;
  for (let i = 0; i < n; i++) {
    const x0 = mx + i * dw;
    if (front === "doors") {
      coolDoor(p, { x0, x1: x0 + dw, y0: PLINTH, y1: topY, zBody, zFront: s.d / 2, hinge: hingeLeft(i, n) ? "left" : "right", handle: "top" });
      if (freezer) frostMark(p, x0, x0 + dw, topY - FROST_DROP - FROST_STRIP, topY - FROST_DROP, zLeaf);
    } else {
      const rh = (topY - PLINTH) / DRAWERS;
      for (let k = 0; k < DRAWERS; k++) coolDrawer(p, x0, x0 + dw, PLINTH + k * rh, PLINTH + (k + 1) * rh, zBody, s.d / 2);
    }
  }
}

function counter(kind: string, front: CounterFront, freezer = false): KindDef {
  return {
    kind,
    plan(s) {
      counterPlan(s, front);
      upstandLine(s);
      if (freezer) frostPlan(s, (s.L + machineWidth(s.w) + s.R) / 2, 0);
    },
    elevation(f) {
      f.worktop();
      counterFrontElevation(f, front, f.top - FRONT_TOP, freezer);
    },
    mesh(p, s) {
      counterBase(p, s, front, s.h - TOP, freezer);
      p.box("steel", -s.w / 2, s.w / 2, s.h - TOP, s.h, -s.d / 2, s.d / 2);
    },
  };
}

export const counterFridge = counter("counterFridge", "doors");
export const counterFreezer = counter("counterFreezer", "doors", true);
export const counterDrawers = counter("counterDrawers", "drawers");
