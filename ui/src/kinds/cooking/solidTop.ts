// Solid top (Glühplatte): one cast plate over the whole top, over an oven. A gas solid top is
// hottest in the middle of its rings and cooler towards the edges (one ring centre per 800 mm);
// an electric one is a plain plate heated in zones, two front to back per 400 mm, marked by
// the joints between them.

import { CONTROLS, SHEET, TOP_RADIUS, worktop, type Parts, type Size } from "../parts/mesh";
import { controlStrip, type PlanSketch } from "../parts/plan";
import type { Item } from "../../model/types";
import type { KindDef } from "../types";
import { columns, lineFront, lineModule, planTop, PROUD } from "./common";

/** Width of the plate per ring centre (m). */
const RING_MODULE = 0.8;
/** Thickness of the cast plate (m). */
const PLATE = 0.03;
/** Width of the joints between the heated zones of an electric plate (m). */
const JOINT = 0.006;
/** How far the joints stand over the plate (m). */
const JOINT_PROUD = 0.001;
/** Margin of the plate in its frame (m). */
const MARGIN = 0.03;

function rings(width: number): number {
  // A small epsilon, so 1200 / 800 counts as the 1.5 it is and rounds up to two rings.
  return Math.max(1, Math.round(width / RING_MODULE + 1e-9));
}

/** Knobs on the control strip: one per ring (two burners each) or per zone, and the oven's. */
function knobs(widthM: number, item: Item): number {
  return item.energy === "gas" ? rings(widthM) * 2 + 1 : columns(widthM, 0.4) * 2 + 1;
}

function planZones(s: PlanSketch) {
  const { x0, x1, y0, y1 } = planTop(s);
  const cols = columns(s.w);
  const cw = (x1 - x0) / cols;
  for (let c = 1; c < cols; c++) s.line("detail", [x0 + cw * c, y0], [x0 + cw * c, y1]);
  s.line("detail", [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]);
}

function planRings(s: PlanSketch) {
  const { x0, x1, y0, y1 } = planTop(s);
  const n = rings(s.w / 1000);
  const cw = (x1 - x0) / n;
  const r = Math.min(cw, y1 - y0) / 2;
  for (let i = 0; i < n; i++) {
    const cx = x0 + cw * (i + 0.5);
    s.circle("detail", cx, (y0 + y1) / 2, r * 0.25);
    s.circle("detail", cx, (y0 + y1) / 2, r * 0.6);
  }
}

/** The joints between the heated zones of an electric plate, a hair over the plate (m). */
function zoneJoints(p: Parts, s: Size, plateTop: number, z0: number, z1: number) {
  const x0 = -s.w / 2 + MARGIN;
  const x1 = s.w / 2 - MARGIN;
  const cols = columns(s.w, 0.4);
  const cw = (x1 - x0) / cols;
  const y1 = plateTop + JOINT_PROUD;
  for (let c = 1; c < cols; c++) p.box("steelDark", x0 + cw * c - JOINT / 2, x0 + cw * c + JOINT / 2, plateTop - SHEET, y1, z0, z1);
  const zm = (z0 + z1) / 2;
  p.box("steelDark", x0, x1, plateTop - SHEET, y1, zm - JOINT / 2, zm + JOINT / 2);
}

export const solidTop: KindDef = {
  kind: "solidTop",
  plan(s) {
    const { x0, x1, y0, y1 } = planTop(s);
    s.rect("detail", x0, y0, x1, y1);
    if (s.item.energy === "gas") planRings(s);
    else planZones(s);
    controlStrip(s);
  },
  elevation(f) {
    lineFront(f, knobs(f.w / 1000, f.item), "oven");
  },
  mesh(p, s, item) {
    // The rings of a gas plate stand over it; the joints of an electric one only a hair.
    const plateTop = item.energy === "gas" ? s.h - PROUD * 2 : s.h - JOINT_PROUD;
    lineModule(p, s, { base: "oven", knobs: knobs(s.w, item), underTop: plateTop - PLATE });
    // Stainless frame with the cast plate in it, its edges cast round.
    worktop(p, "steel", -s.w / 2, s.w / 2, plateTop - PLATE, plateTop - PROUD, -s.d / 2, s.d / 2);
    const z0 = -s.d / 2 + MARGIN;
    const z1 = s.d / 2 - CONTROLS;
    p.roundedBox("plate", -s.w / 2 + MARGIN, s.w / 2 - MARGIN, plateTop - PLATE + SHEET, plateTop, z0, z1, TOP_RADIUS);
    // The grease gutter in the frame in front of the plate.
    p.roundedBox("slot", -s.w / 2 + MARGIN, s.w / 2 - MARGIN, plateTop - PROUD - 0.001, plateTop - PROUD + 0.001, z1 + 0.012, z1 + 0.024, 0.006, "vertical");
    if (item.energy !== "gas") {
      zoneJoints(p, s, plateTop, z0, z1);
      return;
    }
    const n = rings(s.w);
    const cw = (s.w - 2 * MARGIN) / n;
    const r = Math.min(cw, z1 - z0) / 2;
    for (let i = 0; i < n; i++) {
      const cx = -s.w / 2 + MARGIN + cw * (i + 0.5);
      const cz = (z0 + z1) / 2;
      // The loose rings over the burner, each a step higher than the one around it, so no two faces
      // share a plane: a turned outer ring with a dark joint, the rings and the centre plug.
      const y0 = plateTop - PROUD;
      const hp = s.h - y0;
      p.lathe("steelDark", cx, y0, cz, [
        [r * 0.56, 0],
        [r * 0.62, 0],
        [r * 0.62, hp * 0.4],
        [r * 0.56, hp * 0.4],
        [r * 0.56, 0],
      ]);
      p.lathe("plate", cx, y0, cz, [
        [0, 0],
        [r * 0.555, 0],
        [r * 0.555, hp * 0.62],
        [r * 0.54, hp * 0.67],
        [r * 0.28, hp * 0.67],
        [r * 0.27, hp * 0.75],
        [r * 0.22, hp * 0.75],
        [r * 0.22, hp * 0.95],
        [r * 0.2, hp],
        [0, hp],
      ]);
    }
  },
};
