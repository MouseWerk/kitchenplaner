// The floor plan as a Drawing: cut walls with their openings, the equipment with its plan
// symbols, position numbers and dimensions. Screen, SVG and DXF all draw this list.

import { isOverhead, kindOf, sinkBowlCount, type ItemKind } from "./catalog";
import { add, bounds, clampOpening, dot, footprint, scale, sub, toPlan, walls, type Wall } from "./geometry";
import { positions } from "./project";
import type { Item, Opening, Project, Vec2 } from "./types";
import { mm, TEXT, type Drawing, type Fill, type Pen, type Shape } from "../render/drawing";
import { CIRCLE_CENTER_RISE } from "../render/svg";

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
const DIM_GAP = 6;
/** Distance between the wall dimension row and the overall dimension row (paper mm). */
const DIM_ROW = 7;
/** Gap between the position number and the name below it (paper mm). */
const NAME_GAP = 2;

/** Height of the back upstand of work tables (mm, the usual 50 mm splash edge). */
const UPSTAND = 50;
/** Wall thickness of cold room panels (mm, common 100 mm PU sandwich panels). */
const COLD_ROOM_PANEL = 100;
/** Clear width of a cold room door (mm). */
const COLD_ROOM_DOOR = 800;
/** Range width from which the hob has six plates instead of four (800 mm = 4, 1200 mm = 6). */
const RANGE_SIX_PLATES_FROM = 1000;
/** Inner bowl size of a sink unit (mm, a common 500 × 400 bowl). */
const BOWL_W = 500;
const BOWL_D = 400;
/** Width of one door of a refrigerated counter (mm, GN 1/1 door module). */
const COUNTER_DOOR_MODULE = 600;
/** Depth of the control strip at the front of cooking appliances (mm). */
const CONTROL_STRIP = 150;
/** Inset of inner symbols from the item outline (mm). */
const INSET = 50;

/**
 * The floor plan of a project.
 *
 * Walls are filled bands between the inner outline and the outline offset by the wall thickness
 * (mitered corners), split at openings. Floor items come first, overhead items (hoods, wall
 * shelves) dashed on top. Every item shape carries its `itemId`.
 */
export function planDrawing(project: Project, opts: PlanOptions): Drawing {
  const ps = opts.paperScale ?? DEFAULT_PAPER_SCALE;
  const shapes: Shape[] = [];
  const { room } = project;
  if (room.points.length < 3) return { shapes };

  drawWalls(project, shapes);

  const pos = positions(project);
  const floor = project.items.filter((it) => !isOverhead(kindOf(it.catalogId)));
  const overhead = project.items.filter((it) => isOverhead(kindOf(it.catalogId)));
  for (const it of [...floor, ...overhead]) drawItem(it, shapes);
  for (const it of [...floor, ...overhead]) {
    // Circled text hangs its circle above the baseline; lower it so the circle sits on the centre.
    const p = { x: it.x, y: it.y + CIRCLE_CENTER_RISE * TEXT.normal * ps };
    shapes.push({ t: "text", pen: "item", itemId: it.id, p, text: String(pos.get(it.id) ?? ""), size: TEXT.normal, anchor: "middle", circled: true });
    if (opts.showNames && it.name) {
      const below = { x: p.x, y: p.y + (NAME_GAP + TEXT.normal + TEXT.small) * ps };
      shapes.push({ t: "text", pen: "item", itemId: it.id, p: below, text: it.name, size: TEXT.small, anchor: "middle" });
    }
  }

  if (opts.showDims) drawDims(project, ps, shapes);
  return { shapes };
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

  const openings = room.openings.filter((o) => ws[o.wall]).map((o) => clampOpening(room, o));
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

  for (const o of openings) drawOpening(ws[o.wall], o, t, shapes);
}

/** Angle of a direction in degrees, clockwise on screen from +x (the arc convention). */
function angleOf(v: Vec2): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

function drawOpening(w: Wall, o: Opening, t: number, shapes: Shape[]) {
  const start = add(w.a, scale(w.dir, o.offset - o.width / 2));
  const end = add(w.a, scale(w.dir, o.offset + o.width / 2));
  const out = scale(w.inward, -t);
  const line = (a: Vec2, b: Vec2, pen: Pen): Shape => ({ t: "poly", pen, pts: [a, b], closed: false });

  if (o.kind === "door") {
    // Hinge at the start side, the leaf drawn open at 90 degrees into the room.
    const leafEnd = add(start, scale(w.inward, o.width));
    shapes.push(line(start, leafEnd, "opening"));
    const aDir = angleOf(w.dir);
    const aIn = angleOf(w.inward);
    // The arc runs clockwise from a0 to a1; start from whichever of both directions comes first.
    const cwFromDir = (((aIn - aDir) % 360) + 360) % 360;
    const a0 = Math.abs(cwFromDir - 90) < 1 ? aDir : aIn;
    shapes.push({ t: "arc", pen: "swing", c: start, r: o.width, a0, a1: a0 + 90 });
  } else if (o.kind === "window") {
    // Two panes inside the wall band, at a third and two thirds of the thickness.
    for (const f of [1 / 3, 2 / 3]) {
      const off = scale(out, f);
      shapes.push(line(add(start, off), add(end, off), "opening"));
    }
    // The reveals: the wall faces across the gap.
    shapes.push(line(start, add(start, out), "opening"), line(end, add(end, out), "opening"));
  } else {
    shapes.push(line(start, end, "hidden"), line(add(start, out), add(end, out), "hidden"));
  }
}

// ---- Items ----

function drawItem(it: Item, shapes: Shape[]) {
  const kind = kindOf(it.catalogId);
  const overhead = isOverhead(kind);
  const fp = footprint(it);
  let pen: Pen = overhead ? "overhead" : "item";
  let fill: Fill = overhead ? "none" : "item";
  if (kind === "column") {
    pen = "wall";
    fill = "wall";
  }
  shapes.push({ t: "poly", pen, fill, pts: fp, closed: true, itemId: it.id });
  symbols(it, kind, shapes);
}

/** Collects shapes given in an item's own frame (x along the width, y from back to front). */
class Local {
  constructor(
    private readonly it: Item,
    private readonly out: Shape[],
  ) {}

  private p(x: number, y: number): Vec2 {
    return toPlan(this.it, { x, y });
  }

  line(pen: Pen, ...pts: [number, number][]) {
    this.out.push({ t: "poly", pen, itemId: this.it.id, pts: pts.map(([x, y]) => this.p(x, y)), closed: false });
  }

  rect(pen: Pen, x0: number, y0: number, x1: number, y1: number) {
    const pts = [this.p(x0, y0), this.p(x1, y0), this.p(x1, y1), this.p(x0, y1)];
    this.out.push({ t: "poly", pen, itemId: this.it.id, pts, closed: true });
  }

  circle(pen: Pen, x: number, y: number, r: number) {
    this.out.push({ t: "circle", pen, itemId: this.it.id, c: this.p(x, y), r });
  }

  /** A quarter arc around (x, y), from the local direction at `from` degrees clockwise by 90. */
  quarter(pen: Pen, x: number, y: number, r: number, from: number) {
    // The item frame is only turned, never mirrored, so local angles just shift by the rotation.
    const a0 = from + this.it.rotation;
    this.out.push({ t: "arc", pen, itemId: this.it.id, c: this.p(x, y), r, a0, a1: a0 + 90 });
  }
}

/** Plate grid of a hob: `cols` × 2 circles in the area behind the control strip. */
function hob(l: Local, w: number, d: number, cols: number, round: boolean) {
  const x0 = -w / 2 + INSET;
  const y0 = -d / 2 + INSET;
  const cw = (w - 2 * INSET) / cols;
  const rh = (d - INSET - CONTROL_STRIP) / 2;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 2; r++) {
      const cx = x0 + cw * (c + 0.5);
      const cy = y0 + rh * (r + 0.5);
      const half = Math.min(cw, rh) * 0.4;
      if (round) l.circle("detail", cx, cy, half);
      else l.rect("detail", cx - half, cy - half, cx + half, cy + half);
    }
  }
  controlStrip(l, w, d);
}

function controlStrip(l: Local, w: number, d: number) {
  l.line("detail", [-w / 2, d / 2 - CONTROL_STRIP + INSET], [w / 2, d / 2 - CONTROL_STRIP + INSET]);
}

function symbols(it: Item, kind: ItemKind, shapes: Shape[]) {
  const l = new Local(it, shapes);
  const w = it.width;
  const d = it.depth;
  const L = -w / 2;
  const R = w / 2;
  const B = -d / 2;
  const F = d / 2;

  switch (kind) {
    case "range":
      hob(l, w, d, w >= RANGE_SIX_PLATES_FROM ? 3 : 2, true);
      break;
    case "induction":
      hob(l, w, d, 2, false);
      break;
    case "fryer": {
      // Two baskets side by side.
      const bw = (w - 3 * INSET) / 2;
      for (const x of [L + INSET, L + 2 * INSET + bw]) l.rect("detail", x, B + INSET, x + bw, F - CONTROL_STRIP);
      controlStrip(l, w, d);
      break;
    }
    case "griddle":
      l.rect("detail", L + INSET, B + INSET, R - INSET, F - CONTROL_STRIP);
      controlStrip(l, w, d);
      break;
    case "kettle":
      l.circle("detail", 0, (B + F - CONTROL_STRIP) / 2, Math.min(w, d - CONTROL_STRIP) * 0.42);
      controlStrip(l, w, d);
      break;
    case "tiltingPan": {
      // The pan tilts forward around an axis near the front; the pivots sit at both sides.
      const axisY = F - CONTROL_STRIP;
      l.rect("detail", L + 2 * INSET, B + INSET, R - 2 * INSET, axisY - INSET);
      l.line("hidden", [L + INSET, axisY], [R - INSET, axisY]);
      l.circle("detail", L + INSET, axisY, INSET / 2);
      l.circle("detail", R - INSET, axisY, INSET / 2);
      break;
    }
    case "combiOven": {
      // Door across the front, the control panel at the right.
      const panel = Math.min(CONTROL_STRIP, w / 4);
      l.rect("detail", L + INSET / 2, F - INSET, R - panel, F);
      l.line("detail", [R - panel, B + INSET], [R - panel, F]);
      break;
    }
    case "fridge":
      // Closed door at the front, its swing (hinge left) dashed in front of the unit.
      l.line("detail", [L, F - INSET / 2], [R, F - INSET / 2]);
      l.quarter("hidden", L, F, w, 0);
      break;
    case "counterFridge": {
      const n = Math.max(1, Math.floor(w / COUNTER_DOOR_MODULE));
      const gap = INSET / 2;
      const dw = (w - (n + 1) * gap) / n;
      for (let i = 0; i < n; i++) {
        const x = L + gap + i * (dw + gap);
        l.line("detail", [x, F - INSET / 2], [x + dw, F - INSET / 2]);
      }
      l.line("detail", [L, B + UPSTAND], [R, B + UPSTAND]);
      break;
    }
    case "sink": {
      const n = sinkBowlCount(w);
      const bw = Math.min(BOWL_W, (w - (n + 1) * INSET) / n);
      const bd = Math.min(BOWL_D, d - 2 * INSET - UPSTAND);
      const cy = (B + UPSTAND + F) / 2;
      // Bowls at the right end, the drainer to their left.
      for (let i = 0; i < n; i++) {
        const x1 = R - INSET - i * (bw + INSET);
        l.rect("detail", x1 - bw, cy - bd / 2, x1, cy + bd / 2);
        l.circle("detail", x1 - bw / 2, cy, INSET / 2);
      }
      const tapX = R - INSET - (n * bw + (n - 1) * INSET) / 2;
      l.circle("detail", tapX, B + UPSTAND / 2 + INSET / 2, INSET / 2);
      l.line("detail", [L, B + UPSTAND], [R, B + UPSTAND]);
      break;
    }
    case "handwash":
      l.circle("detail", 0, INSET / 2, Math.min(w, d) * 0.35);
      l.circle("detail", 0, B + INSET / 2, INSET / 3);
      break;
    case "dishwasher":
      l.rect("detail", L + INSET, B + INSET, R - INSET, F - INSET);
      break;
    case "hood":
      l.line("overhead", [L, B], [R, F]);
      l.line("overhead", [R, B], [L, F]);
      break;
    case "wallShelf":
      l.line("overhead", [L, B], [R, F]);
      break;
    case "shelving":
      l.line("detail", [L, B], [R, F]);
      break;
    case "coldRoom": {
      // Panel walls with a door gap in the front panel; the door swings out of the cell.
      const p = COLD_ROOM_PANEL;
      const door = Math.min(COLD_ROOM_DOOR, w - 4 * p);
      const dl = -door / 2;
      const dr = door / 2;
      l.line("item", [dl, F - p], [L + p, F - p], [L + p, B + p], [R - p, B + p], [R - p, F - p], [dr, F - p]);
      // The door opening cuts through the front panel.
      l.line("item", [dl, F - p], [dl, F]);
      l.line("item", [dr, F - p], [dr, F]);
      l.line("opening", [dl, F], [dl, F + door]);
      l.quarter("swing", dl, F, door, 0);
      break;
    }
    case "column":
      break;
    case "worktable":
    case "cabinet":
    case "drawers":
      l.line("detail", [L, B + UPSTAND], [R, B + UPSTAND]);
      break;
  }
}

// ---- Dimensions ----

function drawDims(project: Project, ps: number, shapes: Shape[]) {
  const { room } = project;
  const t = room.wallThickness;
  const first = t / ps + DIM_GAP;
  for (const w of walls(room)) {
    // The dimension line lies to the left of a→b; put it outside, away from the room.
    const left = { x: w.dir.y, y: -w.dir.x };
    const outside = dot(left, w.inward) < 0 ? 1 : -1;
    shapes.push({ t: "dim", pen: "dim", a: w.a, b: w.b, offset: outside * first, text: mm(w.length) });
  }
  const box = bounds(room.points);
  const second = first + DIM_ROW;
  // Overall width above the north side (left of west→east), overall depth left of the west side.
  shapes.push({ t: "dim", pen: "dim", a: { x: box.minX, y: box.minY }, b: { x: box.maxX, y: box.minY }, offset: second, text: mm(box.maxX - box.minX) });
  shapes.push({ t: "dim", pen: "dim", a: { x: box.minX, y: box.maxY }, b: { x: box.minX, y: box.minY }, offset: second, text: mm(box.maxY - box.minY) });
}
