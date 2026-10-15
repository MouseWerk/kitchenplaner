// The floor plan as a Drawing: cut walls with their openings, the equipment with its plan
// symbols, position numbers and dimensions. Screen, SVG and DXF all draw this list.

import { add, bounds, clampOpening, dot, EPS, footprint, pointInPolygon, scale, sub, toPlan, walls, type Box, type Wall } from "./geometry";
import { bandPiece, clampPartitionOpening, HATCH_SHELF_DEPTH, partitionBand, partitionLength } from "./partitions";
import { across, doorLeaves, doorSetup, frameOn, LEAF_THICKNESS, leafRect, SLIDE_GAP, SLIDE_OVERLAP, swingFrame, type OpeningFrame } from "./doors";
import { positions } from "./project";
import type { Item, Opening, Project, Room, Vec2 } from "./types";
import { mm, TEXT, type DimShape, type Drawing, type Fill, type Pen, type Shape } from "../render/drawing";
import { fitText, textWidth } from "../render/pdf";
import { CIRCLE_CENTER_RISE, CIRCLE_RADIUS } from "../render/svg";
import { PlanSketch } from "../kinds/parts/plan";
import { kindDef, kindOf, placementOf, type KindDef, type Placement } from "../kinds/registry";

export interface PlanOptions {
  showNames: boolean;
  showDims: boolean;
  /**
   * Drawing units per paper millimetre the plan is laid out for (default 1:50). It places the
   * position numbers and names and spaces the dimension rows, which are sized in paper mm.
   */
  paperScale?: number;
}

/** The usual plan scale of kitchen plans (1:50). */
const DEFAULT_PAPER_SCALE = 50;
/** Gap between the outer wall face and the first dimension row (paper mm). */
export const DIM_GAP = 6;
/** Distance between the wall dimension row and the overall dimension row (paper mm). */
const DIM_ROW = 7;

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
 * Doors are drawn open at 90 degrees from their hinge jamb (`hinge`), on the side they open to
 * (`swing`: into the room or to the left of a partition's a→b, or the other side), each of two
 * leaves with its own arc. A sliding door shows its closed leaf on the face it runs on, its
 * parked position dashed and an arrow the way it opens (`doors.ts`).
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
  });
  if (opts.showNames) {
    for (const n of nameLabels(ordered, centres, ps, room)) shapes.push({ t: "text", pen: "item", itemId: n.itemId, p: n.p, text: n.text, size: TEXT.small, anchor: "middle" });
  }

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

// ---- Names ----

/** Least gap between a name and a number circle, another name or its unit's outline (paper mm). */
const NAME_CLEAR = 0.5;
/** A shortened name keeps at least this many characters before its ellipsis, or is left out. */
const NAME_MIN_CHARS = 3;
/** The box of a line of text around its baseline, in font sizes (Arial: ascender, descender). */
export const TEXT_ASCENT = 0.75;
export const TEXT_DESCENT = 0.22;
/** Rows of places a name tries inside its unit, at most. */
const NAME_ROWS = 24;

export interface NameLabel {
  itemId: string;
  /** Middle of the baseline (plan mm). */
  p: Vec2;
  /** The name, shortened with an ellipsis where it is wider than its unit. */
  text: string;
  box: Box;
}

/** The box (plan mm) of a name of width `w` whose baseline middle is at `p`. */
function nameBox(p: Vec2, w: number, h: number): Box {
  return { minX: p.x - w / 2, maxX: p.x + w / 2, minY: p.y - TEXT_ASCENT * h, maxY: p.y + TEXT_DESCENT * h };
}

const boxesMeet = (a: Box, b: Box, gap: number) => a.minX < b.maxX + gap && b.minX < a.maxX + gap && a.minY < b.maxY + gap && b.minY < a.maxY + gap;

function boxMeetsCircle(b: Box, c: Vec2, r: number): boolean {
  const dx = Math.max(b.minX - c.x, 0, c.x - b.maxX);
  const dy = Math.max(b.minY - c.y, 0, c.y - b.maxY);
  return Math.hypot(dx, dy) < r;
}

const corners = (b: Box): Vec2[] => [
  { x: b.minX, y: b.minY },
  { x: b.maxX, y: b.minY },
  { x: b.maxX, y: b.maxY },
  { x: b.minX, y: b.maxY },
];

/**
 * Where the item names go, placed after the position numbers (`centres`, in the order of `items`)
 * and laid out for the paper scale `ps` like them. A name is as wide as its text at the small
 * text size, shortened with an ellipsis to its unit's width. It takes the free place nearest its
 * number, first where it stays inside its unit (under the number, above it, then rows across the
 * unit), else right below or above the unit inside the room and clear of other units. A place is
 * free when the name keeps `NAME_CLEAR` from every number circle and every name placed before.
 * A name with no free place, or one that would keep fewer than `NAME_MIN_CHARS` characters, is
 * left out: a missing name reads better than two on top of each other. Deterministic.
 */
export function nameLabels(items: readonly Item[], centres: readonly Vec2[], ps: number, room?: Pick<Room, "points">): NameLabel[] {
  const r = TEXT.normal * CIRCLE_RADIUS * ps;
  const h = TEXT.small * ps;
  const gap = NAME_CLEAR * ps;
  const boxes = items.map((it) => bounds(footprint(it)));
  const out: NameLabel[] = [];
  items.forEach((it, i) => {
    const name = it.name?.trim();
    if (!name) return;
    const fp = footprint(it);
    const own = boxes[i];
    const text = fitText(name, (own.maxX - own.minX) / ps - 2 * NAME_CLEAR, TEXT.small);
    const kept = text.endsWith("…") && !name.endsWith("…") ? [...text].length - 1 : [...text].length;
    if (!text || (text !== name && kept < NAME_MIN_CHARS)) return;
    const w = textWidth(text, TEXT.small) * ps;
    const c = centres[i];
    const asc = TEXT_ASCENT * h;
    const desc = TEXT_DESCENT * h;

    const free = (b: Box) => centres.every((o) => !boxMeetsCircle(b, o, r + gap)) && out.every((n) => !boxesMeet(b, n.box, gap));
    const inside = (b: Box) => corners({ minX: b.minX - gap, minY: b.minY - gap, maxX: b.maxX + gap, maxY: b.maxY + gap }).every((q) => pointInPolygon(q, fp));
    const clearOutside = (b: Box) =>
      (!room || corners(b).every((q) => pointInPolygon(q, room.points))) && boxes.every((o, j) => j === i || !boxesMeet(b, o, 0)) && !boxesMeet(b, own, 0);

    // Inside the unit: under and above the number, then rows across the unit, nearest first.
    const within: Vec2[] = [
      { x: c.x, y: c.y + r + gap + asc },
      { x: c.x, y: c.y - r - gap - desc },
    ];
    const y0 = own.minY + gap + asc;
    const y1 = own.maxY - gap - desc;
    const rows = Math.min(NAME_ROWS, Math.max(1, Math.floor((y1 - y0) / ((asc + desc) / 2)) + 1));
    for (let k = 0; k < rows; k++) {
      const y = rows === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * k) / (rows - 1);
      for (const x of [c.x, (own.minX + own.maxX) / 2, own.minX + gap + w / 2, own.maxX - gap - w / 2]) within.push({ x, y });
    }
    const dist = (p: Vec2) => Math.hypot(p.x - c.x, p.y - asc / 2 - c.y);
    const nearest = (pts: Vec2[]) => pts.map((p, k) => ({ p, k, d: dist(p) })).sort((a, b) => a.d - b.d || a.k - b.k).map((x) => x.p);
    // Outside: right below or above the unit, centred on it.
    const cx = (own.minX + own.maxX) / 2;
    const outside = nearest([
      { x: cx, y: own.maxY + gap + asc },
      { x: cx, y: own.minY - gap - desc },
    ]);
    for (const p of nearest(within)) {
      const b = nameBox(p, w, h);
      if (inside(b) && free(b)) {
        out.push({ itemId: it.id, p, text, box: b });
        return;
      }
    }
    for (const p of outside) {
      const b = nameBox(p, w, h);
      if (clearOutside(b) && free(b)) {
        out.push({ itemId: it.id, p, text, box: b });
        return;
      }
    }
  });
  return out;
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

/** Angle of a direction in degrees, clockwise on screen from +x (the arc convention). */
function angleOf(v: Vec2): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

function drawOpening(f: OpeningFrame, o: Opening, shapes: Shape[]) {
  const { start, end, normal, near, far } = f;
  const at = (p: Vec2, k: number) => add(p, scale(normal, k));
  const line = (a: Vec2, b: Vec2, pen: Pen): Shape => ({ t: "poly", pen, pts: [a, b], closed: false });
  const reveals = () => shapes.push(line(at(start, near), at(start, far), "opening"), line(at(end, near), at(end, far), "opening"));

  if (o.kind === "door") {
    drawSwingDoor(swingFrame(f, doorSetup(o).swing), o, shapes);
  } else if (o.kind === "slidingDoor") {
    drawSlidingDoor(swingFrame(f, doorSetup(o).swing), o, shapes);
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

/**
 * A hinged door drawn open at 90 degrees, each leaf from its hinge on the swing side face with
 * its swing arc back to the closed position.
 */
function drawSwingDoor(f: OpeningFrame, o: Opening, shapes: Shape[]) {
  for (const leaf of doorLeaves(f, o)) {
    const hinge = across(f, leaf.hinge, f.near);
    shapes.push({ t: "poly", pen: "opening", pts: [hinge, across(f, hinge, leaf.width)], closed: false });
    const aClosed = angleOf(leaf.along);
    const aOpen = angleOf(f.normal);
    // The arc runs clockwise from a0 to a1; start from whichever of both directions comes first.
    const cw = (((aOpen - aClosed) % 360) + 360) % 360;
    const a0 = Math.abs(cw - 90) < 1 ? aClosed : aOpen;
    shapes.push({ t: "arc", pen: "swing", c: hinge, r: leaf.width, a0, a1: a0 + 90 });
  }
}

/** Length of the arrow head showing a sliding door's direction (mm of the kitchen). */
const SLIDE_ARROW_HEAD = 120;

/**
 * A sliding door: the closed leaf parallel to the wall on the face it runs on, overlapping the
 * opening, its open position (beside the opening, where it parks) dashed, and an arrow the way
 * it slides open.
 */
function drawSlidingDoor(f: OpeningFrame, o: Opening, shapes: Shape[]) {
  const k0 = f.near + SLIDE_GAP;
  const k1 = k0 + LEAF_THICKNESS;
  for (const leaf of doorLeaves(f, o)) {
    // In the leaf's frame `along` runs from the parking side across the opening.
    // Two leaves meet in the middle; a single one overlaps the far jamb too.
    const s1 = leaf.width + (doorSetup(o).leaves === 2 ? 0 : SLIDE_OVERLAP);
    shapes.push({ t: "poly", pen: "opening", pts: leafRect(f, leaf, -SLIDE_OVERLAP, s1, k0, k1), closed: true });
    shapes.push({ t: "poly", pen: "hidden", pts: leafRect(f, leaf, -SLIDE_OVERLAP - leaf.width, s1 - leaf.width, k0, k1), closed: true });
    const k = k1 + LEAF_THICKNESS;
    const from = across(f, add(leaf.hinge, scale(leaf.along, leaf.width * 0.7)), k);
    const to = across(f, add(leaf.hinge, scale(leaf.along, leaf.width * 0.15)), k);
    const head = Math.min(SLIDE_ARROW_HEAD, leaf.width * 0.2);
    const back = add(to, scale(leaf.along, head));
    shapes.push({ t: "poly", pen: "swing", pts: [from, to], closed: false });
    shapes.push({ t: "poly", pen: "swing", pts: [across(f, back, head / 2), to, across(f, back, -head / 2)], closed: false });
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
