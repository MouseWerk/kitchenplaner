// The four elevations (Ansichten) as Drawings: a section through the room looking at one wall,
// with the equipment in front of it drawn far to near so nearer items cover farther ones.
//
// Drawing coordinates: X runs along the viewer's right axis u, Y = -height (y down on screen,
// so higher up is further up on the sheet). The floor is Y = 0.

import { isOverhead, kindOf, type ItemKind } from "./catalog";
import { dot, footprint, frontOf, openingSpan, walls } from "./geometry";
import { positions } from "./project";
import type { Facing, Item, Opening, Project, Vec2 } from "./types";
import { mm, TEXT, type Drawing, type Pen, type Shape, type Fill } from "../render/drawing";

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

/** Thickness of a table top or appliance top (mm). */
const TOP = 40;
/** Height of the control panel of cooking appliances (mm). */
const PANEL = 150;
/** Height of the feet / plinth below doors and drawers (mm, usual 150 mm adjustable feet). */
const FEET = 150;
/** Height of the undershelf of a work table above the floor (mm). */
const UNDERSHELF = 250;
/** Width of legs and posts (mm, 40 mm square tube). */
const LEG = 40;
/** Usual width of one door of cabinets and counters (mm). */
const DOOR_MODULE = 600;
/** Depth of a sink bowl (mm). */
const BOWL_DEPTH = 250;
/** Width of a sink bowl (mm, as in the plan symbol). */
const BOWL_W = 500;
/** Range width from which it has six plates and knobs instead of four (as in the plan). */
const RANGE_SIX_PLATES_FROM = 1000;
/** Height of the base of a hood-type dishwasher below the hood (mm). */
const DISHWASHER_BASE = 850;
/** Fridge door handle: top end below the door top, and its length (mm). */
const FRIDGE_HANDLE_TOP = 400;
const FRIDGE_HANDLE = 600;
/** Height of the tap above the top (mm). */
const TAP = 300;
/** Usual width of a grease filter of a canopy hood (mm, 500 × 500 filters). */
const FILTER = 500;
/** Inset of front details from the item outline (mm). */
const INSET = 40;
/** Cold room door size (mm). */
const COLD_ROOM_DOOR_W = 800;
const COLD_ROOM_DOOR_H = 2000;

/**
 * The elevation looking towards `facing`: floor, the cut walls at both ends, the ceiling, the
 * openings of the wall looked at, and every item as a box from its elevation to its top with
 * front details when its front faces the viewer. Item shapes carry their `itemId`.
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
    const w = ws[o.wall];
    if (!w || -dot(w.inward, v) < WALL_FACES_VIEWER) continue;
    const span = openingSpan(room, o);
    if (span) drawOpening(o, dot(span[0], u), dot(span[1], u), shapes);
  }

  // Painter's order: the item whose nearest corner is farthest from the viewer first.
  const depth = (it: Item) => Math.min(...footprint(it).map((p) => dot(p, v)));
  const pos = positions(project);
  const items = [...project.items].sort((a, b) => depth(b) - depth(a));
  for (const it of items) {
    const ext = footprint(it).map((p) => dot(p, u));
    const left = Math.min(...ext);
    const right = Math.max(...ext);
    const kind = kindOf(it.catalogId);
    const facesViewer = dot(frontOf(it.rotation), { x: -v.x, y: -v.y }) > FACES_VIEWER;
    drawItem(it, kind, left, right, facesViewer, shapes);
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

  if (opts.showDims) {
    // Width below the floor (left of a→b is up, so a negative offset), height left of the room.
    shapes.push({ t: "dim", pen: "dim", a: { x: x0, y: 0 }, b: { x: x1, y: 0 }, offset: -DIM_OFFSET, text: mm(x1 - x0) });
    shapes.push({ t: "dim", pen: "dim", a: { x: x0 - t, y: 0 }, b: { x: x0 - t, y: -H }, offset: DIM_OFFSET, text: mm(H) });
  }
  return { shapes };
}

/** A rectangle from X `a` to `b` and from height `z0` to `z1` (drawing coordinates). */
function rect(a: number, b: number, z0: number, z1: number): Vec2[] {
  return [
    { x: a, y: -z0 },
    { x: b, y: -z0 },
    { x: b, y: -z1 },
    { x: a, y: -z1 },
  ];
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
  const f = INSET * 1.5;
  if (o.kind === "window") {
    shapes.push({ t: "poly", pen: "opening", fill: "glass", pts: rect(l + f, r - f, z0 + f, z1 - f), closed: true });
  } else {
    // The frame inside the opening; doors have no frame along the floor.
    shapes.push({ t: "poly", pen: "opening", pts: [{ x: l + f, y: -z0 }, { x: l + f, y: -(z1 - f) }, { x: r - f, y: -(z1 - f) }, { x: r - f, y: -z0 }], closed: false });
  }
}

/** Draws boxes and lines of one item in its elevation frame: X from `l` to `r`, heights in mm. */
class Front {
  constructor(
    private readonly it: Item,
    readonly l: number,
    readonly r: number,
    private readonly out: Shape[],
  ) {}

  get w(): number {
    return this.r - this.l;
  }

  box(pen: Pen, a: number, b: number, z0: number, z1: number, fill?: Fill) {
    this.out.push({ t: "poly", pen, fill, itemId: this.it.id, pts: rect(a, b, z0, z1), closed: true });
  }

  line(pen: Pen, ...pts: [number, number][]) {
    this.out.push({ t: "poly", pen, itemId: this.it.id, pts: pts.map(([x, z]) => ({ x, y: -z })), closed: false });
  }

  circle(pen: Pen, x: number, z: number, r: number) {
    this.out.push({ t: "circle", pen, itemId: this.it.id, c: { x, y: -z }, r });
  }

  /** `n` equal doors between z0 and z1 with vertical handles next to the middle joint. */
  doors(n: number, z0: number, z1: number) {
    const dw = (this.w - INSET * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const a = this.l + INSET + i * (dw + INSET);
      this.box("detail", a, a + dw, z0, z1);
      // Hinges outside, handles towards the middle (left half: handle right, right half: left).
      const hx = i < n / 2 ? a + dw - INSET : a + INSET;
      const zm = z1 - INSET * 2;
      this.line("detail", [hx, zm], [hx, zm - INSET * 4]);
    }
  }

  /** `n` drawers stacked between z0 and z1, each with a horizontal handle. */
  drawers(n: number, z0: number, z1: number) {
    const dh = (z1 - z0 - INSET * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const b = z0 + i * (dh + INSET);
      this.box("detail", this.l + INSET, this.r - INSET, b, b + dh);
      const c = (this.l + this.r) / 2;
      this.line("detail", [c - INSET * 3, b + dh - INSET * 1.5], [c + INSET * 3, b + dh - INSET * 1.5]);
    }
  }

  /** A control panel strip from z0 to z1 with `n` knobs. */
  panel(z0: number, z1: number, n: number) {
    this.box("detail", this.l, this.r, z0, z1);
    const step = this.w / (n + 1);
    for (let i = 1; i <= n; i++) this.circle("detail", this.l + step * i, (z0 + z1) / 2, (z1 - z0) * 0.25);
  }
}

function doorCount(width: number): number {
  return Math.max(1, Math.round(width / DOOR_MODULE));
}

function drawItem(it: Item, kind: ItemKind, l: number, r: number, facesViewer: boolean, shapes: Shape[]) {
  const z0 = it.elevation;
  const top = it.elevation + it.height;
  const f = new Front(it, l, r, shapes);
  const bodyFill: Fill = kind === "column" ? "wall" : "item";
  const bodyPen: Pen = kind === "column" ? "wall" : isOverhead(kind) ? "overhead" : "item";

  // A combi oven on a stand: the stand below the unit, legs and an undershelf.
  if (kind === "combiOven" && z0 > 0) {
    f.box("item", l, l + LEG, 0, z0, "item");
    f.box("item", r - LEG, r, 0, z0, "item");
    f.line("detail", [l, UNDERSHELF], [r, UNDERSHELF]);
    f.line("item", [l, z0], [r, z0]);
  }

  f.box(bodyPen, l, r, z0, top, bodyFill);

  if (!facesViewer) {
    if (it.height > TOP * 2) f.line("detail", [l, top - TOP], [r, top - TOP]);
    return;
  }

  const w = r - l;
  switch (kind) {
    case "worktable":
      f.box("detail", l, r, top - TOP, top);
      f.box("detail", l, l + LEG, z0, top - TOP);
      f.box("detail", r - LEG, r, z0, top - TOP);
      f.line("detail", [l + LEG, z0 + UNDERSHELF], [r - LEG, z0 + UNDERSHELF]);
      break;
    case "cabinet":
    case "counterFridge":
      f.box("detail", l, r, top - TOP, top);
      f.doors(kind === "counterFridge" ? Math.max(1, Math.floor(w / DOOR_MODULE)) : doorCount(w), z0 + FEET, top - TOP - INSET);
      break;
    case "drawers":
      f.box("detail", l, r, top - TOP, top);
      f.drawers(3, z0 + FEET, top - TOP - INSET);
      break;
    case "range": {
      // Hob on top, control panel, oven door with a handle below.
      f.box("detail", l, r, top - TOP, top);
      f.panel(top - TOP - PANEL, top - TOP, w >= RANGE_SIX_PLATES_FROM ? 6 : 4);
      const d0 = z0 + FEET;
      const d1 = top - TOP - PANEL - INSET;
      f.box("detail", l + INSET, r - INSET, d0, d1);
      f.line("detail", [l + INSET * 3, d1 - INSET * 1.5], [r - INSET * 3, d1 - INSET * 1.5]);
      break;
    }
    case "induction":
    case "fryer":
    case "griddle":
    case "kettle":
    case "tiltingPan":
      f.box("detail", l, r, top - TOP, top);
      f.panel(top - TOP - PANEL, top - TOP, kind === "fryer" ? 2 : 4);
      f.doors(doorCount(w), z0 + FEET, top - TOP - PANEL - INSET);
      break;
    case "combiOven": {
      // Door with a viewing window, control panel at the right.
      const panelW = Math.min(PANEL + INSET, w / 4);
      const dr = r - panelW;
      f.box("detail", l + INSET, dr - INSET / 2, z0 + INSET, top - INSET);
      f.box("detail", l + INSET * 3, dr - INSET * 3, z0 + INSET * 4, top - INSET * 4, "glass");
      f.box("detail", dr, r - INSET / 2, z0 + INSET, top - INSET, "item-dark");
      for (let i = 1; i <= 3; i++) f.circle("detail", (dr + r) / 2, top - INSET - ((top - z0) / 6) * i, panelW * 0.2);
      break;
    }
    case "fridge":
      f.box("detail", l + INSET / 2, r - INSET / 2, z0 + FEET, top - INSET / 2);
      f.line("detail", [r - INSET * 2, top - FRIDGE_HANDLE_TOP], [r - INSET * 2, top - FRIDGE_HANDLE_TOP - FRIDGE_HANDLE]);
      break;
    case "sink": {
      f.box("detail", l, r, top - TOP, top);
      // The bowl lies behind the front: hidden. Bowls at the right end as in the plan.
      const bw = Math.min(BOWL_W, w - 2 * INSET);
      f.box("hidden", r - INSET - bw, r - INSET, top - BOWL_DEPTH, top - TOP);
      const tx = r - INSET - bw / 2;
      f.line("detail", [tx, top], [tx, top + TAP], [tx - INSET * 3, top + TAP]);
      f.box("detail", l, l + LEG, z0, top - TOP);
      f.box("detail", r - LEG, r, z0, top - TOP);
      f.line("detail", [l + LEG, z0 + UNDERSHELF], [r - LEG, z0 + UNDERSHELF]);
      break;
    }
    case "handwash": {
      f.box("hidden", l + INSET, r - INSET, top - BOWL_DEPTH * 0.6, top - INSET / 2);
      const c = (l + r) / 2;
      f.line("detail", [c, top], [c, top + TAP * 0.6], [c - INSET * 2, top + TAP * 0.6]);
      break;
    }
    case "dishwasher": {
      // The washing hood above the base, with its lift handle.
      const base = Math.min(DISHWASHER_BASE, it.height * 0.55);
      f.box("detail", l + INSET / 2, r - INSET / 2, z0 + FEET, z0 + base);
      f.line("detail", [l, z0 + base + INSET], [r, z0 + base + INSET]);
      f.line("detail", [l + INSET * 3, z0 + base + INSET * 4], [r - INSET * 3, z0 + base + INSET * 4]);
      break;
    }
    case "shelving": {
      const levels = 4;
      f.box("detail", l, l + LEG, z0, top);
      f.box("detail", r - LEG, r, z0, top);
      for (let i = 0; i < levels; i++) {
        const z = z0 + FEET + ((it.height - FEET - TOP) * i) / (levels - 1);
        f.box("detail", l + LEG, r - LEG, z, z + TOP);
      }
      break;
    }
    case "wallShelf":
      f.line("detail", [l, top - TOP], [r, top - TOP]);
      break;
    case "hood": {
      // Grease filters in the lower part of the front.
      const n = Math.max(1, Math.floor((w - 2 * INSET) / FILTER));
      const fw = (w - 2 * INSET) / n;
      const fz0 = z0 + INSET;
      const fz1 = z0 + Math.min(it.height - INSET, FILTER * 0.6);
      for (let i = 0; i < n; i++) {
        const a = l + INSET + i * fw;
        f.box("detail", a + INSET / 4, a + fw - INSET / 4, fz0, fz1);
        f.line("detail", [a + INSET / 4, fz0], [a + fw - INSET / 4, fz1]);
      }
      break;
    }
    case "coldRoom": {
      const dw = Math.min(COLD_ROOM_DOOR_W, w - 2 * INSET);
      const c = (l + r) / 2;
      const dh = Math.min(COLD_ROOM_DOOR_H, it.height - INSET);
      f.box("detail", c - dw / 2, c + dw / 2, z0, z0 + dh);
      f.line("detail", [c + dw / 2 - INSET * 2, z0 + dh / 2 - INSET * 3], [c + dw / 2 - INSET * 2, z0 + dh / 2 + INSET * 3]);
      break;
    }
    case "column":
      break;
  }
}
