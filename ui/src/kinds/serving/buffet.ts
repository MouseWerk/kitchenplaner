// Buffet islands (Buffetinseln): free-standing counters served from both long sides, clad in wood
// on a recessed plinth, with a glass roof on two turned posts over the top. The hot island has
// heated GN wells with water baths and heat elements under its roof, the cold one cooled wells
// with the louvre of its machine at one end, the neutral one a granite top with platters; both
// of these have a light under the roof.

import * as THREE from "three";
import { FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { BODY_RADIUS, PLINTH, plinth, TOP, type Hole, type MaterialId, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { controlPanel, dish, GN_LONG, holesOf, planWells, seam, sneezeGuard, wellPans, wellRow, WELL_DEPTH } from "./common";
import { ventSlots } from "../parts/details";

/** Height of the glass roof over the top (mm) and its depth (share of the island's depth). */
const ROOF_RISE = 550;
const ROOF_SHARE = 0.55;
/** Thickness of the wood cladding (m) and how far the top overhangs it (m). */
const CLADDING = 0.02;
const OVERHANG = 0.03;
/** Width of a cladding panel (m), its joints between. */
const PANEL_W = 0.6;

type Mode = "hot" | "cold" | "neutral";

/** The wells of an island: one row of crosswise GN 1/1 across the middle of the depth (mm). */
function wells(width: number, depth: number) {
  const half = Math.min(GN_LONG / 2, depth / 2 - INSET * 2);
  return wellRow(width, -half, half);
}

/**
 * The body of an island: a dark recessed plinth, the carcass, wood cladding on both long sides
 * with the joints of its panels, steel ends, and the top (with its wells cut out if any).
 */
function islandBody(p: Parts, s: Size, holes: readonly Hole[], topMat: MaterialId): void {
  const { w, d, h } = s;
  const c = OVERHANG;
  plinth(p, w - c * 2, d - c * 2);
  const yb = holes.length > 0 ? h - WELL_DEPTH - 0.01 : h - TOP;
  p.roundedBox("steel", -w / 2 + c, w / 2 - c, PLINTH, yb, -d / 2 + c + CLADDING, d / 2 - c - CLADDING, BODY_RADIUS, "vertical");
  if (holes.length > 0) {
    for (const z of [-d / 2 + c + CLADDING, d / 2 - c - CLADDING - 0.01]) p.box("steel", -w / 2 + c, w / 2 - c, yb - 0.001, h - TOP, z, z + 0.01);
  }
  for (const [z0, dir] of [
    [d / 2 - c - CLADDING, 1],
    [-d / 2 + c, -1],
  ] as const) {
    p.roundedBox("wood", -w / 2 + c, w / 2 - c, PLINTH, h - TOP, z0, z0 + CLADDING, 0.004, "all", "x");
    const face = dir > 0 ? z0 + CLADDING : z0;
    const n = Math.max(1, Math.round((w - c * 2) / PANEL_W));
    for (let i = 1; i < n; i++) seam(p, "y", PLINTH + 0.01, h - TOP - 0.01, -w / 2 + c + ((w - c * 2) * i) / n, face, dir);
  }
  for (const x of [-w / 2 + c, w / 2 - c - CLADDING]) p.roundedBox("steel", x, x + CLADDING, PLINTH, h - TOP, -d / 2 + c, d / 2 - c, 0.004, "vertical");
  if (holes.length > 0) p.topWithHoles(topMat, w, d, h - TOP, h, holes);
  else p.roundedBox(topMat, -w / 2, w / 2, h - TOP, h, -d / 2, d / 2, 0.006);
}

/** The quarter turn that lays a part built facing +z onto a face facing +x. */
const TO_RIGHT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

/**
 * Lays the parts added since `from` (built facing +z on the plane z = 0, centred on x = 0) onto
 * the right end face at `x`: a control panel or a louvre on the end of an island.
 */
function onRightEnd(p: Parts, from: number, x: number): void {
  for (const part of p.g.children.slice(from)) {
    const { x: px, y, z } = part.position;
    part.position.set(x + z, y, -px);
    part.quaternion.premultiply(TO_RIGHT);
  }
}

function makeBuffet(kind: string, mode: Mode): KindDef {
  return {
    kind,
    rise: ROOF_RISE,
    plan(s) {
      if (mode !== "neutral") planWells(s, wells(s.w, s.d));
      const rd = (s.d * ROOF_SHARE) / 2;
      s.rect("hidden", s.L + INSET / 2, -rd, s.R - INSET / 2, rd);
      s.rect("detail", s.L + OVERHANG * 1000, s.B + OVERHANG * 1000, s.R - OVERHANG * 1000, s.F - OVERHANG * 1000);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const I = FRONT_INSET;
      f.worktop();
      f.box("detail", l + OVERHANG * 1000, r - OVERHANG * 1000, z0 + FEET * 0.7, top - FRONT_TOP, "item-dark");
      const n = Math.max(1, Math.round(f.w / (PANEL_W * 1000)));
      for (let i = 1; i < n; i++) f.line("detail", [l + (f.w * i) / n, z0 + FEET * 0.7], [l + (f.w * i) / n, top - FRONT_TOP]);
      // The roof on its two posts.
      for (const x of [l + I, r - I]) f.box("detail", x - 12, x + 12, top, top + ROOF_RISE);
      f.box("detail", l + I / 2, r - I / 2, top + ROOF_RISE - 30, top + ROOF_RISE, "glass");
    },
    elevationSide(f) {
      const { l, r, top } = f;
      const c = (l + r) / 2;
      const rd = (f.w * ROOF_SHARE) / 2;
      f.worktop();
      f.box("detail", c - 12, c + 12, top, top + ROOF_RISE);
      f.box("detail", c - rd, c + rd, top + ROOF_RISE - 10, top + ROOF_RISE, "glass");
    },
    mesh(p, s, item) {
      const { w, d, h } = s;
      const holes = mode === "neutral" ? [] : holesOf(wells(item.width, item.depth));
      islandBody(p, s, holes, mode === "neutral" ? "granite" : "steel");
      if (mode === "hot") wellPans(p, holes, h, ["foodBrown", "foodCream", "foodRed", "foodGreen", "foodCream"], true, true);
      else if (mode === "cold") wellPans(p, holes, h, ["foodGreen", "foodRed", "foodCream", "foodGreen"], true);
      else {
        // Platters and plates on the granite top, each with its dish.
        const n = Math.max(1, Math.floor((w - 0.2) / 0.36));
        const foods: MaterialId[] = ["foodBrown", "foodGreen", "foodRed", "foodCream"];
        for (let i = 0; i < n; i++) dish(p, -w / 2 + 0.1 + ((w - 0.2) / n) * (i + 0.5), h, 0, Math.min(0.15, d / 2 - 0.1), foods[i % foods.length]);
      }
      // Controls at the staff end (right): thermostats for the wells, or the cooling's louvre.
      const xe = w / 2 - OVERHANG - CLADDING;
      if (mode === "hot") {
        const m = p.g.children.length;
        controlPanel(p, -0.18, 0.18, PLINTH + 0.4, PLINTH + 0.5, 0, 0.026, { knobs: holes.length, pilots: true });
        onRightEnd(p, m, xe + CLADDING - 0.001);
      } else if (mode === "cold") {
        const m = p.g.children.length;
        ventSlots(p, -0.2, 0.2, PLINTH + 0.06, PLINTH + 0.3, 0, 6);
        onRightEnd(p, m, xe + CLADDING);
      }
      // The roof: glass on two turned posts, the light or the heat elements under it.
      sneezeGuard(p, w, h, ROOF_RISE / 1000, { zPost: 0, z0: -(d * ROOF_SHARE) / 2, z1: (d * ROOF_SHARE) / 2, light: mode === "hot" ? "heat" : "light", pane: false, inset: OVERHANG + 0.03 });
    },
  };
}

export const buffetHot = makeBuffet("buffetHot", "hot");
export const buffetCold = makeBuffet("buffetCold", "cold");
export const buffetNeutral = makeBuffet("buffetNeutral", "neutral");
