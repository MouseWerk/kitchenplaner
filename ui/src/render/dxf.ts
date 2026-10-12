// DXF export (AutoCAD R12, ASCII): the oldest widely read CAD format, so every CAD program a
// kitchen planner or architect uses can open the plan. One layer per kind of line (LAYER_OF),
// y flipped (DXF y points up), dimensions as plain lines and text.

import { drawingBounds, expandDim, LAYER_OF, type Drawing, type Pen, type Shape, type TextShape } from "./drawing";
import { PEN_STYLE } from "./style";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS } from "./svg";
import type { Vec2 } from "../model/types";

/** CRLF throughout, as AutoCAD writes it. */
const EOL = "\r\n";

/** $INSUNITS value for millimetres. */
const INSUNITS_MM = 4;

/** AutoCAD color index of each layer (7 = black/white, 8 = grey, 4 = cyan, 6 = magenta, 3 = green). */
const LAYER_COLOR: Record<string, number> = {
  WAENDE: 7,
  OEFFNUNGEN: 4,
  AUSSTATTUNG: 7,
  AUSSTATTUNG_OBEN: 6,
  DETAILS: 8,
  BEMASSUNG: 3,
  RAHMEN: 7,
};
const DEFAULT_COLOR = 7;

/** Line type per pen: the dashed pens get their own DXF line type, the rest CONTINUOUS. */
const LTYPE_OF: Partial<Record<Pen, string>> = { overhead: "DASHED", hidden: "HIDDEN" };

/** DXF TEXT horizontal justification (group 72): 0 left, 1 center, 2 right, 4 middle (both axes). */
const JUSTIFY = { start: 0, middle: 1, end: 2 } as const;
const JUSTIFY_MIDDLE = 4;

/** A number for DXF: four decimals at most, no exponent, no "-0". */
function n(v: number): string {
  const r = Math.round(v * 10000) / 10000;
  return r === 0 ? "0" : r.toFixed(4).replace(/\.?0+$/, "");
}

/** Normalizes an angle in degrees to [0, 360). */
function deg360(a: number): number {
  const r = ((a % 360) + 360) % 360;
  return Math.abs(r - 360) < 1e-9 ? 0 : r;
}

/**
 * Text for an R12 file: characters above ASCII as \U+XXXX (R12 has no UTF-8), line breaks as
 * spaces. Characters outside the Basic Multilingual Plane cannot be written and become "?".
 */
export function dxfText(s: string): string {
  let out = "";
  for (const ch of s.replace(/[\r\n\t]+/g, " ")) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 32) continue;
    if (cp <= 127) out += ch;
    else if (cp <= 0xffff) out += `\\U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    else out += "?";
  }
  return out;
}

/**
 * Converts an arc of a Drawing (clockwise on screen from a0 to a1, y down) to a DXF ARC
 * (counter-clockwise from start to end, y up). Flipping y mirrors every angle (a → -a) and turns
 * clockwise into counter-clockwise, so the arc now runs from -a1 to -a0.
 */
export function dxfArcAngles(a0: number, a1: number): { start: number; end: number } {
  return { start: deg360(-a1), end: deg360(-a0) };
}

class Writer {
  private readonly lines: string[] = [];

  pair(code: number, value: string | number) {
    this.lines.push(String(code), typeof value === "number" ? n(value) : value);
  }

  /** A point: x at `code`, y at `code + 10`, z at `code + 20`, y flipped. */
  point(code: number, p: Vec2) {
    this.pair(code, p.x);
    this.pair(code + 10, -p.y);
    this.pair(code + 20, 0);
  }

  toString(): string {
    return this.lines.join(EOL) + EOL;
  }
}

/**
 * The drawing as an ASCII DXF R12 file (AC1009) in millimetres. Text heights and dash lengths
 * are paper sizes times `paperScale`, so the file plots at that scale like the SVG.
 */
export function drawingToDxf(drawing: Drawing, paperScale: number): string {
  const w = new Writer();
  const box = drawingBounds(drawing, paperScale);

  w.pair(0, "SECTION");
  w.pair(2, "HEADER");
  w.pair(9, "$ACADVER");
  w.pair(1, "AC1009");
  w.pair(9, "$INSUNITS");
  w.pair(70, String(INSUNITS_MM));
  // Flipping y swaps which corner is the minimum.
  w.pair(9, "$EXTMIN");
  w.point(10, { x: box.minX, y: box.maxY });
  w.pair(9, "$EXTMAX");
  w.point(10, { x: box.maxX, y: box.minY });
  w.pair(0, "ENDSEC");

  w.pair(0, "SECTION");
  w.pair(2, "TABLES");
  writeLtypes(w, paperScale);
  writeLayers(w);
  w.pair(0, "ENDSEC");

  w.pair(0, "SECTION");
  w.pair(2, "ENTITIES");
  for (const s of drawing.shapes) writeShape(w, s, paperScale);
  w.pair(0, "ENDSEC");
  w.pair(0, "EOF");
  return w.toString();
}

function writeLtypes(w: Writer, ps: number) {
  const dashed = (Object.entries(LTYPE_OF) as [Pen, string][]).map(([pen, name]) => ({ name, dash: PEN_STYLE[pen].dash ?? [] }));
  w.pair(0, "TABLE");
  w.pair(2, "LTYPE");
  w.pair(70, String(1 + dashed.length));
  w.pair(0, "LTYPE");
  w.pair(2, "CONTINUOUS");
  w.pair(70, "0");
  w.pair(3, "Solid line");
  w.pair(72, "65");
  w.pair(73, "0");
  w.pair(40, 0);
  for (const lt of dashed) {
    // Alternating dash (positive) and gap (negative) lengths in drawing units.
    const elems = lt.dash.map((d, i) => (i % 2 === 0 ? d : -d) * ps);
    w.pair(0, "LTYPE");
    w.pair(2, lt.name);
    w.pair(70, "0");
    w.pair(3, "__ __ __");
    w.pair(72, "65");
    w.pair(73, String(elems.length));
    w.pair(40, elems.reduce((s, e) => s + Math.abs(e), 0));
    for (const e of elems) w.pair(49, e);
  }
  w.pair(0, "ENDTAB");
}

/** The layer names in a stable order, without duplicates. */
export function dxfLayers(): string[] {
  return [...new Set(Object.values(LAYER_OF))];
}

function writeLayers(w: Writer) {
  const layers = dxfLayers();
  w.pair(0, "TABLE");
  w.pair(2, "LAYER");
  w.pair(70, String(layers.length));
  for (const name of layers) {
    w.pair(0, "LAYER");
    w.pair(2, name);
    w.pair(70, "0");
    w.pair(62, String(LAYER_COLOR[name] ?? DEFAULT_COLOR));
    w.pair(6, "CONTINUOUS");
  }
  w.pair(0, "ENDTAB");
}

function entity(w: Writer, type: string, pen: Pen) {
  w.pair(0, type);
  w.pair(8, LAYER_OF[pen]);
  const lt = LTYPE_OF[pen];
  if (lt) w.pair(6, lt);
}

function writeLine(w: Writer, pen: Pen, a: Vec2, b: Vec2) {
  entity(w, "LINE", pen);
  w.point(10, a);
  w.point(11, b);
}

/** Cap height of the SVG and screen fonts per em: DXF text height is the cap height. */
const CAP_HEIGHT_PER_EM = 0.7;

function writeText(w: Writer, s: TextShape, ps: number) {
  const em = s.size * ps;
  const h = em * CAP_HEIGHT_PER_EM;
  if (s.circled) {
    const c = { x: s.p.x, y: s.p.y - em * CIRCLE_CENTER_RISE };
    entity(w, "CIRCLE", "detail");
    w.point(10, c);
    w.pair(40, em * CIRCLE_RADIUS);
    entity(w, "TEXT", s.pen);
    w.point(10, c);
    w.pair(40, h);
    w.pair(1, dxfText(s.text));
    w.pair(72, String(JUSTIFY_MIDDLE));
    w.point(11, c);
    return;
  }
  entity(w, "TEXT", s.pen);
  w.point(10, s.p);
  w.pair(40, h);
  w.pair(1, dxfText(s.text));
  // Screen angles turn clockwise, DXF angles counter-clockwise.
  if (s.angle) w.pair(50, deg360(-s.angle));
  const just = JUSTIFY[s.anchor];
  if (just !== 0) {
    w.pair(72, String(just));
    w.point(11, s.p);
  }
}

function writeShape(w: Writer, s: Shape, ps: number) {
  switch (s.t) {
    case "poly": {
      if (s.pts.length < 2) return;
      // Cut walls and columns are filled: R12 has no hatch, so as SOLID triangles.
      if (s.closed && s.fill === "wall") {
        for (const [a, b, c] of triangulate(s.pts)) {
          entity(w, "SOLID", s.pen);
          w.point(10, a);
          w.point(11, b);
          w.point(12, c);
          // A triangle repeats its last corner as the fourth.
          w.point(13, c);
        }
      }
      if (s.pts.length === 2 && !s.closed) {
        writeLine(w, s.pen, s.pts[0], s.pts[1]);
        return;
      }
      entity(w, "POLYLINE", s.pen);
      w.pair(66, "1");
      w.point(10, { x: 0, y: 0 });
      w.pair(70, s.closed ? "1" : "0");
      for (const p of s.pts) {
        w.pair(0, "VERTEX");
        w.pair(8, LAYER_OF[s.pen]);
        w.point(10, p);
      }
      w.pair(0, "SEQEND");
      w.pair(8, LAYER_OF[s.pen]);
      return;
    }
    case "circle":
      entity(w, "CIRCLE", s.pen);
      w.point(10, s.c);
      w.pair(40, s.r);
      return;
    case "arc": {
      const { start, end } = dxfArcAngles(s.a0, s.a1);
      entity(w, "ARC", s.pen);
      w.point(10, s.c);
      w.pair(40, s.r);
      w.pair(50, start);
      w.pair(51, end);
      return;
    }
    case "text":
      writeText(w, s, ps);
      return;
    case "dim": {
      const e = expandDim(s, ps);
      for (const [a, b] of e.lines) writeLine(w, "dim", a, b);
      writeText(w, e.text, ps);
      return;
    }
  }
}

/**
 * Triangles covering a simple polygon (ear clipping). Degenerate corners (zero-width seams of a
 * wall ring) are tolerated: a corner whose triangle has no area is cut off without output.
 */
export function triangulate(pts: readonly Vec2[]): [Vec2, Vec2, Vec2][] {
  const crossAt = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const sign = area2 >= 0 ? 1 : -1;
  const idx = pts.map((_, i) => i);
  const out: [Vec2, Vec2, Vec2][] = [];
  // Each pass removes one corner; a polygon that is not simple stops cutting instead of looping.
  let guard = pts.length * pts.length;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const a = pts[idx[(k + idx.length - 1) % idx.length]];
      const b = pts[idx[k]];
      const c = pts[idx[(k + 1) % idx.length]];
      const cr = crossAt(a, b, c) * sign;
      if (cr < 0) continue;
      if (cr > 1e-9) {
        const inside = idx.some((j) => {
          const p = pts[j];
          const same = (q: Vec2) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
          if (same(a) || same(b) || same(c)) return false;
          return crossAt(a, b, p) * sign > 0 && crossAt(b, c, p) * sign > 0 && crossAt(c, a, p) * sign > 0;
        });
        if (inside) continue;
        out.push([a, b, c]);
      }
      idx.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) {
    const [a, b, c] = idx.map((i) => pts[i]);
    if (Math.abs(crossAt(a, b, c)) > 1e-9) out.push([a, b, c]);
  }
  return out;
}
