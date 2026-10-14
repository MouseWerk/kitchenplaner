// The floor plan as a Drawing: cut walls with their openings, the equipment with its plan
// symbols, position numbers and dimensions. Screen, SVG and DXF all draw this list.

import { add, bounds, clampOpening, dot, EPS, footprint, pointInPolygon, scale, sub, toPlan, walls, type Wall } from "./geometry";
import { bandPiece, clampPartitionOpening, HATCH_SHELF_DEPTH, partitionBand, partitionLength } from "./partitions";
import { positions } from "./project";
import type { Item, Opening, Project, Room, Vec2 } from "./types";
import { mm, TEXT, type DimShape, type Drawing, type Fill, type Pen, type Shape } from "../render/drawing";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS } from "../render/svg";
import { PlanSketch } from "../kinds/parts/plan";
import { kindDef, kindOf, placementOf, type KindDef, type Placement } from "../kinds/registry";

export interface PlanOptions {
  showNames: boolean;
  showDims: boolean;
  /**
   * Drawing units per paper millimetre the plan is laid out for (default 1:50). It only moves
   * the name under the position number and the dimension rows, which are spaced in paper mm.
   */
  paperScale?: number;
}

/** The usual plan scale of kitchen plans (1:50). */
const DEFAULT_PAPER_SCALE = 50;
/** Gap between the outer wall face and the first dimension row (paper mm). */
export const DIM_GAP = 6;
/** Distance between the wall dimension row and the overall dimension row (paper mm). */
const DIM_ROW = 7;
/** Gap between the position number and the name below it (paper mm). */
const NAME_GAP = 2;

/**
 * The order the plan draws items in, later ones on top: the floor units, then what lies in the
 * floor (unfilled, so it shows under a sink), what stands on the tables, and what hangs above.
 */
const PLAN_ORDER: readonly Placement[] = ["floor", "flat", "tableTop", "overhead"];

/**
 * The floor plan of a project.
 *
 * Walls are filled bands between the inner outline and the outline offset by the wall thickness
 * (mitered corners), split at openings. Partitions follow as bands of their own, cut flush where
 * they meet a wall or another partition (`partitionBand`); one lower than the room (a Brüstung,
 * below the plan's cut) gets the lighter fill. Items follow in `PLAN_ORDER`: floor units, flat
 * ones (drains) without fill, table-top units, overhead units (hoods, wall shelves) dashed on
 * top. Every item shape carries its `itemId`.
 *
 * Doors are hinged at the start of their opening (the end nearer the wall's or partition's
 * start) and drawn open at 90 degrees: into the room in an outer wall, to the left of a→b in a
 * partition.
 */
export function planDrawing(project: Project, opts: PlanOptions): Drawing {
  const ps = opts.paperScale ?? DEFAULT_PAPER_SCALE;
  const shapes: Shape[] = [];
  const { room } = project;
  if (room.points.length < 3) return { shapes };

  drawWalls(project, shapes);
  drawPartitions(project, shapes);

  const pos = positions(project);
  const ordered = PLAN_ORDER.flatMap((p) => project.items.filter((it) => placementOf(kindOf(it.catalogId)) === p));
  for (const it of ordered) drawItem(it, shapes);
  const centres = labelCentres(ordered, ps);
  ordered.forEach((it, i) => {
    // Circled text hangs its circle above the baseline; lower it so the circle sits on the centre.
    const p = { x: centres[i].x, y: centres[i].y + CIRCLE_CENTER_RISE * TEXT.normal * ps };
    const leader = leaderLine(it, centres[i], TEXT.normal * CIRCLE_RADIUS * ps);
    if (leader) shapes.push({ t: "poly", pen: "detail", itemId: it.id, pts: leader, closed: false });
    shapes.push({ t: "text", pen: "item", itemId: it.id, p, text: String(pos.get(it.id) ?? ""), size: TEXT.normal, anchor: "middle", circled: true });
    if (opts.showNames && it.name) {
      const below = { x: p.x, y: p.y + (NAME_GAP + TEXT.normal + TEXT.small) * ps };
      shapes.push({ t: "text", pen: "item", itemId: it.id, p: below, text: it.name, size: TEXT.small, anchor: "middle" });
    }
  });

  if (opts.showDims) drawDims(project, ps, shapes);
  return { shapes };
}

// ---- Position numbers ----

/** Least gap between two position circles (paper mm). */
const LABEL_GAP = 0.5;
/** How many rings of places around its first place a crowded number tries. */
const LABEL_RINGS = 4;
/** Places tried on each ring, evenly around it, starting towards the front right. */
const LABEL_STEPS = 12;
/** The farthest ring a number goes out to when all nearer places are taken. */
const LABEL_RINGS_MAX = 200;

/**
 * Where the circled position numbers go (centres, plan mm), in the order of `items` (floor
 * units first). A floor or flat unit's number sits in its middle; a unit on a table or overhead
 * puts it towards its front right corner, so it does not cover the number of the unit below or
 * above. A number that would still overlap one placed before it moves to the nearest free place
 * on rings around it, preferring places where the circle stays inside the item's footprint, then
 * its centre does. Where these rings are all taken (circles wide against small units, at a coarse
 * scale) it goes further out to the first free place; `planDrawing` then draws a leader to the
 * unit. Deterministic: the same plan gives the same places.
 */
export function labelCentres(items: readonly Item[], ps: number): Vec2[] {
  const r = TEXT.normal * CIRCLE_RADIUS * ps;
  const clear = 2 * r + LABEL_GAP * ps;
  const placed: Vec2[] = [];
  for (const it of items) {
    const placement = placementOf(kindOf(it.catalogId));
    const raised = placement === "overhead" || placement === "tableTop";
    // In the item's frame: x along the width, y towards the front.
    const home = raised ? { x: Math.max(0, it.width / 2 - r * 1.5), y: Math.max(0, it.depth / 2 - r * 1.5) } : { x: 0, y: 0 };
    const free = (q: Vec2) => placed.every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= clear - EPS);
    const first = toPlan(it, home);
    let best = first;
    if (!free(first)) {
      // Rank: circle inside the footprint (0), centre inside (1), outside (2); then distance.
      let bestRank = Infinity;
      for (let ring = 1; ring <= LABEL_RINGS; ring++) {
        for (let k = 0; k < LABEL_STEPS; k++) {
          const a = (Math.PI / 4) + (2 * Math.PI * k) / LABEL_STEPS;
          const local = { x: home.x + Math.cos(a) * clear * ring * 0.5, y: home.y + Math.sin(a) * clear * ring * 0.5 };
          const q = toPlan(it, local);
          if (!free(q)) continue;
          const inside = (m: number) => Math.abs(local.x) <= it.width / 2 - m + EPS && Math.abs(local.y) <= it.depth / 2 - m + EPS;
          const rank = (inside(r) ? 0 : inside(0) ? 1 : 2) * 1e9 + ring * LABEL_STEPS + k;
          if (rank < bestRank) {
            bestRank = rank;
            best = q;
          }
        }
      }
      // Crowded at a coarse scale (circles wide against the units): further out, ring by ring,
      // with as many places on a ring as fit around it, the first free one.
      for (let ring = LABEL_RINGS + 1; bestRank === Infinity && ring <= LABEL_RINGS_MAX; ring++) {
        const steps = Math.max(LABEL_STEPS, Math.ceil(2 * Math.PI * ring));
        for (let k = 0; k < steps; k++) {
          const a = Math.PI / 4 + (2 * Math.PI * k) / steps;
          const q = toPlan(it, { x: home.x + Math.cos(a) * clear * ring * 0.5, y: home.y + Math.sin(a) * clear * ring * 0.5 });
          if (free(q)) {
            bestRank = 0;
            best = q;
            break;
          }
        }
      }
    }
    placed.push(best);
  }
  return placed;
}

/**
 * A leader from a position circle (centre `c`, radius `r`) to the nearest point of its unit's
 * outline, when the circle sits clear of the unit; null when it touches or covers it.
 */
export function leaderLine(it: Item, c: Vec2, r: number): Vec2[] | null {
  const fp = footprint(it);
  if (pointInPolygon(c, fp)) return null;
  let near = fp[0];
  let d = Infinity;
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i];
    const ab = sub(fp[(i + 1) % fp.length], a);
    const l2 = dot(ab, ab);
    const k = l2 < EPS ? 0 : Math.max(0, Math.min(1, dot(sub(c, a), ab) / l2));
    const q = add(a, scale(ab, k));
    const dq = Math.hypot(q.x - c.x, q.y - c.y);
    if (dq < d) {
      d = dq;
      near = q;
    }
  }
  if (d <= r + EPS) return null;
  return [add(c, scale(sub(near, c), r / d)), near];
}

// ---- Walls and openings ----

/** The outer corners: each inner corner moved outwards so both adjacent wall faces stay parallel. */
function outerCorners(ws: Wall[], thickness: number): Vec2[] {
  return ws.map((w, i) => {
    const prev = ws[(i + ws.length - 1) % ws.length];
    const n0 = prev.inward;
    const n1 = w.inward;
    // Miter: the intersection of both offset lines lies along n0 + n1, stretched by 1 / (1 + n0·n1).
    const k = 1 + dot(n0, n1);
    const m = k < 1e-3 ? n1 : scale(add(n0, n1), 1 / k);
    return sub(w.a, scale(m, thickness));
  });
}

function drawWalls(project: Project, shapes: Shape[]) {
  const { room } = project;
  const ws = walls(room);
  const n = ws.length;
  const t = room.wallThickness;
  const outer = outerCorners(ws, t);

  // Positions along the inner outline: corner i at ring[i], the whole loop is `total` long.
  const ring: number[] = [];
  let total = 0;
  for (const w of ws) {
    ring.push(total);
    total += w.length;
  }
  const inner = (r: number): { p: Vec2; o: Vec2 } => {
    const rr = ((r % total) + total) % total;
    let i = n - 1;
    while (i > 0 && ring[i] > rr + 1e-9) i--;
    const w = ws[i];
    const s = rr - ring[i];
    if (s < 1e-9) return { p: w.a, o: outer[i] };
    const p = add(w.a, scale(w.dir, s));
    return { p, o: sub(p, scale(w.inward, t)) };
  };

  const openings = room.openings.filter((o) => o.partition === undefined && ws[o.wall]).map((o) => clampOpening(room, o));
  // The gaps along the loop, in order; without openings one zero-width cut at the first corner
  // closes the ring.
  const gaps = openings.map((o) => ({ a: ring[o.wall] + o.offset - o.width / 2, b: ring[o.wall] + o.offset + o.width / 2 })).sort((x, y) => x.a - y.a);
  if (gaps.length === 0) gaps.push({ a: 0, b: 0 });

  // One filled piece per solid run between two gaps, running around corners in one polygon so
  // the wall shows no joints at its corners.
  for (let k = 0; k < gaps.length; k++) {
    const from = gaps[k].b;
    let to = gaps[(k + 1) % gaps.length].a;
    if (k === gaps.length - 1) to += total;
    if (to - from < 0.5) continue;
    const start = inner(from);
    const end = inner(to);
    const innerPts = [start.p];
    const outerPts = [start.o];
    for (let r = Math.floor(from / total) * total; r < to + total; r += total) {
      for (let i = 0; i < n; i++) {
        const c = r + ring[i];
        if (c > from + 1e-9 && c < to - 1e-9) {
          innerPts.push(ws[i].a);
          outerPts.push(outer[i]);
        }
      }
    }
    innerPts.push(end.p);
    outerPts.push(end.o);
    shapes.push({ t: "poly", pen: "wall", fill: "wall", pts: [...innerPts, ...outerPts.reverse()], closed: true });
  }

  for (const o of openings) {
    const w = ws[o.wall];
    drawOpening(frameOn(w.a, w.dir, w.inward, o, 0, -t), o, shapes);
  }
}

/**
 * A partition counts as reaching the ceiling within this tolerance (mm); anything lower is a
 * half-height wall that stays below the plan's cut and is drawn lighter.
 */
const FULL_HEIGHT_TOLERANCE = 1;

function drawPartitions(project: Project, shapes: Shape[]) {
  const { room } = project;
  for (const p of room.partitions) {
    const length = partitionLength(p);
    if (length < EPS) continue;
    const band = partitionBand(room, p);
    const fill: Fill = p.height >= room.height - FULL_HEIGHT_TOLERANCE ? "wall" : "item-dark";
    const openings = room.openings.filter((o) => o.partition === p.id).map((o) => clampPartitionOpening(p, o));
    const gaps = openings.map((o) => [o.offset - o.width / 2, o.offset + o.width / 2]).sort((x, y) => x[0] - y[0]);
    let s = 0;
    for (const [g0, g1] of [...gaps, [length, length]]) {
      if (g0 - s > 0.5) shapes.push({ t: "poly", pen: "wall", fill, pts: bandPiece(band, s, g0), closed: true });
      s = Math.max(s, g1);
    }
    for (const o of openings) drawOpening(frameOn(p.a, band.dir, band.left, o, p.thickness / 2, -p.thickness / 2), o, shapes);
  }
}

/**
 * Where an opening lies in its wall band: `start` and `end` on the reference line (the inner face
 * of an outer wall, the centre line of a partition), the band reaching from `near` to `far`
 * along `normal` (mm). `normal` points to the side a door swings to, `near` is that face.
 */
interface OpeningFrame {
  start: Vec2;
  end: Vec2;
  dir: Vec2;
  normal: Vec2;
  near: number;
  far: number;
}

function frameOn(a: Vec2, dir: Vec2, normal: Vec2, o: Opening, near: number, far: number): OpeningFrame {
  return { start: add(a, scale(dir, o.offset - o.width / 2)), end: add(a, scale(dir, o.offset + o.width / 2)), dir, normal, near, far };
}

/** Angle of a direction in degrees, clockwise on screen from +x (the arc convention). */
function angleOf(v: Vec2): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

function drawOpening(f: OpeningFrame, o: Opening, shapes: Shape[]) {
  const { start, end, dir, normal, near, far } = f;
  const at = (p: Vec2, k: number) => add(p, scale(normal, k));
  const line = (a: Vec2, b: Vec2, pen: Pen): Shape => ({ t: "poly", pen, pts: [a, b], closed: false });
  const reveals = () => shapes.push(line(at(start, near), at(start, far), "opening"), line(at(end, near), at(end, far), "opening"));

  if (o.kind === "door") {
    // Hinge at the start side on the swing-side face, the leaf drawn open at 90 degrees.
    const hinge = at(start, near);
    shapes.push(line(hinge, at(start, near + o.width), "opening"));
    const aDir = angleOf(dir);
    const aIn = angleOf(normal);
    // The arc runs clockwise from a0 to a1; start from whichever of both directions comes first.
    const cwFromDir = (((aIn - aDir) % 360) + 360) % 360;
    const a0 = Math.abs(cwFromDir - 90) < 1 ? aDir : aIn;
    shapes.push({ t: "arc", pen: "swing", c: hinge, r: o.width, a0, a1: a0 + 90 });
  } else if (o.kind === "window") {
    // Two panes inside the wall band, at a third and two thirds of the thickness.
    for (const k of [1 / 3, 2 / 3]) {
      const off = near + (far - near) * k;
      shapes.push(line(at(start, off), at(end, off), "opening"));
    }
    reveals();
  } else if (o.kind === "hatch") {
    // The sill seen from above: its edges on both faces, and the shelf on each side.
    shapes.push(line(at(start, near), at(end, near), "opening"), line(at(start, far), at(end, far), "opening"));
    reveals();
    for (const [face, out] of [
      [near, Math.sign(near - far)],
      [far, Math.sign(far - near)],
    ]) {
      const k = face + out * HATCH_SHELF_DEPTH;
      shapes.push({ t: "poly", pen: "detail", pts: [at(start, face), at(start, k), at(end, k), at(end, face)], closed: false });
    }
  } else {
    shapes.push(line(at(start, near), at(end, near), "hidden"), line(at(start, far), at(end, far), "hidden"));
  }
}

// ---- Items ----

/** Pen and fill of an item's outline by where it stands; building parts look like walls. */
function outlineStyle(def: KindDef): { pen: Pen; fill: Fill } {
  if (def.structural) return { pen: "wall", fill: "wall" };
  switch (def.placement ?? "floor") {
    case "overhead":
      return { pen: "overhead", fill: "none" };
    case "flat":
      // In the floor: shows through what stands on it, as the installer needs to see it.
      return { pen: "item", fill: "none" };
    default:
      return { pen: "item", fill: "item" };
  }
}

function drawItem(it: Item, shapes: Shape[]) {
  const def = kindDef(kindOf(it.catalogId));
  const pts = def.planOutline ? def.planOutline(it.width, it.depth).map((p) => toPlan(it, p)) : footprint(it);
  shapes.push({ t: "poly", ...outlineStyle(def), pts, closed: true, itemId: it.id });
  def.plan(new PlanSketch(it, shapes));
}

// ---- Dimensions ----

/**
 * The dimension of one wall as the plan draws it: its length outside the room, the first row
 * `DIM_GAP` beyond the outer face. The room editor marks the selected wall's dimension with it.
 */
export function wallDim(room: Pick<Room, "wallThickness">, w: Wall, ps: number): DimShape {
  const first = room.wallThickness / ps + DIM_GAP;
  // The dimension line lies to the left of a→b; put it outside, away from the room.
  const left = { x: w.dir.y, y: -w.dir.x };
  const outside = dot(left, w.inward) < 0 ? 1 : -1;
  return { t: "dim", pen: "dim", a: w.a, b: w.b, offset: outside * first, text: mm(w.length) };
}

function drawDims(project: Project, ps: number, shapes: Shape[]) {
  const { room } = project;
  const first = room.wallThickness / ps + DIM_GAP;
  const ws = walls(room);
  for (const w of ws) shapes.push(wallDim(room, w, ps));
  const box = bounds(room.points);
  const second = first + DIM_ROW;
  // Overall width above the north side (left of west→east), overall depth left of the west side;
  // left out where one wall already runs the whole side, as its own dimension says the same.
  const north = { a: { x: box.minX, y: box.minY }, b: { x: box.maxX, y: box.minY } };
  const west = { a: { x: box.minX, y: box.maxY }, b: { x: box.minX, y: box.minY } };
  for (const side of [north, west]) {
    if (ws.some((w) => sameSegment(w, side))) continue;
    shapes.push({ t: "dim", pen: "dim", a: side.a, b: side.b, offset: second, text: mm(Math.hypot(side.b.x - side.a.x, side.b.y - side.a.y)) });
  }
}

/** Do the segments have the same ends (either way round)? */
function sameSegment(p: { a: Vec2; b: Vec2 }, q: { a: Vec2; b: Vec2 }): boolean {
  const at = (u: Vec2, v: Vec2) => Math.abs(u.x - v.x) < EPS && Math.abs(u.y - v.y) < EPS;
  return (at(p.a, q.a) && at(p.b, q.b)) || (at(p.a, q.b) && at(p.b, q.a));
}
