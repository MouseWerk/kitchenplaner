// Table-top units with a hinged top plate on a counter: the contact grill (Kontaktgrill: ribbed
// cast plates, the upper one on a balanced arm with a long handle bar) and the waffle iron
// (Waffeleisen: square baking plates under rounded lids with black grips). One plate per
// 300 to 450 mm of width, each with its own knob and pilot light.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { gripZ, hinges, pilot, tableFeet } from "./details";
import { controlPanel, housing } from "../parts/details";

/** Height of the feet and of the base with the controls (m). */
const FEET = 0.02;
const BASE = 0.1;
/** Thickness of the lower cast plate (m). */
const PLATE = 0.02;
/** Depth of the control strip at the front of the base (m). */
const STRIP = 0.06;
/** Depth taken at the back by the hinges (m). */
const HINGE = 0.05;
/** Pitch of the ribs of a grill plate (m). */
const RIB_PITCH = 0.02;

type Look = "grill" | "waffle";

/** Plates side by side: a contact grill from 600 mm has two, a waffle iron one per 300 mm. */
function plates(w: number, look: Look): number {
  return look === "grill" ? (w >= 0.6 ? 2 : 1) : Math.max(1, Math.round(w / 0.3));
}

function makeHinged(kind: string, look: Look): KindDef {
  return {
    kind,
    placement: "tableTop",
    plan(s) {
      const n = plates(s.w / 1000, look);
      const pw = (s.w - INSET * (n + 1)) / n;
      for (let i = 0; i < n; i++) {
        const x = s.L + INSET + i * (pw + INSET);
        s.rect("detail", x, s.B + HINGE * 1000, x + pw, s.F - STRIP * 1000);
        // The handle at the front of the lid.
        s.line("detail", [x + pw * 0.2, s.F - STRIP * 500], [x + pw * 0.8, s.F - STRIP * 500]);
      }
      s.line("detail", [s.L, s.B + HINGE * 1000], [s.R, s.B + HINGE * 1000]);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const n = plates(f.w / 1000, look);
      const base = z0 + (FEET + BASE) * 1000;
      f.box("detail", l + FRONT_INSET / 4, r - FRONT_INSET / 4, z0 + FEET * 1000, base);
      const pw = (f.w - FRONT_INSET * (n + 1) / 2) / n;
      for (let i = 0; i < n; i++) {
        const x = l + FRONT_INSET / 2 + i * (pw + FRONT_INSET / 2);
        f.box("detail", x, x + pw, base + PLATE * 1000, top - 20);
        f.circle("detail", x + pw / 2, (z0 + FEET * 1000 + base) / 2, 15);
        f.line("detail", [x + pw * 0.2, top - 50], [x + pw * 0.8, top - 50]);
      }
    },
    mesh(p, s) {
      const n = plates(s.w, look);
      const y0 = tableFeet(p, s.w, s.d, FEET, 0.035, 0.014);
      const yb = y0 + BASE;
      // The base with the controls at the front and the drip tray under the plates.
      housing(p, "steel", -s.w / 2, s.w / 2, y0, yb, -s.d / 2, s.d / 2 - 0.012, 0.006);
      const zf = s.d / 2;
      const gap = 0.012;
      const pw = (s.w - gap * (n + 1)) / n;
      for (let i = 0; i < n; i++) {
        const x0 = -s.w / 2 + gap + i * (pw + gap);
        const x1 = x0 + pw;
        const cx = (x0 + x1) / 2;
        // Knob and pilot light per plate on the front of the base.
        controlPanel(p, cx - 0.06, cx + 0.06, y0 + 0.015, yb - 0.04, zf - 0.012, zf - 0.008);
        p.knob(cx - 0.025, (y0 + yb - 0.025) / 2, zf - 0.008, zf, 0.016);
        pilot(p, cx + 0.03, (y0 + yb - 0.025) / 2, zf - 0.008, 0.005);
        plateSet(p, s, x0, x1, yb, look);
      }
    },
  };
}

/** One lower plate on the base at `yb` and its closed lid over it, from x0 to x1 (m). */
function plateSet(p: Parts, s: Size, x0: number, x1: number, yb: number, look: Look) {
  const zb = -s.d / 2 + HINGE;
  const zf = s.d / 2 - STRIP;
  const cx = (x0 + x1) / 2;
  // The lower plate: cast, with a rim and ribs (grill) or a waffle grid (waffle iron).
  p.roundedBox("castIron", x0, x1, yb - 0.002, yb + PLATE, zb, zf, 0.004);
  if (look === "grill") {
    const n = Math.max(3, Math.floor((zf - zb - 0.03) / RIB_PITCH));
    for (let k = 0; k < n; k++) {
      const z = zb + 0.015 + ((zf - zb - 0.03) / n) * (k + 0.5);
      p.roundedBox("castIron", x0 + 0.015, x1 - 0.015, yb + PLATE - 0.002, yb + PLATE + 0.004, z - 0.003, z + 0.003, 0.002, "top");
    }
  }
  // The lid: a rounded cover over the upper plate, a little set in from the lower one.
  const lid0 = yb + PLATE + 0.012;
  const top = s.h;
  p.roundedBox("castIron", x0 + 0.005, x1 - 0.005, lid0 - 0.008, lid0 + 0.012, zb + 0.005, zf - 0.005, 0.004);
  housing(p, "steel", x0 + 0.002, x1 - 0.002, lid0 + 0.008, top - (look === "grill" ? 0.012 : 0), zb, zf, look === "grill" ? 0.008 : 0.02);
  // The hinges at the back.
  p.roundedBox("steelDark", x0 + 0.02, x1 - 0.02, yb, lid0 + 0.03, -s.d / 2, zb + 0.004, BODY_RADIUS);
  hinges(p, x0 + 0.03, x1 - 0.03, lid0 + 0.03, zb - 0.012, 2, 0.01, 0.05);
  if (look === "grill") {
    // A long bar handle across the front of the lid on two arms.
    const hy = top - 0.012;
    p.tube(
      "handle",
      [
        { x: x0 + 0.03, y: hy, z: zf - 0.04 },
        { x: x0 + 0.03, y: hy, z: zf + STRIP - 0.03 },
        { x: x1 - 0.03, y: hy, z: zf + STRIP - 0.03 },
        { x: x1 - 0.03, y: hy, z: zf - 0.04 },
      ],
      0.009,
      { bend: 0.02 },
    );
    p.roundedBox("knob", cx - (x1 - x0) * 0.3, cx + (x1 - x0) * 0.3, hy - 0.012, hy + 0.012, zf + STRIP - 0.042, zf + STRIP - 0.018, 0.01);
  } else {
    // A black grip standing out of the lid's front.
    gripZ(p, cx, lid0 + 0.03, zf - 0.01, zf + STRIP - 0.012, 0.012);
  }
}

export const contactGrill = makeHinged("contactGrill", "grill");
export const waffleIron = makeHinged("waffleIron", "waffle");
