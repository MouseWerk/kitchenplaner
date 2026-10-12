// A 2D drawing as a list of primitives: the plan and the elevations are built once into this
// form (`model/plan.ts`, `model/elevation.ts`) and the screen, the SVG export and the DXF
// export all draw the same list, so an export always matches what the view shows.
//
// Drawing units are millimetres of the real kitchen, y pointing down. Text sizes, dimension
// offsets and arrow lengths are given in millimetres on paper; a renderer multiplies them with
// its `paperScale` (drawing units per paper millimetre, 50 for 1:50).

import type { Vec2 } from "../model/types";
import { add, bounds, len, norm, scale, sub, type Box } from "../model/geometry";

/** What a line or area stands for; renderers map it to a pen and a fill. */
export type Pen =
  | "wall" // cut walls: filled, heavy outline
  | "opening" // door leaves, window panes
  | "swing" // door swing arcs, thin
  | "item" // the outline of equipment standing on the floor
  | "overhead" // equipment above (hoods, wall shelves): dashed
  | "detail" // inner details of equipment
  | "hidden" // edges behind other parts: dashed
  | "floor" // floor line of an elevation
  | "dim" // dimension lines
  | "frame"; // drawing frame and title block

export type Fill = "none" | "wall" | "item" | "item-dark" | "glass" | "warning";

/** CAD layer names for the DXF export. */
export const LAYER_OF: Record<Pen, string> = {
  wall: "WAENDE",
  opening: "OEFFNUNGEN",
  swing: "OEFFNUNGEN",
  item: "AUSSTATTUNG",
  overhead: "AUSSTATTUNG_OBEN",
  detail: "DETAILS",
  hidden: "DETAILS",
  floor: "WAENDE",
  dim: "BEMASSUNG",
  frame: "RAHMEN",
};

interface Base {
  pen: Pen;
  /** The item this shape belongs to (selection and hit testing). */
  itemId?: string;
}

export interface PolyShape extends Base {
  t: "poly";
  pts: Vec2[];
  closed: boolean;
  fill?: Fill;
}

export interface CircleShape extends Base {
  t: "circle";
  c: Vec2;
  r: number;
  fill?: Fill;
}

/** An arc from angle `a0` to `a1` (degrees, clockwise on screen from the +x axis). */
export interface ArcShape extends Base {
  t: "arc";
  c: Vec2;
  r: number;
  a0: number;
  a1: number;
}

export type Anchor = "start" | "middle" | "end";

export interface TextShape extends Base {
  t: "text";
  p: Vec2;
  text: string;
  /** Cap height on paper in mm. */
  size: number;
  anchor: Anchor;
  /** Rotation in degrees, clockwise on screen. */
  angle?: number;
  /** Draws a circle around the text (position numbers). */
  circled?: boolean;
}

/** A dimension between two points, its line `offset` paper mm to the left of a→b. */
export interface DimShape extends Base {
  t: "dim";
  a: Vec2;
  b: Vec2;
  offset: number;
  text: string;
}

export type Shape = PolyShape | CircleShape | ArcShape | TextShape | DimShape;

export interface Drawing {
  shapes: Shape[];
}

/** Standard text heights on paper (mm). */
export const TEXT = { small: 1.8, normal: 2.5, large: 3.5, title: 5 } as const;

/** Length of the extension lines past the dimension line, and the tick size (paper mm). */
const DIM_OVERSHOOT = 1.5;
const DIM_TICK = 1.2;
const DIM_TEXT_GAP = 1;

/** Lines and text of a dimension, in drawing units, for renderers that have no dimension entity. */
export function expandDim(d: DimShape, paperScale: number): { lines: [Vec2, Vec2][]; text: TextShape } {
  const dir = norm(sub(d.b, d.a));
  // Left of a→b on screen (y down).
  const left = { x: dir.y, y: -dir.x };
  const off = scale(left, d.offset * paperScale);
  const over = scale(left, Math.sign(d.offset || 1) * DIM_OVERSHOOT * paperScale);
  const a2 = add(d.a, off);
  const b2 = add(d.b, off);
  const tick = scale(norm(add(dir, left)), DIM_TICK * paperScale);
  const lines: [Vec2, Vec2][] = [
    [d.a, add(a2, over)],
    [d.b, add(b2, over)],
    [a2, b2],
    [sub(a2, tick), add(a2, tick)],
    [sub(b2, tick), add(b2, tick)],
  ];
  let angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  // Text stays readable: never upside down.
  if (angle > 90.01 || angle < -89.99) angle += 180;
  const r = { x: Math.cos((angle * Math.PI) / 180), y: Math.sin((angle * Math.PI) / 180) };
  // "Up" of the text as it is read (y points down on screen).
  const up = { x: r.y, y: -r.x };
  // The text sits on the side of the line away from the measured object; below the line its
  // baseline has to clear the text height as well.
  const side = d.offset >= 0 ? left : scale(left, -1);
  const mid = scale(add(a2, b2), 0.5);
  const lift = dot2(side, up) >= 0 ? DIM_TEXT_GAP : DIM_TEXT_GAP + TEXT.normal;
  const p = add(mid, scale(side, lift * paperScale));
  return { lines, text: { t: "text", pen: "dim", p, text: d.text, size: TEXT.normal, anchor: "middle", angle: normalizeTextAngle(angle) } };
}

const dot2 = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;

function normalizeTextAngle(a: number): number {
  const r = ((a % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/** The extent of a drawing in drawing units (text and dimensions estimated). */
export function drawingBounds(d: Drawing, paperScale: number): Box {
  const pts: Vec2[] = [];
  for (const s of d.shapes) {
    switch (s.t) {
      case "poly":
        pts.push(...s.pts);
        break;
      case "circle":
      case "arc":
        pts.push({ x: s.c.x - s.r, y: s.c.y - s.r }, { x: s.c.x + s.r, y: s.c.y + s.r });
        break;
      case "text": {
        const h = s.size * paperScale;
        const w = s.text.length * h * 0.6;
        pts.push({ x: s.p.x - w, y: s.p.y - h * 1.4 }, { x: s.p.x + w, y: s.p.y + h * 0.6 });
        break;
      }
      case "dim": {
        const e = expandDim(s, paperScale);
        for (const [a, b] of e.lines) pts.push(a, b);
        const h = e.text.size * paperScale;
        pts.push({ x: e.text.p.x - h, y: e.text.p.y - h * 1.4 }, { x: e.text.p.x + h, y: e.text.p.y + h });
        break;
      }
    }
  }
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  return bounds(pts);
}

/** Formats a length in mm the way plans show it: whole millimetres, no unit. */
export function mm(v: number): string {
  return String(Math.round(v));
}

/** The length of a polyline segment list; used by tests. */
export function pathLength(pts: readonly Vec2[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += len(sub(pts[i], pts[i - 1]));
  return l;
}
