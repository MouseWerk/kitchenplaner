// Hand wash basins (Handwaschbecken): wall-mounted basins with a round bowl pressed into a deck
// with a front apron, the tap on the deck behind the bowl and a wall plate. One factory draws the
// lever-operated basin (the bowl and its trap show underneath), the knee-operated one with its
// front skirt and push plate, and the hygiene station with a sensor tap and soap and towel
// dispensers above it. Everything stays inside the unit's box: its height includes the tap (and
// the dispensers). The bowl is round in the plan, the elevations and 3D.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { SHEET, tap, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain } from "./common";

/** How the water is switched on. */
type Operation = "lever" | "knee" | "sensor";

/** Depth of the bowl below the deck (m). */
const BOWL_DEPTH = 0.12;
/** Height of the part above the deck that carries the tap (m, without dispensers). */
const TAP_ZONE = 0.15;
/** Thickness of the deck and height of its front and side aprons (m). */
const DECK = 0.015;
const APRON = 0.05;
/** Thickness of the wall plate behind the basin (m). */
const PLATE = SHEET * 2;
/** The bowl's radius as a share of the deck's smaller side. */
const BOWL_SHARE = 0.35;
/** Sides of the polygon the round bowl is built from (its wall panels). */
const SIDES = 16;
/** Bottle trap under a wall basin (m): radius, and the height of its arm to the wall. */
const TRAP_R = 0.022;
const TRAP_ARM = 0.025;
/** Soap dispenser and paper towel dispenser (m): width, height, depth. */
const SOAP = { w: 0.09, h: 0.2, d: 0.1 };
const TOWEL = { w: 0.28, h: 0.36, d: 0.12 };
/** Distance of the tap column from the back (m, as `tap` in parts/mesh.ts). */
const TAP_Z = 0.05;

export interface HandwashSpec {
  kind: string;
  operation: Operation;
  /** Soap and towel dispensers on the wall above the basin. */
  dispensers: boolean;
}

/** Room under the bowl of a basin without a skirt, for the trap (m). */
const UNDER = 0.06;
/** Least room left above the deck for the tap (m). */
const TAP_MIN = 0.08;

/** Deck (rim) and bowl floor above the unit's lower edge (m). */
function basin(spec: HandwashSpec, h: number): { rim: number; floor: number } {
  if (spec.operation === "knee") {
    const rim = h - TAP_ZONE;
    return { rim, floor: rim - BOWL_DEPTH };
  }
  const rim = Math.max(UNDER + 0.03, Math.min(UNDER + BOWL_DEPTH, h - TAP_MIN));
  return { rim, floor: Math.min(UNDER, rim - 0.03) };
}

/** The bowl in the item frame (mm or m alike): centre across the depth and radius. */
function bowl(w: number, d: number, plate: number): { cz: number; r: number } {
  return { cz: plate / 2, r: Math.min(w, d - plate) * BOWL_SHARE };
}

/**
 * A round bowl let into a deck from x -w/2 to w/2 and z from `z0` to `z1` (m): the deck around a
 * polygonal hole (strips beside the hole's square, and pieces along the polygon's sides in the
 * corners), the bowl's wall panels on the polygon down to the floor, and the floor.
 */
function roundBowl(p: Parts, w: number, z0: number, z1: number, cz: number, r: number, rim: number, floor: number): void {
  const y0 = rim - DECK;
  p.box("steel", -w / 2, -r, y0, rim, z0, z1);
  p.box("steel", r, w / 2, y0, rim, z0, z1);
  p.box("steel", -r, r, y0, rim, z0, cz - r);
  p.box("steel", -r, r, y0, rim, cz + r, z1);
  // Corner pieces along the slanted sides of the polygon; a hair lower than the deck so their
  // faces do not fight with the strips they overlap.
  const step = (2 * Math.PI) / SIDES;
  const half = r * Math.tan(step / 2);
  for (let k = 0; k < SIDES; k++) {
    const a = k * step;
    const diagonal = k % (SIDES / 4) === SIDES / 8;
    const straight = k % (SIDES / 4) === 0;
    if (!straight) {
      const depth = r * (diagonal ? 0.43 : 0.25);
      const len = half + r * (diagonal ? 0.06 : 0.1);
      const piece = p.box("steel", -len, len, y0 - 0.0005, rim - 0.0005, -depth / 2, depth / 2);
      piece.rotation.y = Math.PI / 2 - a;
      piece.position.set((r + depth / 2) * Math.cos(a), (y0 + rim) / 2 - 0.0005, cz + (r + depth / 2) * Math.sin(a));
    }
    // The bowl's wall panel on this side, from the floor up to the deck.
    const wall = p.box("steel", -half - 0.001, half + 0.001, floor, rim - 0.001, -SHEET / 2, SHEET / 2);
    wall.rotation.y = Math.PI / 2 - a;
    wall.position.set((r + SHEET / 2) * Math.cos(a), (floor + rim - 0.001) / 2, cz + (r + SHEET / 2) * Math.sin(a));
  }
  p.cyl("steel", 0, cz, floor, floor + SHEET, r + SHEET);
}

export function makeHandwash(spec: HandwashSpec): KindDef {
  return {
    kind: spec.kind,
    placement: "overhead",
    plan(s) {
      const plate = PLATE * 1000;
      const b = bowl(s.w, s.d, plate);
      s.circle("detail", 0, b.cz, b.r);
      s.circle("detail", 0, b.cz, INSET / 4);
      // The tap on the deck behind the bowl, the wall plate along the back.
      s.circle("detail", 0, s.B + TAP_Z * 1000, INSET / 3);
      s.line("detail", [s.L, s.B + plate], [s.R, s.B + plate]);
      if (spec.dispensers) {
        s.rect("detail", s.L + INSET / 2, s.B, s.L + INSET / 2 + SOAP.w * 1000, s.B + SOAP.d * 1000);
        s.rect("detail", s.R - INSET / 2 - TOWEL.w * 1000, s.B, s.R - INSET / 2, s.B + TOWEL.d * 1000);
      }
      if (spec.operation === "knee") s.line("detail", [s.L + INSET, s.F - INSET / 2], [s.R - INSET, s.F - INSET / 2]);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const I = FRONT_INSET;
      const c = (l + r) / 2;
      const b = basin(spec, f.item.height / 1000);
      const rim = z0 + b.rim * 1000;
      const floor = z0 + b.floor * 1000;
      const bw = bowl(f.w, f.item.depth, PLATE * 1000).r;
      // The deck with its apron, the round bowl behind it (hidden) and the drain under it.
      f.box("detail", l, r, rim - APRON * 1000, rim);
      f.box("hidden", c - bw, c + bw, floor, rim - APRON * 1000);
      // The tap on the deck behind the bowl.
      const tz = Math.min(top - I / 4, rim + TAP_ZONE * 1000 * 0.8);
      f.line("detail", [c, rim], [c, tz], [c - I * 2, tz], [c - I * 2, tz - I]);
      if (spec.operation === "lever") f.line("detail", [c, tz - I], [c + I * 1.5, tz - I]);
      if (spec.operation === "sensor") f.box("detail", c - I / 4, c + I / 4, rim + I, rim + I * 1.5);
      if (spec.operation === "knee") {
        // The skirt fills the box down to the lower edge; the knee push plate in it.
        f.box("detail", c - I * 2, c + I * 2, z0 + I * 2, z0 + I * 5);
      } else {
        // The bottle trap under the bowl and its arm to the wall.
        f.box("detail", c - TRAP_R * 1000, c + TRAP_R * 1000, z0, floor);
      }
      if (spec.dispensers) {
        const d0 = rim + TAP_ZONE * 1000 + I;
        f.box("detail", l + I / 2, l + I / 2 + SOAP.w * 1000, d0, Math.min(top - I / 2, d0 + SOAP.h * 1000));
        f.box("detail", r - I / 2 - TOWEL.w * 1000, r - I / 2, d0, Math.min(top - I / 2, d0 + TOWEL.h * 1000));
      }
    },
    mesh(p, s) {
      const zb = -s.d / 2;
      const zf = s.d / 2;
      const { rim, floor } = basin(spec, s.h);
      const { cz, r } = bowl(s.w, s.d, PLATE);
      // Wall plate behind the basin, up to the top of the unit.
      p.box("steel", -s.w / 2, s.w / 2, 0, s.h, zb, zb + PLATE);
      // The deck with the bowl, and its apron at the front and the sides.
      roundBowl(p, s.w, zb + PLATE, zf - SHEET, cz, r, rim, floor);
      p.box("steel", -s.w / 2, s.w / 2, rim - APRON, rim, zf - SHEET, zf);
      for (const sx of [-1, 1]) p.box("steel", sx > 0 ? s.w / 2 - SHEET : -s.w / 2, sx > 0 ? s.w / 2 : -s.w / 2 + SHEET, rim - APRON, rim - 0.0005, zb + PLATE, zf - SHEET);
      if (spec.operation === "knee") {
        // Skirt from the apron down to the lower edge, the knee push plate in it. It is solid
        // below the bowl and a shell around it, so the bowl keeps its depth.
        p.box("steel", -s.w / 2, s.w / 2, 0, floor, zb + PLATE, zf - SHEET);
        p.box("steel", -s.w / 2, s.w / 2, floor, rim - APRON, zf - SHEET * 2, zf - SHEET);
        for (const x of [-s.w / 2, s.w / 2 - SHEET]) p.box("steel", x, x + SHEET, floor, rim - APRON, zb + PLATE, zf - SHEET * 2);
        const kw = Math.min(0.2, s.w * 0.45);
        p.box("panelDark", -kw / 2, kw / 2, 0.08, 0.22, zf - SHEET, zf - SHEET / 2);
        bowlDrain(p, 0, cz, floor, zb, false);
      } else {
        // The bottle trap under the bowl and its arm back to the wall.
        bowlDrain(p, 0, cz, floor, zb, false);
        p.cyl("steelDark", 0, cz, 0, floor, TRAP_R);
        p.rod("steelDark", "z", 0, TRAP_ARM, (zb + PLATE + cz) / 2, cz - zb - PLATE, TRAP_R * 0.6);
      }
      // The tap on the deck behind the bowl.
      const tapY = rim;
      const tapRise = Math.min(TAP_ZONE * 0.9, s.h - tapY);
      if (spec.operation === "lever") tap(p, 0, zb, tapY, tapRise);
      else {
        // A fixed spout (knee and sensor taps have no lever): a column and an arm forward.
        const z = zb + TAP_Z;
        p.cyl("handle", 0, z, tapY, tapY + 0.02, 0.024);
        p.cyl("handle", 0, z, tapY, tapY + tapRise - 0.012, 0.012);
        p.rod("handle", "z", 0, tapY + tapRise - 0.012, z + 0.06, 0.12, 0.012);
        p.cyl("handle", 0, z + 0.11, tapY + tapRise - 0.05, tapY + tapRise - 0.012, 0.01);
        if (spec.operation === "sensor") p.box("glassDark", -0.008, 0.008, tapY + tapRise * 0.45, tapY + tapRise * 0.65, z + 0.011, z + 0.013);
      }
      if (spec.dispensers) {
        const y0 = rim + TAP_ZONE + 0.04;
        const sy1 = Math.min(s.h - 0.01, y0 + SOAP.h);
        const sx0 = -s.w / 2 + 0.02;
        p.box("panel", sx0, sx0 + SOAP.w, y0, sy1, zb + PLATE, zb + SOAP.d);
        p.box("glass", sx0 + 0.02, sx0 + SOAP.w - 0.02, y0 + 0.04, sy1 - 0.05, zb + SOAP.d, zb + SOAP.d + 0.002);
        p.box("knob", sx0 + 0.02, sx0 + SOAP.w - 0.02, y0 + 0.005, y0 + 0.025, zb + SOAP.d - 0.02, zb + SOAP.d);
        const ty1 = Math.min(s.h - 0.01, y0 + TOWEL.h);
        const tx1 = s.w / 2 - 0.02;
        p.box("panel", tx1 - TOWEL.w, tx1, y0, ty1, zb + PLATE, zb + TOWEL.d);
        p.box("glassDark", tx1 - TOWEL.w + 0.04, tx1 - 0.04, ty1 - 0.1, ty1 - 0.04, zb + TOWEL.d, zb + TOWEL.d + 0.002);
        p.box("knob", tx1 - TOWEL.w + 0.05, tx1 - 0.05, y0 + 0.01, y0 + 0.025, zb + TOWEL.d - 0.03, zb + TOWEL.d);
      }
    },
  };
}

export const handwash = makeHandwash({ kind: "handwash", operation: "lever", dispensers: false });
export const handwashKnee = makeHandwash({ kind: "handwashKnee", operation: "knee", dispensers: false });
export const handwashStation = makeHandwash({ kind: "handwashStation", operation: "sensor", dispensers: true });
