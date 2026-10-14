// The four elevations (Ansichten) as Drawings: a section through the room looking at one wall,
// with the equipment in front of it drawn far to near so nearer items cover farther ones.
//
// An elevation is a wall elevation (Wandabwicklung): the section plane stands a cut depth in front
// of the walls looked at, so the units across the room (an island, the pass at the opposite wall)
// do not hide the wall's own equipment. The cut can be widened to half the room or the whole room.
//
// Drawing coordinates: X runs along the viewer's right axis u, Y = -height (y down on screen,
// so higher up is further up on the sheet). The floor is Y = 0.

import { dot, EPS, footprint, frontOf, openingSpan, walls, type Wall } from "./geometry";
import { clampPartitionOpening, HATCH_SHELF_THICKNESS, openingSpanOnPartition, partitionAxes, partitionBand, partitionLength } from "./partitions";
import { positions } from "./project";
import type { Facing, Item, Opening, Partition, Project, Room, Vec2 } from "./types";
import { mm, TEXT, type Drawing, type Pen, type Shape, type Fill, type TextShape } from "../render/drawing";
import { CIRCLE_RADIUS } from "../render/svg";
import { Front, rect, TOP } from "../kinds/parts/elevation";
import { kindDef, kindOf } from "../kinds/registry";

/**
 * How deep in front of the walls looked at an elevation reaches: "wall" a fixed band
 * (`WALL_CUT_DEPTH`), "half" half the room's depth in the view direction, "room" the whole room
 * (everything projected, a view without a section).
 */
export type ElevationCut = "wall" | "half" | "room";
export const ELEVATION_CUTS: readonly ElevationCut[] = ["wall", "half", "room"];

/**
 * The default cut depth (mm). A 900 mm cooking line, a wall hood reaching 1100 to 1300 mm into
 * the room and a wall shelf lie inside it; a unit across the aisle (at least 1200 mm in front of a
 * 900 mm line, so from 2100 mm on) lies outside. A fixed depth rather than half the room: in a
 * deep room half of it reaches the island again, in a narrow one it cuts the cooking line.
 */
export const WALL_CUT_DEPTH = 1500;

export interface ElevationOptions {
  showDims: boolean;
  /** Drawing units per paper millimetre (default 1:50); spaces the position numbers. */
  paperScale?: number;
  /** How deep the elevation reaches into the room (default "wall"). */
  cut?: ElevationCut;
}

const DEFAULT_PAPER_SCALE = 50;

/**
 * The view direction `v` (unit vector from the viewer towards the wall looked at) and the right
 * axis `u` of the viewer, in plan coordinates (x east, y south).
 */
export function facingAxes(facing: Facing): { v: Vec2; u: Vec2 } {
  const v = VIEW_DIR[facing];
  return { v, u: { x: -v.y, y: v.x } };
}

const VIEW_DIR: Record<Facing, Vec2> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

/** An item counts as facing the viewer when its front is within about 45 degrees of the viewer. */
const FACES_VIEWER = 0.7;
/** A wall counts as the one looked at when its inward normal is within about 25 degrees of -v. */
const WALL_FACES_VIEWER = 0.9;
/**
 * A wall the cut depth is measured from: any wall turned towards the viewer at all (its inward
 * normal within about 85 degrees of -v), so a chamfered corner counts in both views beside it.
 */
const WALL_BACKS_VIEW = 0.1;
/** How far a point may lie behind the wall line and still count as standing at it (mm). */
const BEHIND_TOLERANCE = 1;
/** Gap between the bottom of an item and its position number (paper mm). */
const POS_LIFT = 3;
/** Distance of the dimension lines from the room section (paper mm). */
const DIM_OFFSET = 8;
/** Width of the frame drawn inside door and window openings (mm). */
const OPENING_FRAME = 60;

/**
 * The elevation looking towards `facing`: floor, the cut walls at both ends, the ceiling, the
 * openings of the wall looked at, and every item as a box from its elevation to its top with
 * front details when its front faces the viewer. Item shapes carry their `itemId`.
 *
 * Partitions stand in the room like items and are painted in the same far-to-near order: one
 * seen face-on as a wall surface with its openings, one seen end-on as a section band (wall
 * fill), any other as the surface it covers.
 *
 * Only what lies within the cut depth (`opts.cut`) in front of the walls looked at is drawn: an
 * item when its centre does (so most of it), a column also when the section plane cuts it, a
 * partition with its part inside the band and a section band where the plane cuts it.
 */
export function elevationDrawing(project: Project, facing: Facing, opts: ElevationOptions): Drawing {
  const ps = opts.paperScale ?? DEFAULT_PAPER_SCALE;
  const shapes: Shape[] = [];
  const { room } = project;
  if (room.points.length < 3) return { shapes };
  const { u, v } = facingAxes(facing);
  const H = room.height;
  const t = room.wallThickness;
  const xs = room.points.map((p) => dot(p, u));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);

  // Room section.
  shapes.push({ t: "poly", pen: "wall", fill: "wall", pts: rect(x0 - t, x0, 0, H), closed: true });
  shapes.push({ t: "poly", pen: "wall", fill: "wall", pts: rect(x1, x1 + t, 0, H), closed: true });
  shapes.push({ t: "poly", pen: "wall", pts: [{ x: x0, y: -H }, { x: x1, y: -H }], closed: false });
  shapes.push({ t: "poly", pen: "floor", pts: [{ x: x0 - t, y: 0 }, { x: x1 + t, y: 0 }], closed: false });

  const ws = walls(room);
  for (const o of room.openings) {
    if (o.partition !== undefined) continue;
    const w = ws[o.wall];
    if (!w || -dot(w.inward, v) < WALL_FACES_VIEWER) continue;
    const span = openingSpan(room, o);
    if (span) drawOpening(o, dot(span[0], u), dot(span[1], u), shapes);
  }

  // Painter's order: whatever has its nearest corner farthest from the viewer first.
  const nearest = (pts: Vec2[]) => Math.min(...pts.map((p) => dot(p, v)));
  const pos = positions(project);
  const D = cutDepth(room, facing, opts.cut ?? "wall");
  const depthOf = (p: Vec2, l = dot(p, u), r = l) => wallDepth(ws, u, v, p, l, r);
  const scene: { depth: number; draw: () => void }[] = [];
  // The position numbers go on top of all the units: painted with its unit, a number (lifted or
  // not) is covered by any nearer unit drawn after it, such as a hood over the oven's number.
  // Only a unit a nearer partition hides completely keeps its number hidden (`covers`).
  const labels: { label: TextShape; depth: number; l: number; r: number; top: number }[] = [];
  const covers: { depth: number; l: number; r: number; top: number }[] = [];
  for (const p of room.partitions) {
    if (partitionLength(p) < EPS) continue;
    const band = partitionBand(room, p);
    // The band as a polygon: along the left face from a to b, back along the right face.
    const outline = [band.start[0], band.end[0], band.end[1], band.start[1]];
    const kept = D === Infinity ? { pts: outline, cut: [] } : clipPolygon(outline, (q) => D - depthOf(q));
    if (kept.pts.length < 3) continue;
    const depth = nearest(kept.pts);
    const xs = kept.pts.map((q) => dot(q, u));
    covers.push({ depth, l: Math.min(...xs), r: Math.max(...xs), top: p.height });
    scene.push({ depth, draw: () => drawPartition(project, p, kept.pts, kept.cut, u, v, shapes) });
  }
  for (const it of project.items) {
    const fp = footprint(it);
    if (D !== Infinity) {
      const us = fp.map((q) => dot(q, u));
      const inBand = depthOf({ x: it.x, y: it.y }, Math.min(...us), Math.max(...us)) <= D;
      // A column the section plane cuts shows as a cut section, though its centre lies beyond.
      const cutColumn = !inBand && kindDef(kindOf(it.catalogId)).structural === true && fp.some((q) => depthOf(q) <= D);
      if (!inBand && !cutColumn) continue;
    }
    const depth = nearest(fp);
    scene.push({
      depth,
      draw: () => {
        const label = drawPlacedItem(it, u, v, pos, ps, shapes);
        const us = fp.map((q) => dot(q, u));
        labels.push({ label, depth, l: Math.min(...us), r: Math.max(...us), top: it.elevation + it.height });
      },
    });
  }
  // A stable sort keeps the list order for equal depths.
  scene.sort((a, b) => b.depth - a.depth);
  for (const s of scene) s.draw();
  const hidden = (x: (typeof labels)[number]) => covers.some((c) => c.depth < x.depth && c.l <= x.l + EPS && x.r <= c.r + EPS && x.top <= c.top + EPS);
  const shown = labels.filter((x) => !hidden(x)).map((x) => x.label);
  liftCrowdedNumbers(shown, ps);
  shapes.push(...shown);

  if (opts.showDims) {
    // Width below the floor (left of a→b is up, so a negative offset), height left of the room.
    shapes.push({ t: "dim", pen: "dim", a: { x: x0, y: 0 }, b: { x: x1, y: 0 }, offset: -DIM_OFFSET, text: mm(x1 - x0) });
    shapes.push({ t: "dim", pen: "dim", a: { x: x0 - t, y: 0 }, b: { x: x0 - t, y: -H }, offset: DIM_OFFSET, text: mm(H) });
  }
  return { shapes };
}

/**
 * The cut depth in mm: "wall" `WALL_CUT_DEPTH`, "half" half the room's extent along the view
 * direction, "room" no limit (Infinity).
 */
export function cutDepth(room: Pick<Room, "points">, facing: Facing, cut: ElevationCut): number {
  if (cut === "room" || room.points.length < 3) return Infinity;
  if (cut === "wall") return WALL_CUT_DEPTH;
  const { v } = facingAxes(facing);
  const ds = room.points.map((p) => dot(p, v));
  return (Math.max(...ds) - Math.min(...ds)) / 2;
}

/**
 * How far `p` stands in front of the nearest wall behind it, measured along the view direction,
 * among the walls turned towards the viewer. `l`..`r` is the stretch along u the thing covers: a
 * wall counts when it overlaps that stretch, at the point of it nearest to `p` along u. So in an
 * L-shaped room a unit is measured from the near leg when it stands in front of it, from the far
 * leg elsewhere. Infinity when no wall lies behind it.
 */
function wallDepth(ws: readonly Wall[], u: Vec2, v: Vec2, p: Vec2, l: number, r: number): number {
  const pu = dot(p, u);
  const pv = dot(p, v);
  let best = Infinity;
  for (const w of ws) {
    if (-dot(w.inward, v) < WALL_BACKS_VIEW) continue;
    const au = dot(w.a, u);
    const bu = dot(w.b, u);
    const lo = Math.min(au, bu);
    const hi = Math.max(au, bu);
    if (hi - lo < EPS || hi < l - EPS || lo > r + EPS) continue;
    const at = Math.min(hi, Math.max(lo, pu));
    const wv = dot(w.a, v) + ((at - au) / (bu - au)) * (dot(w.b, v) - dot(w.a, v));
    const d = wv - pv;
    if (d >= -BEHIND_TOLERANCE) best = Math.min(best, Math.max(0, d));
  }
  return best;
}

/**
 * The part of a convex polygon where `f` >= 0, with f taken as linear along each edge, and the
 * points where the outline crosses f = 0 (the section through the polygon).
 */
export function clipPolygon(pts: readonly Vec2[], f: (p: Vec2) => number): { pts: Vec2[]; cut: Vec2[] } {
  const out: Vec2[] = [];
  const cut: Vec2[] = [];
  const fs = pts.map(f);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const [a, b, fa, fb] = [pts[i], pts[j], fs[i], fs[j]];
    if (fa >= 0) out.push(a);
    if ((fa >= 0) === (fb >= 0)) continue;
    // An end with no wall behind it (f = -Infinity) has no place to interpolate to: the section
    // sits at the end inside the band.
    const k = Number.isFinite(fa) && Number.isFinite(fb) ? fa / (fa - fb) : fa >= 0 ? 0 : 1;
    const q = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    out.push(q);
    cut.push(q);
  }
  return { pts: out, cut };
}

/** Draws one item and returns its position number (not yet added to `shapes`). */
function drawPlacedItem(it: Item, u: Vec2, v: Vec2, pos: Map<string, number>, ps: number, shapes: Shape[]): TextShape {
  const ext = footprint(it).map((p) => dot(p, u));
  const left = Math.min(...ext);
  const right = Math.max(...ext);
  const facesViewer = dot(frontOf(it.rotation), { x: -v.x, y: -v.y }) > FACES_VIEWER;
  drawItem(it, left, right, facesViewer, shapes);
  return {
    t: "text",
    pen: "item",
    itemId: it.id,
    p: { x: (left + right) / 2, y: -it.elevation - POS_LIFT * ps },
    text: String(pos.get(it.id) ?? ""),
    size: TEXT.normal,
    anchor: "middle",
    circled: true,
  };
}

/** Least gap between two position circles (paper mm). */
const POS_GAP = 0.5;
/** How many circle heights a crowded number may rise, and how many circles it may move aside. */
const POS_MAX_LIFT = 12;
const POS_MAX_SHIFT = 2;

/**
 * Moves a position number that would overlap one placed before it to the nearest free place:
 * up one circle at a time, then also a circle or two aside. Narrow units side by side (a 400 mm
 * fryer next to a pasta cooker) and units seen behind one another keep readable numbers.
 * Numbers are placed from the lowest, left to right, so the result does not depend on the
 * painting order.
 */
function liftCrowdedNumbers(labels: TextShape[], ps: number) {
  const r = TEXT.normal * CIRCLE_RADIUS * ps;
  const clear = 2 * r + POS_GAP * ps;
  const order = [...labels].sort((a, b) => b.p.y - a.p.y || a.p.x - b.p.x);
  const placed: Vec2[] = [];
  for (const l of order) {
    const free = (q: Vec2) => placed.every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= clear - EPS);
    let found: Vec2 | null = null;
    search: for (let lift = 0; lift <= POS_MAX_LIFT; lift++) {
      for (let k = 0; k <= 2 * POS_MAX_SHIFT; k++) {
        // Aside in the order 0, +1, -1, +2, -2 circles.
        const dx = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2);
        const q = { x: l.p.x + dx * clear, y: l.p.y - lift * clear };
        if (free(q)) {
          found = q;
          break search;
        }
      }
    }
    // At a very coarse scale every place nearby may be taken (the circles grow, the room does
    // not): then further up until free, which always ends, rather than on top of another number.
    for (let lift = POS_MAX_LIFT + 1; !found; lift++) {
      const q = { x: l.p.x, y: l.p.y - lift * clear };
      if (free(q)) found = q;
    }
    l.p = found;
    placed.push(l.p);
  }
}

/**
 * A partition as the viewer sees it: its outline (`outline`, the part of the joined band within
 * the cut depth) projected on the view, from the floor to its height, covering what lies behind
 * it. Where the section plane cuts it (`cut`, the crossing points) a section band goes on top.
 */
function drawPartition(project: Project, p: Partition, outline: Vec2[], cut: Vec2[], u: Vec2, v: Vec2, shapes: Shape[]) {
  const xs = outline.map((q) => dot(q, u));
  const l = Math.min(...xs);
  const r = Math.max(...xs);
  const { dir, left } = partitionAxes(p);
  const endOn = Math.abs(dot(dir, v)) > WALL_FACES_VIEWER;
  shapes.push({ t: "poly", pen: "wall", fill: endOn ? "wall" : "item", pts: rect(l, r, 0, p.height), closed: true });
  if (!endOn && cut.length >= 2) {
    const cs = cut.map((q) => dot(q, u));
    const cl = Math.min(...cs);
    const cr = Math.max(...cs);
    if (cr - cl > EPS) shapes.push({ t: "poly", pen: "wall", fill: "wall", pts: rect(cl, cr, 0, p.height), closed: true });
  }
  if (Math.abs(dot(left, v)) < WALL_FACES_VIEWER) return;
  for (const o of project.room.openings) {
    if (o.partition !== p.id) continue;
    const c = clampPartitionOpening(p, o);
    // An opening reaching above a half-height partition shows only up to its top.
    const height = Math.min(c.height, p.height - c.sill);
    if (height <= 0) continue;
    const [a, b] = openingSpanOnPartition(p, c);
    drawOpening({ ...c, height }, dot(a, u), dot(b, u), shapes);
  }
}

function drawOpening(o: Opening, a: number, b: number, shapes: Shape[]) {
  const l = Math.min(a, b);
  const r = Math.max(a, b);
  const z0 = o.sill;
  const z1 = o.sill + o.height;
  if (o.kind === "passage") {
    shapes.push({ t: "poly", pen: "hidden", pts: rect(l, r, z0, z1), closed: true });
    return;
  }
  shapes.push({ t: "poly", pen: "opening", pts: rect(l, r, z0, z1), closed: true });
  const f = OPENING_FRAME;
  if (o.kind === "window") {
    shapes.push({ t: "poly", pen: "opening", fill: "glass", pts: rect(l + f, r - f, z0 + f, z1 - f), closed: true });
  } else if (o.kind === "hatch") {
    // The counter shelf on the sill, as wide as the opening.
    shapes.push({ t: "poly", pen: "detail", fill: "item-dark", pts: rect(l, r, z0 - HATCH_SHELF_THICKNESS, z0), closed: true });
  } else {
    // The frame inside the opening; doors have no frame along the floor.
    shapes.push({ t: "poly", pen: "opening", pts: [{ x: l + f, y: -z0 }, { x: l + f, y: -(z1 - f) }, { x: r - f, y: -(z1 - f) }, { x: r - f, y: -z0 }], closed: false });
  }
}

/**
 * One item as a box from its elevation to its top, drawn by its kind: the parts below it (a
 * stand), and the front details when its front faces the viewer, else the side view.
 */
function drawItem(it: Item, l: number, r: number, facesViewer: boolean, shapes: Shape[]) {
  const def = kindDef(kindOf(it.catalogId));
  const f = new Front(it, l, r, shapes);
  const bodyFill: Fill = def.structural ? "wall" : "item";
  const bodyPen: Pen = def.structural ? "wall" : def.placement === "overhead" ? "overhead" : "item";

  def.elevationBase?.(f);
  f.box(bodyPen, l, r, f.z0, f.top, bodyFill);

  if (facesViewer) def.elevation(f);
  else if (def.elevationSide) def.elevationSide(f);
  else if (it.height > TOP * 2) f.line("detail", [l, f.top - TOP], [r, f.top - TOP]);
}
