// Elements of the cooking line without cooking zones, in its depths and module widths: a
// neutral element (work top with a drawer over an open base), a base cabinet with doors and a
// heated cabinet (Wärmeschrank) with a thermostat.

import { SHEET } from "../parts/mesh";
import { controlStrip, INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { lineFront, lineModule, type LineBase, type LineStrip } from "./common";

/** Thickness of the work top (m). */
const WORKTOP = 0.04;

function makeElement(kind: string, base: LineBase, strip: LineStrip, knobs: number): KindDef {
  return {
    kind,
    plan(s) {
      // The work top, its raised edge at the back.
      s.line("detail", [s.L, s.B + INSET], [s.R, s.B + INSET]);
      if (strip !== "none") controlStrip(s);
    },
    elevation(f) {
      lineFront(f, knobs, base, strip);
    },
    mesh(p, s) {
      lineModule(p, s, { base, knobs, underTop: s.h - WORKTOP, strip });
      p.box("steel", -s.w / 2, s.w / 2, s.h - WORKTOP, s.h - SHEET, -s.d / 2, s.d / 2);
      // The top with a raised edge at the back.
      p.box("steel", -s.w / 2, s.w / 2, s.h - SHEET, s.h, -s.d / 2, -s.d / 2 + INSET / 1000);
    },
  };
}

export const lineNeutral = makeElement("lineNeutral", "open", "drawer", 0);
export const lineCabinet = makeElement("lineCabinet", "doors", "none", 0);
export const lineHeatedCabinet = makeElement("lineHeatedCabinet", "heated", "knobs", 1);
