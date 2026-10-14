// Hand wash basins (Handwaschbecken): wall-mounted basins with the tap on a back plate. One
// factory draws the lever-operated basin, the knee-operated one with its front skirt and push
// plate, and the hygiene station with a sensor tap and soap and towel dispensers above it.
// Everything stays inside the unit's box: its height includes the tap (and the dispensers).

import { INSET as FRONT_INSET } from "../parts/elevation";
import { SHEET, tap } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bowlDrain } from "./common";

/** How the water is switched on. */
type Operation = "lever" | "knee" | "sensor";

/** Depth of the bowl below its rim (m). */
const BOWL_DEPTH = 0.15;
/** Height of the back plate's part above the rim that carries the tap (m, without dispensers). */
const TAP_ZONE = 0.15;
/** Rolled rim of the basin (m). */
const RIM = 0.015;
/** Soap dispenser and paper towel dispenser (m): width, height, depth. */
const SOAP = { w: 0.09, h: 0.2, d: 0.1 };
const TOWEL = { w: 0.28, h: 0.36, d: 0.12 };

export interface HandwashSpec {
  kind: string;
  operation: Operation;
  /** Soap and towel dispensers on the wall above the basin. */
  dispensers: boolean;
}

/** Height of the short base under the bowl of a basin without a skirt (m). */
const BASE = 0.06;
/** Least room left above the rim for the tap (m). */
const TAP_MIN = 0.08;

/** Rim and bowl floor above the unit's lower edge (m). */
function basin(spec: HandwashSpec, h: number): { rim: number; floor: number } {
  if (spec.operation === "knee") {
    const rim = h - TAP_ZONE;
    return { rim, floor: rim - BOWL_DEPTH };
  }
  return { rim: Math.max(BASE + 0.03, Math.min(BASE + BOWL_DEPTH, h - TAP_MIN)), floor: BASE };
}

export function makeHandwash(spec: HandwashSpec): KindDef {
  return {
    kind: spec.kind,
    placement: "overhead",
    plan(s) {
      const r = Math.min(s.w, s.d) * 0.35;
      s.circle("detail", 0, INSET / 2, r);
      s.circle("detail", 0, INSET / 2, INSET / 4);
      s.circle("detail", 0, s.B + INSET / 2, INSET / 3);
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
      f.line("detail", [l, rim], [r, rim]);
      f.box("hidden", l + I, r - I, z0 + b.floor * 1000, rim - I / 2);
      // The tap on the back plate above the rim.
      const tz = Math.min(top - I / 4, rim + TAP_ZONE * 1000 * 0.8);
      f.line("detail", [c, rim], [c, tz], [c - I * 2, tz], [c - I * 2, tz - I]);
      if (spec.operation === "lever") f.line("detail", [c, tz - I], [c + I * 1.5, tz - I]);
      if (spec.operation === "sensor") f.box("detail", c - I / 2, c + I / 2, rim + I / 2, rim + I);
      if (spec.operation === "knee") {
        // Skirt down to the lower edge with the knee push plate in it.
        f.box("detail", l + I / 2, r - I / 2, z0 + I / 2, rim - I);
        f.box("detail", c - I * 2, c + I * 2, z0 + I * 2, z0 + I * 5);
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
      // Wall plate behind the basin, up to the top of the unit.
      p.box("steel", -s.w / 2, s.w / 2, 0, s.h, zb, zb + SHEET * 2);
      // Body below the bowl: a skirt to the lower edge on a knee-operated basin, else a short
      // tapered base under the bowl.
      if (spec.operation === "knee") {
        p.box("steel", -s.w / 2, s.w / 2, 0, floor, zb + SHEET * 2, zf - RIM);
        const kw = Math.min(0.2, s.w * 0.45);
        p.box("panelDark", -kw / 2, kw / 2, 0.08, 0.22, zf - RIM, zf - RIM / 2);
      } else {
        p.box("steel", -s.w / 2 + 0.03, s.w / 2 - 0.03, 0, floor, zb + SHEET * 2, zf - 0.06);
        p.box("steel", -s.w / 2 + 0.01, s.w / 2 - 0.01, floor * 0.6, floor, zb + SHEET * 2, zf - 0.03);
      }
      p.tub("steel", -s.w / 2, s.w / 2, floor, rim, zb + SHEET * 2, zf, RIM);
      p.rod("steel", "x", 0, rim - RIM / 2, zf - RIM / 2, s.w, RIM / 2);
      bowlDrain(p, 0, 0.02, floor, zb, spec.operation === "knee");
      // The tap on the back plate.
      const tapY = rim + 0.005;
      const tapRise = Math.min(TAP_ZONE * 0.9, s.h - tapY);
      if (spec.operation === "lever") tap(p, 0, zb, tapY, tapRise);
      else {
        // A fixed spout (knee and sensor taps have no lever): a column and an arm forward.
        const z = zb + 0.05;
        p.cyl("handle", 0, z, tapY, tapY + tapRise - 0.012, 0.012);
        p.rod("handle", "z", 0, tapY + tapRise - 0.012, z + 0.06, 0.12, 0.012);
        p.cyl("handle", 0, z + 0.11, tapY + tapRise - 0.05, tapY + tapRise - 0.012, 0.01);
        if (spec.operation === "sensor") p.box("glassDark", -0.012, 0.012, tapY + tapRise * 0.3, tapY + tapRise * 0.5, z + 0.012, z + 0.014);
      }
      if (spec.dispensers) {
        const y0 = rim + TAP_ZONE + 0.04;
        const sy1 = Math.min(s.h - 0.01, y0 + SOAP.h);
        const sx0 = -s.w / 2 + 0.02;
        p.box("panel", sx0, sx0 + SOAP.w, y0, sy1, zb + SHEET * 2, zb + SOAP.d);
        p.box("glass", sx0 + 0.02, sx0 + SOAP.w - 0.02, y0 + 0.04, sy1 - 0.05, zb + SOAP.d, zb + SOAP.d + 0.002);
        p.box("knob", sx0 + 0.02, sx0 + SOAP.w - 0.02, y0 + 0.005, y0 + 0.025, zb + SOAP.d - 0.02, zb + SOAP.d);
        const ty1 = Math.min(s.h - 0.01, y0 + TOWEL.h);
        const tx1 = s.w / 2 - 0.02;
        p.box("panel", tx1 - TOWEL.w, tx1, y0, ty1, zb + SHEET * 2, zb + TOWEL.d);
        p.box("glassDark", tx1 - TOWEL.w + 0.04, tx1 - 0.04, ty1 - 0.1, ty1 - 0.04, zb + TOWEL.d, zb + TOWEL.d + 0.002);
        p.box("knob", tx1 - TOWEL.w + 0.05, tx1 - 0.05, y0 + 0.01, y0 + 0.025, zb + TOWEL.d - 0.03, zb + TOWEL.d);
      }
    },
  };
}

export const handwash = makeHandwash({ kind: "handwash", operation: "lever", dispensers: false });
export const handwashKnee = makeHandwash({ kind: "handwashKnee", operation: "knee", dispensers: false });
export const handwashStation = makeHandwash({ kind: "handwashStation", operation: "sensor", dispensers: true });
