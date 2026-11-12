// The elevations (Ansichten) as Drawings: a section through the room looking at a wall, with the
// equipment in front of it drawn far to near so nearer items cover farther ones.
//
// An elevation is a wall elevation (Wandabwicklung): the section plane stands a cut depth in front
// of the walls looked at, so the units across the room (an island, the pass at the opposite wall)
// do not hide the wall's own equipment. The cut can be widened to half the room or the whole room.
//
// There are two kinds (`ElevationId`). A compass view looks north, east, south or west at every
// wall turned that way, across the whole room: the familiar four of a rectangular room, and in an
// L-shaped room both legs at once. A wall view looks at one wall face-on, from corner to corner:
// the only true view of a slanted wall (a 45° chamfer), which no compass view sees face-on.
//
// Drawing coordinates: X runs along the viewer's right axis u, Y = -height (y down on screen,
// so higher up is further up on the sheet). The floor is Y = 0.

import { dot, EPS, footprint, frontOf, openingSpan, walls, type Wall } from "./geometry";
import { clampPartitionOpening, HATCH_SHELF_THICKNESS, openingSpanOnPartition, partitionAxes, partitionBand, partitionLength } from "./partitions";
import { doorSetup, HANDLE_HEIGHT, HANDLE_LENGTH, SLIDE_OVERLAP, TRACK_HEIGHT } from "./doors";
import { positions } from "./project";
import { FACINGS, type Facing, type Item, type Opening, type Partition, type Project, type Room, type Vec2 } from "./types";
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
 * Which elevation: a compass view (`Facing`), or `wall-<i>` looking at wall i face-on, the wall
 * from corner i to corner i + 1 (the index openings use). Not stored in the project: a view
 * setting like the cut depth.
 */
export type ElevationId = Facing | `wall-${number}`;

export function wallElevation(index: number): ElevationId {
  return `wall-${index}`;
}

/** The wall index of a wall view, null for a compass view. */
export function elevationWallIndex(id: ElevationId): number | null {
  if (!id.startsWith("wall-")) return null;
  const n = Number(id.slice(5));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Whether the room has this elevation: always a compass view, a wall view while the wall exists. */
export function elevationExists(room: Pick<Room, "points">, id: ElevationId): boolean {
  const i = elevationWallIndex(id);
  if (i === null) return FACINGS.includes(id as Facing);
  return i < room.points.length && room.points.length >= 3 && walls(room)[i].length >= EPS;
}

/**
 * The elevation to show for `id`: itself while the room has it, else the north view. A wall view
 * outlives the wall it names (corners deleted, a new room) as a choice of the pane; resolving it
 * at the point of drawing brings it back after an undo instead of losing it.
 */
export function resolveElevation(room: Pick<Room, "points">, id: ElevationId): ElevationId {
  return elevationExists(room, id) ? id : "north";
}

/**
 * The walls no compass view sees face-on (a 45° chamfer, a wall at an angle): their openings and
 * the true width of their units show only in a view of their own.
 */
export function slantedWalls(room: Pick<Room, "points">): number[] {
  if (room.points.length < 3) return [];
  return walls(room)
    .filter((w) => w.length >= EPS && FACINGS.every((f) => -dot(w.inward, VIEW_DIR[f]) < WALL_FACES_VIEWER))
    .map((w) => w.index);
}

/** The elevations that together show every wall true: the four compass views, then each slanted wall. */
export function standardElevations(room: Pick<Room, "points">): ElevationId[] {
  return [...FACINGS, ...slantedWalls(room).map(wallElevation)];
}

/**
 * The view direction `v` (unit vector from the viewer towards the wall looked at) and the right
 * axis `u` of the viewer, in plan coordinates (x east, y south).
 */
export function facingAxes(facing: Facing): { v: Vec2; u: Vec2 } {
  const v = VIEW_DIR[facing];
  return { v, u: { x: -v.y, y: v.x } };
}

/** The axes of any elevation; a wall view looks against the wall's inward normal. Null when the wall does not exist. */
export function elevationAxes(room: Pick<Room, "points">, id: ElevationId): { v: Vec2; u: Vec2 } | null {
  const i = elevationWallIndex(id);
  if (i === null) return facingAxes(id as Facing);
  if (!elevationExists(room, id)) return null;
  const n = walls(room)[i].inward;
  const v = { x: -n.x, y: -n.y };
  return { v, u: { x: -v.y, y: v.x } };
}

/** What an elevation shows of the room: its axes, the stretch along u and which walls count. */
interface ElevationFrame {
  u: Vec2;
  v: Vec2;
  /** The stretch along u between the cut walls, and how wide each cut wall is drawn. */
  x0: number;
  x1: number;
  endLeft: number;
  endRight: number;
  /** The walls the cut depth is measured from. */
  backs: (w: Wall) => boolean;
  /** The walls seen face-on, whose openings are drawn. */
  faced: (w: Wall) => boolean;
  /** Only what stands in front of x0..x1 (a wall view); a compass view shows the whole room. */
  span: boolean;
}

/**
 * Below this |cos| between a neighbouring wall and the view direction the neighbour runs nearly
 * along the wall looked at, and its section would grow without bound: drawn as thick as the wall.
 */
const MIN_END_COS = 0.2;

function elevationFrame(room: Room, id: ElevationId): ElevationFrame | null {
  const axes = elevationAxes(room, id);
  if (!axes) return null;
  const { u, v } = axes;
  const t = room.wallThickness;
  const ws = walls(room);
  const i = elevationWallIndex(id);
  if (i === null) {
    const xs = room.points.map((p) => dot(p, u));
    return {
      u,
      v,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      endLeft: t,
      endRight: t,
      backs: (w) => -dot(w.inward, v) >= WALL_BACKS_VIEW,
      faced: (w) => -dot(w.inward, v) >= WALL_FACES_VIEWER,
      span: false,
    };
  }
  const w = ws[i];
  const prev = ws[(i - 1 + ws.length) % ws.length];
  const next = ws[(i + 1) % ws.length];
  // The section plane parallel to the wall cuts a neighbour standing at an angle wider than it is
  // thick: a 45° chamfer's neighbours show t·√2.
  const endOf = (nb: Wall) => {
    const c = Math.abs(dot(nb.dir, v));
    return c > MIN_END_COS ? t / c : t;
  };
  const au = dot(w.a, u);
  const bu = dot(w.b, u);
  const [x0, endLeft, x1, endRight] = au <= bu ? [au, endOf(prev), bu, endOf(next)] : [bu, endOf(next), au, endOf(prev)];
  return { u, v, x0, x1, endLeft, endRight, backs: (x) => x.index === i, faced: (x) => x.index === i, span: true };
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
 * The elevation `id` (a compass view or one wall): floor, the cut walls at both ends, the ceiling,
 * the openings of the walls looked at, and every item as a box from its elevation to its top with
 * front details when its front faces the viewer. Item shapes carry their `itemId`. A wall view
 * reaches from corner to corner of its wall and shows what stands in front of it (an item whose
 * centre does); its dimension is the wall's length. A wall that does not exist draws nothing.
 *
 * Partitions stand in the room like items and are painted in the same far-to-near order: one
 * seen face-on as a wall surface with its openings, one seen end-on as a section band (wall
 * fill), any other as the surface it covers.
 *
 * Only what lies within the cut depth (`opts.cut`) in front of the walls looked at is drawn: an
 * item when its centre does (so most of it), a column also when the section plane cuts it, a
 * partition with its part inside the band and a section band where the plane cuts it.
 */
export function elevationDrawing(project: Project, id: ElevationId, opts: ElevationOptions): Drawing {
  const ps = opts.paperScale ?? DEFAULT_PAPER_SCALE;
  const shapes: Shape[] = [];
  const { room } = project;
  if (room.points.length < 3) return { shapes };
  const frame = elevationFrame(room, id);
  if (!frame) return { shapes };
  const { u, v, x0, x1, endLeft, endRight } = frame;
  const H = room.height;

  // Room section.
  shapes.push({ t: "poly", pen: "wall", fill: "wall", pts: rect(x0 - endLeft, x0, 0, H), closed: true });
  shapes.push({ t: "poly", pen: "wall", fill: "wall", pts: rect(x1, x1 + endRight, 0, H), closed: true });
  shapes.push({ t: "poly", pen: "wall", pts: [{ x: x0, y: -H }, { x: x1, y: -H }], closed: false });
  shapes.push({ t: "poly", pen: "floor", pts: [{ x: x0 - endLeft, y: 0 }, { x: x1 + endRight, y: 0 }], closed: false });

  const ws = walls(room);
  for (const o of room.openings) {
    if (o.partition !== undefined) continue;
    const w = ws[o.wall];
    if (!w || !frame.faced(w)) continue;
    const span = openingSpan(room, o);
    // Seen from inside the room: a door opening in opens towards the viewer.
    if (span) drawOpening(o, dot(span[0], u), dot(span[1], u), doorSetup(o).swing === "in", shapes);
  }

  // Painter's order: whatever has its nearest corner farthest from the viewer first.
  const nearest = (pts: Vec2[]) => Math.min(...pts.map((p) => dot(p, v)));
  const pos = positions(project);
  const D = cutDepth(room, id, opts.cut ?? "wall");
  const backing = ws.filter(frame.backs);
  const depthOf = (p: Vec2, l = dot(p, u), r = l) => wallDepth(backing, u, v, p, l, r);
  // A wall view keeps to the stretch in front of its wall.
  const inSpan = (x: number) => !frame.span || (x >= x0 - EPS && x <= x1 + EPS);
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
    let outline = [band.start[0], band.end[0], band.end[1], band.start[1]];
    // Cut off at the ends of a wall view's stretch; only the section plane makes a section band.
    if (frame.span) outline = clipPolygon(clipPolygon(outline, (q) => dot(q, u) - x0).pts, (q) => x1 - dot(q, u)).pts;
    if (outline.length < 3) continue;
    const kept = D === Infinity ? { pts: outline, cut: [] } : clipPolygon(outline, (q) => D - depthOf(q));
    if (kept.pts.length < 3) continue;
    const depth = nearest(kept.pts);
    const xs = kept.pts.map((q) => dot(q, u));
    covers.push({ depth, l: Math.min(...xs), r: Math.max(...xs), top: p.height });
    scene.push({ depth, draw: () => drawPartition(project, p, kept.pts, kept.cut, u, v, shapes) });
  }
  for (const it of project.items) {
    const fp = footprint(it);
    if (!inSpan(dot({ x: it.x, y: it.y }, u))) continue;
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
    shapes.push({ t: "dim", pen: "dim", a: { x: x0 - endLeft, y: 0 }, b: { x: x0 - endLeft, y: -H }, offset: DIM_OFFSET, text: mm(H) });
  }
  return { shapes };
}

/**
 * The cut depth in mm: "wall" `WALL_CUT_DEPTH`, "half" half the room's extent along the view
 * direction (for a wall view: across the room from that wall), "room" no limit (Infinity).
 */
export function cutDepth(room: Pick<Room, "points">, id: ElevationId, cut: ElevationCut): number {
  if (cut === "room" || room.points.length < 3) return Infinity;
  if (cut === "wall") return WALL_CUT_DEPTH;
  const axes = elevationAxes(room, id);
  if (!axes) return Infinity;
  const ds = room.points.map((p) => dot(p, axes.v));
  return (Math.max(...ds) - Math.min(...ds)) / 2;
}

/**
 * How far `p` stands in front of the nearest wall behind it, measured along the view direction,
 * among the walls the view measures from (`ws`: for a compass view those turned towards the
 * viewer, for a wall view the wall). `l`..`r` is the stretch along u the thing covers: a wall
 * counts when it overlaps that stretch, at the point of it nearest to `p` along u. So in an
 * L-shaped room a unit is measured from the near leg when it stands in front of it, from the far
 * leg elsewhere. Infinity when no wall lies behind it.
 */
function wallDepth(ws: readonly Wall[], u: Vec2, v: Vec2, p: Vec2, l: number, r: number): number {
  const pu = dot(p, u);
  const pv = dot(p, v);
  let best = Infinity;
  for (const w of ws) {
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
    const towards = doorSetup(c).swing === "in" ? -dot(left, v) > 0 : dot(left, v) > 0;
    drawOpening({ ...c, height }, dot(a, u), dot(b, u), towards, shapes);
  }
}

/**
 * An opening seen face-on; `a` and `b` are where its start and end lie along the view. Doors show
 * their frame and leaves. A hinged leaf carries the opening triangle (DIN 1356): its tip points
 * to the hinge side, drawn solid when the leaf opens towards the viewer (`towards`) and dashed
 * when it opens away; the handle sits at the lock edge of the active leaf. A sliding door shows
 * its leaf overlapping the opening, the track above it reaching over the parking place, and an
 * arrow the way it opens; dashed when it runs on the far face.
 */
function drawOpening(o: Opening, a: number, b: number, towards: boolean, shapes: Shape[]) {
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
  } else if (o.kind === "slidingDoor") {
    drawSlidingDoorFace(o, a, b, towards, shapes);
  } else {
    // The frame inside the opening; doors have no frame along the floor.
    shapes.push({ t: "poly", pen: "opening", pts: [{ x: l + f, y: -z0 }, { x: l + f, y: -(z1 - f) }, { x: r - f, y: -(z1 - f) }, { x: r - f, y: -z0 }], closed: false });
    drawLeavesFace(o, a + Math.sign(b - a) * f, b - Math.sign(b - a) * f, z0, z1 - f, towards, shapes);
  }
}


/**
 * The leaves of a hinged door between its jambs: `a` the start jamb, `b` the end jamb (x along
 * the view), from `z0` to `z1`.
 */
function drawLeavesFace(o: Opening, a: number, b: number, z0: number, z1: number, towards: boolean, shapes: Shape[]) {
  const { hinge, leaves } = doorSetup(o);
  const mid = (a + b) / 2;
  // Each leaf as [hinge x, lock x]; the active leaf first.
  const parts: [number, number][] = leaves === 1 ? [hinge === "start" ? [a, b] : [b, a]] : hinge === "start" ? [[a, mid], [b, mid]] : [[b, mid], [a, mid]];
  if (leaves === 2) shapes.push({ t: "poly", pen: "opening", pts: [{ x: mid, y: -z0 }, { x: mid, y: -z1 }], closed: false });
  const pen: Pen = towards ? "swing" : "hidden";
  const zm = (z0 + z1) / 2;
  parts.forEach(([h, k], i) => {
    shapes.push({ t: "poly", pen, pts: [{ x: k, y: -z0 }, { x: h, y: -zm }, { x: k, y: -z1 }], closed: false });
    if (i > 0) return;
    // The handle at the lock edge, pointing towards the hinge.
    const zh = Math.min(z0 + HANDLE_HEIGHT, z1);
    const d = Math.sign(h - k);
    const x0 = k + d * Math.min(OPENING_FRAME, Math.abs(h - k) / 4);
    shapes.push({ t: "poly", pen: "detail", pts: [{ x: x0, y: -zh }, { x: x0 + d * HANDLE_LENGTH, y: -zh }], closed: false });
  });
}

/** A sliding door seen face-on; `a` and `b` as in `drawOpening`. */
function drawSlidingDoorFace(o: Opening, a: number, b: number, towards: boolean, shapes: Shape[]) {
  const { hinge, leaves } = doorSetup(o);
  const z0 = o.sill;
  const z1 = o.sill + o.height + SLIDE_OVERLAP;
  const pen: Pen = towards ? "opening" : "hidden";
  const mid = (a + b) / 2;
  const w = Math.abs(b - a);
  // Each leaf as [parking side jamb x, the x it closes to]; it slides towards the first.
  const parts: [number, number][] = leaves === 2 ? [[a, mid], [b, mid]] : [hinge === "start" ? [a, b] : [b, a]];
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  for (const [p, c] of parts) {
    const d = Math.sign(c - p);
    const far = leaves === 2 ? c : c + d * SLIDE_OVERLAP;
    const near = p - d * SLIDE_OVERLAP;
    shapes.push({ t: "poly", pen, pts: rect(Math.min(near, far), Math.max(near, far), z0, z1), closed: true });
    const parked = p - d * (Math.abs(c - p) + SLIDE_OVERLAP);
    lo = Math.min(lo, parked, near, far);
    hi = Math.max(hi, parked, near, far);
    // The arrow the way it opens, at handle height.
    const zh = z0 + HANDLE_HEIGHT;
    const from = p + d * Math.abs(c - p) * 0.7;
    const to = p + d * Math.abs(c - p) * 0.15;
    const head = Math.min(120, w * 0.1);
    shapes.push({ t: "poly", pen: "swing", pts: [{ x: from, y: -zh }, { x: to, y: -zh }], closed: false });
    shapes.push({ t: "poly", pen: "swing", pts: [{ x: to + d * head, y: -(zh + head / 2) }, { x: to, y: -zh }, { x: to + d * head, y: -(zh - head / 2) }], closed: false });
  }
  shapes.push({ t: "poly", pen: towards ? "detail" : "hidden", pts: rect(lo, hi, z1, z1 + TRACK_HEIGHT), closed: true });
}

/**
 * One item as a box from its elevation to its top, drawn by its kind: the parts below it (a
 * stand), and the front details when its front faces the viewer, else the side view.
 */
function drawItem(it: Item, l: number, r: number, facesViewer: boolean, shapes: Shape[]) {
  const def = kindDef(kindOf(it.catalogId));
  const f = new Front(it, l, r, shapes);
  const bodyFill: Fill = def.structural ? "wall" : "item";
  // Overhead units are seen in an elevation, not hidden above a cut as in the plan: drawn solid
  // like every other unit.
  const bodyPen: Pen = def.structural ? "wall" : "item";

  def.elevationBase?.(f);
  f.box(bodyPen, l, r, f.z0, f.top, bodyFill);

  if (facesViewer) def.elevation(f);
  else if (def.elevationSide) def.elevationSide(f);
  else if (it.height > TOP * 2) f.line("detail", [l, f.top - TOP], [r, f.top - TOP]);
}
