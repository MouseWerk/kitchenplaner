// Table-top cooking plates on a counter: the griddle (Tisch-Grillplatte: a plate with splash
// guards, a grease drawer at the front, one knob per 300 mm), the induction griddle (a chromed
// plate over induction coils, a glass touch panel) and the crêpe maker (round cast plates, one per
// 450 mm, on a low body).

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, TOP_RADIUS, type MaterialId } from "../parts/mesh";
import { CONTROL_STRIP, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { buttons, gripX, pilot, splashGuards, tableFeet } from "./details";
import { controlPanel, display, housing } from "../parts/details";

/** Height of the feet (m). */
const FEET = 0.03;
/** Thickness of a griddle plate and the height of its splash guards over it (m). */
const PLATE = 0.015;
const GUARD = 0.08;
/** Height of the grease drawer under the panel of a griddle (m). */
const DRAWER = 0.04;
/** Depth of the control panel at the front (m). */
const STRIP = 0.09;
/** Width per knob of a griddle and per plate of a crêpe maker (m). */
const KNOB_MODULE = 0.3;
const CREPE_MODULE = 0.45;

type Look = "griddle" | "induction" | "crepe";

function knobsOf(w: number): number {
  return Math.max(1, Math.round(w / KNOB_MODULE));
}

function crepes(w: number): number {
  return Math.max(1, Math.round(w / CREPE_MODULE));
}

function makePlate(kind: string, look: Look): KindDef {
  const round = look === "crepe";
  return {
    kind,
    placement: "tableTop",
    plan(s) {
      const y1 = s.F - CONTROL_STRIP + INSET / 2;
      if (round) {
        const n = crepes(s.w / 1000);
        const cw = s.w / n;
        const r = Math.min(cw / 2, (y1 - s.B) / 2) - INSET / 2;
        for (let i = 0; i < n; i++) s.circle("detail", s.L + cw * (i + 0.5), (s.B + y1) / 2, r);
      } else {
        s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, y1 - INSET / 2);
        s.line("detail", [s.L + INSET, y1 - INSET], [s.R - INSET, y1 - INSET]);
      }
      s.line("detail", [s.L, y1], [s.R, y1]);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const I = FRONT_INSET / 2;
      const plateTop = round ? top - 10 : top - GUARD * 1000;
      f.box("detail", l + I, r - I, z0 + FEET * 1000 + I, plateTop - PLATE * 1000 - I);
      f.line("detail", [l, plateTop - PLATE * 1000], [r, plateTop - PLATE * 1000]);
      const n = round ? crepes(f.w / 1000) : look === "induction" ? 0 : knobsOf(f.w / 1000);
      for (let i = 0; i < n; i++) f.circle("detail", l + (f.w / n) * (i + 0.5), (z0 + plateTop) / 2, 15);
      if (look === "induction") f.box("detail", (l + r) / 2 - 60, (l + r) / 2 + 60, (z0 + plateTop) / 2 - 15, (z0 + plateTop) / 2 + 15);
    },
    mesh(p, s) {
      const y0 = tableFeet(p, s.w, s.d, FEET, 0.04);
      const zf = s.d / 2;
      const plateTop = round ? s.h - 0.012 : s.h - GUARD;
      const bodyTop = plateTop - PLATE;
      // The body and the panel on its front.
      housing(p, "steel", -s.w / 2, s.w / 2, y0, bodyTop, -s.d / 2, zf - 0.012, 0.006);
      const zFace = zf - 0.008;
      // The panel takes the upper part of the front; a griddle has its grease drawer below it.
      const py0 = look === "griddle" ? y0 + DRAWER + 0.012 : y0 + 0.02;
      const py1 = bodyTop - 0.012;
      const pm = (py0 + py1) / 2;
      if (look === "induction") {
        // Black glass touch panel with a display and buttons.
        const zg = zf - 0.003;
        p.roundedBox("glassDark", -s.w / 2 + 0.02, s.w / 2 - 0.02, py0, py1, zf - 0.012, zg, BODY_RADIUS, "top", "z");
        display(p, 0, pm + 0.02, 0.09, 0.025, zg);
        buttons(p, -0.09, 0.09, pm - 0.02, zg, 5, 0.014);
      } else {
        controlPanel(p, -s.w / 2 + 0.02, s.w / 2 - 0.02, py0, py1, zf - 0.012, zFace);
        const n = round ? crepes(s.w) : knobsOf(s.w);
        for (let i = 0; i < n; i++) p.knob(-s.w / 2 + (s.w / n) * (i + 0.5), pm, zFace, zf, Math.min(0.018, (py1 - py0) * 0.35));
        pilot(p, s.w / 2 - 0.035, pm, zFace);
      }
      if (round) {
        // Round cast plates in a stainless top, each with a spill ring.
        housing(p, "steel", -s.w / 2, s.w / 2, bodyTop - 0.004, plateTop - 0.004, -s.d / 2, zf - STRIP + 0.03, TOP_RADIUS);
        const n = crepes(s.w);
        const cw = s.w / n;
        const r = Math.min(cw / 2 - 0.02, (s.d - STRIP) / 2 - 0.01);
        const cz = -s.d / 2 + (s.d - STRIP + 0.03) / 2;
        for (let i = 0; i < n; i++) {
          const cx = -s.w / 2 + cw * (i + 0.5);
          p.lathe("satin", cx, plateTop - 0.006, cz, [
            [r - 0.004, 0],
            [r + 0.006, 0],
            [r + 0.006, 0.006],
            [r + 0.002, 0.012],
            [r - 0.004, 0.012],
            [r - 0.004, 0],
          ]);
          p.lathe("plate", cx, plateTop - 0.006, cz, [
            [0, 0],
            [r - 0.003, 0],
            [r - 0.003, 0.016],
            [r - 0.006, 0.018],
            [0, 0.018],
          ]);
        }
        return;
      }
      // A thick plate with splash guards at the back and the sides, a grease gutter at the front
      // draining into the drawer under it.
      const mat: MaterialId = look === "induction" ? "chrome" : "plate";
      p.roundedBox(mat, -s.w / 2, s.w / 2, bodyTop, plateTop, -s.d / 2, zf - 0.004, TOP_RADIUS);
      splashGuards(p, s, plateTop - TOP_RADIUS, s.h, -s.d / 2 + (s.d - STRIP) * 0.5);
      p.roundedBox("slot", -s.w / 2 + 0.03, s.w / 2 - 0.03, plateTop - 0.002, plateTop + 0.0008, zf - STRIP + 0.005, zf - STRIP + 0.025, 0.01, "vertical");
      if (look === "griddle") {
        const dw = s.w - 0.06;
        p.roundedBox("steel", -dw / 2, dw / 2, y0 + 0.006, y0 + DRAWER, zf - 0.03, zf - 0.006, BODY_RADIUS, "top", "z");
        gripX(p, -0.05, 0.05, y0 + DRAWER / 2 + 0.003, zf - 0.006, 0.006);
      }
    },
  };
}

export const griddleTable = makePlate("griddleTable", "griddle");
export const inductionGriddle = makePlate("inductionGriddle", "induction");
export const crepeMaker = makePlate("crepeMaker", "crepe");
