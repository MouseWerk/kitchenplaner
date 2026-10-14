// The four elevations (Ansichten) as Drawings: a section through the room looking at one wall,
// with the equipment in front of it drawn far to near so nearer items cover farther ones.
//
// Drawing coordinates: X runs along the viewer's right axis u, Y = -height (y down on screen,
// so higher up is further up on the sheet). The floor is Y = 0.

import { dot, EPS, footprint, frontOf, openingSpan, walls } from "./geometry";
import { clampPartitionOpening, HATCH_SHELF_THICKNESS, openingSpanOnPartition, partitionAxes, partitionBand, partitionLength } from "./partitions";
import { positions } from "./project";
import type { Facing, Item, Opening, Partition, Project, Vec2 } from "./types";
import { mm, TEXT, type Drawing, type Pen, type Shape, type Fill } from "../render/drawing";
import { Front, rect, TOP } from "../kinds/parts/elevation";
import { kindDef, kindOf } from "../kinds/registry";

export interface ElevationOptions {
  showDims: boolean;
  /** Drawing units per paper millimetre (default 1:50); spaces the position numbers. */
  paperScale?: number;
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
  const scene: { depth: number; draw: () => void }[] = [];
  for (const p of room.partitions) {
    if (partitionLength(p) < EPS) continue;
    const band = partitionBand(room, p);
    const outline = [...band.start, ...band.end];
    scene.push({ depth: nearest(outline), draw: () => drawPartition(project, p, outline, u, v, shapes) });
  }
  for (const it of project.items) {
    scene.push({ depth: nearest(footprint(it)), draw: () => drawPlacedItem(it, u, v, pos, ps, shapes) });
  }
  // A stable sort keeps the list order for equal depths.
  scene.sort((a, b) => b.depth - a.depth);
  for (const s of scene) s.draw();

  if (opts.showDims) {
    // Width below the floor (left of a→b is up, so a negative offset), height left of the room.
    shapes.push({ t: "dim", pen: "dim", a: { x: x0, y: 0 }, b: { x: x1, y: 0 }, offset: -DIM_OFFSET, text: mm(x1 - x0) });
    shapes.push({ t: "dim", pen: "dim", a: { x: x0 - t, y: 0 }, b: { x: x0 - t, y: -H }, offset: DIM_OFFSET, text: mm(H) });
  }
  return { shapes };
}

function drawPlacedItem(it: Item, u: Vec2, v: Vec2, pos: Map<string, number>, ps: number, shapes: Shape[]) {
  const ext = footprint(it).map((p) => dot(p, u));
  const left = Math.min(...ext);
  const right = Math.max(...ext);
  const facesViewer = dot(frontOf(it.rotation), { x: -v.x, y: -v.y }) > FACES_VIEWER;
  drawItem(it, left, right, facesViewer, shapes);
  shapes.push({
    t: "text",
    pen: "item",
    itemId: it.id,
    p: { x: (left + right) / 2, y: -it.elevation - POS_LIFT * ps },
    text: String(pos.get(it.id) ?? ""),
    size: TEXT.normal,
    anchor: "middle",
    circled: true,
  });
}

/**
 * A partition as the viewer sees it: its outline (`outline`, the joined band) projected on the
 * view, from the floor to its height, covering what lies behind it.
 */
function drawPartition(project: Project, p: Partition, outline: Vec2[], u: Vec2, v: Vec2, shapes: Shape[]) {
  const xs = outline.map((q) => dot(q, u));
  const l = Math.min(...xs);
  const r = Math.max(...xs);
  const { dir, left } = partitionAxes(p);
  const endOn = Math.abs(dot(dir, v)) > WALL_FACES_VIEWER;
  shapes.push({ t: "poly", pen: "wall", fill: endOn ? "wall" : "item", pts: rect(l, r, 0, p.height), closed: true });
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
