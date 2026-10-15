// Parts the serving counters share: counter bodies with Gastronorm wells, the pans and food in
// them, sneeze guards over them, control panels, castors of mobile units and the tableware that
// tells a serving unit from a plain counter (plates, glasses, cups, bottles). Plan and elevation
// sizes are millimetres, 3D sizes metres; the well layout is computed once in millimetres so all
// three views agree.

import { ventSlots } from "../parts/details";
import { INSET as FRONT_INSET, type Front } from "../parts/elevation";
import { BODY_RADIUS, castor, DOOR, DOOR_RADIUS, GAP, GN_RADIUS, HANDLE, LEG, PLINTH, plinth, SHEET, TOP, worktop, type Hole, type MaterialId, type Parts, type ProfilePoint, type Size } from "../parts/mesh";
import { INSET, type PlanSketch } from "../parts/plan";

/** Gastronorm GN 1/1 pan (mm): 530 × 325, laid crosswise in a counter (the long side to the front). */
export const GN_LONG = 530;
export const GN_SHORT = 325;
/** Pitch of crosswise GN 1/1 wells along a counter (mm): the well and the web to the next one. */
const WELL_PITCH = 370;
/** Margin between the ends of the counter and the first well (mm). */
const WELL_END = 60;
/** Depth of a well below the top in 3D (m): a 150 mm GN pan and the water bath under it. */
export const WELL_DEPTH = 0.2;
/** How far the food in a pan lies below the rim (m). */
const FOOD_DROP = 0.04;
/** Depth of a GN pan hanging in a well (m), its sheet and how far its flange reaches over the hole. */
const PAN_DEPTH = 0.15;
const PAN_WALL = 0.003;
const PAN_FLANGE = 0.01;
/** Radius of a sneeze guard post (m) and of its foot rosette. */
const POST = 0.012;
const POST_FOOT = 0.024;
/** Glass thickness as drawn (m) and the radius of the panes' corners. */
export const GLASS = 0.008;
const GLASS_RADIUS = 0.01;
/** Height of the light bar under a guard's top shelf (m). */
const LIGHT_BAR = 0.025;
/** Thickness of a control panel sheet on a front (m). */
export const PANEL_SHEET = 0.002;
/** Thickness of the gasket behind a cooled door (m). */
const GASKET = 0.004;
/** Radius of a pilot lamp's bezel (m). */
const PILOT_R = 0.007;

/** A rectangle in the item frame (mm): x along the width, y from the back (-) to the front (+). */
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Millimetres to metres. */
export const m = (mm: number) => mm / 1000;

/** Number of crosswise GN 1/1 wells a counter of the given width holds (mm). */
export function wellCount(width: number): number {
  return Math.max(1, Math.floor((width - 2 * WELL_END) / WELL_PITCH));
}

/** The wells of a row along the width, centred, from `y0` to `y1` (mm, item frame). */
export function wellRow(width: number, y0: number, y1: number): Rect[] {
  const n = wellCount(width);
  const pitch = Math.min(WELL_PITCH, (width - 2 * WELL_END) / n);
  const half = Math.min(GN_SHORT / 2, pitch / 2 - INSET / 2);
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const cx = -(n * pitch) / 2 + pitch * (i + 0.5);
    out.push({ x0: cx - half, x1: cx + half, y0, y1 });
  }
  return out;
}

/** Wells in the plan: the opening and the pan's rim inside it. */
export function planWells(s: PlanSketch, wells: readonly Rect[]): void {
  for (const r of wells) {
    s.rect("detail", r.x0, r.y0, r.x1, r.y1);
    s.rect("detail", r.x0 + INSET / 2, r.y0 + INSET / 2, r.x1 - INSET / 2, r.y1 - INSET / 2);
  }
}

/** Wells in metres, as holes of the top. */
export function holesOf(wells: readonly Rect[]): Hole[] {
  return wells.map((r) => ({ x0: r.x0 / 1000, x1: r.x1 / 1000, z0: r.y0 / 1000, z1: r.y1 / 1000 }));
}

/**
 * A counter body on a plinth with its top, open over the holes: below the wells the body is
 * solid, around them only its skins stand, so the wells stay open from above. `zFront` is where
 * the body's front stands (the doors stand in front of it).
 */
export function counterBody(p: Parts, s: Size, holes: readonly Hole[] = [], topMat: MaterialId = "steel", zFront = s.d / 2 - DOOR): void {
  const { w, d, h } = s;
  plinth(p, w, d);
  // A dark sheet behind the doors, so the gaps round them read as gaps.
  p.box("top", -w / 2 + 0.002, w / 2 - 0.002, PLINTH + 0.002, h - TOP, zFront, zFront + 0.002);
  if (holes.length === 0) {
    p.roundedBox("steel", -w / 2, w / 2, PLINTH, h - TOP, -d / 2, zFront, BODY_RADIUS, "vertical");
    worktop(p, topMat, -w / 2, w / 2, h - TOP, h, -d / 2, d / 2);
    return;
  }
  const yb = h - WELL_DEPTH - SHEET;
  p.roundedBox("steel", -w / 2, w / 2, PLINTH, yb, -d / 2, zFront, BODY_RADIUS, "vertical");
  p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, yb, h - TOP, -d / 2, -d / 2 + SHEET);
  p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, yb, h - TOP, zFront - SHEET, zFront);
  p.roundedBox("steel", -w / 2, -w / 2 + SHEET, yb, h - TOP, -d / 2, zFront, BODY_RADIUS, "vertical");
  p.roundedBox("steel", w / 2 - SHEET, w / 2, yb, h - TOP, -d / 2, zFront, BODY_RADIUS, "vertical");
  p.topWithHoles(topMat, w, d, h - TOP, h, holes);
}

/**
 * Gastronorm pans in the wells: a dark well under each, the pan hanging in it on its flange, and
 * the food heaped a little below the rim, its material taken in turn from `food` (so a row of
 * pans reads as different dishes). Without food the pans stand empty. Every other pan holds a
 * serving spoon leaning on its front rim, when `spoons` is set (it rises up to 60 mm over the
 * top: the kind must declare a rise).
 */
export function wellPans(p: Parts, holes: readonly Hole[], top: number, food: readonly MaterialId[], spoons = true, water = false): void {
  holes.forEach((hl, i) => {
    const depth = Math.min(WELL_DEPTH, top - PLINTH);
    p.tub("steelDark", hl.x0, hl.x1, top - depth, top - 0.001, hl.z0, hl.z1, SHEET / 2);
    if (water) p.roundedBox("water", hl.x0 + 0.006, hl.x1 - 0.006, top - depth + 0.006, top - 0.06, hl.z0 + 0.006, hl.z1 - 0.006, 0.014, "vertical");
    // The pan, its flange lying on the top round the hole.
    const x0 = hl.x0 - PAN_FLANGE;
    const x1 = hl.x1 + PAN_FLANGE;
    const z0 = hl.z0 - PAN_FLANGE;
    const z1 = hl.z1 + PAN_FLANGE;
    p.pan("steel", x0, x1, top - Math.min(PAN_DEPTH, depth - 0.01), top + 0.002, z0, z1, { wall: PAN_WALL, r: GN_RADIUS + PAN_FLANGE, rim: PAN_FLANGE + 0.002 });
    if (food.length === 0) return;
    const mat = food[i % food.length];
    foodMound(p, mat, hl.x0 + 0.006, hl.x1 - 0.006, top - 0.1, top - FOOD_DROP, hl.z0 + 0.006, hl.z1 - 0.006);
    if (spoons && i % 2 === 0) servingSpoon(p, (hl.x0 + hl.x1) / 2 + 0.03, top - FOOD_DROP, hl.z1 - 0.004, top + 0.05);
  });
}

/**
 * Food heaped in a pan or a bowl filling the box: flat sides with round corners and a gently
 * domed top, so it reads as a filling and not as a block.
 */
export function foodMound(p: Parts, mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  const r = Math.min(GN_RADIUS, (x1 - x0) / 4, (z1 - z0) / 4);
  const h = y1 - y0;
  const dome = Math.min(0.015, h * 0.3);
  p.lathe(
    mat,
    (x0 + x1) / 2,
    y0,
    (z0 + z1) / 2,
    [
      [0, 0],
      [r, 0],
      [r, h - dome],
      [r * 0.6, h - dome * 0.4],
      [0, h],
    ],
    { rect: [(x1 - x0) / 2 - r, (z1 - z0) / 2 - r] },
  );
}

/**
 * A serving spoon in a pan: its bowl in the food at `yFood`, the handle leaning on the rim at
 * `zRim` and ending at `yTop`.
 */
export function servingSpoon(p: Parts, x: number, yFood: number, zRim: number, yTop: number): void {
  p.lathe("handle", x, yFood - 0.004, zRim - 0.09, [
    [0, 0],
    [0.022, 0.002],
    [0.03, 0.008],
    [0.03, 0.01],
    [0, 0.01],
  ]);
  p.tube(
    "handle",
    [
      { x, y: yFood + 0.004, z: zRim - 0.07 },
      { x, y: yTop - 0.012, z: zRim - 0.004 },
      { x, y: yTop - 0.004, z: zRim + 0.004 },
    ],
    0.004,
    { bend: 0.02 },
  );
}

/** Options of a sneeze guard. */
export interface GuardOptions {
  /** Where the posts and the upright pane stand across the depth (m). */
  zPost: number;
  /** The top shelf (glass) from z0 to z1 (m). */
  z0: number;
  z1: number;
  /** A light bar under the shelf (white strip) or heat elements (dark rods), or nothing. */
  light?: "light" | "heat";
  /** Posts at the ends only (default) or also every this much along the width (m). */
  pitch?: number;
  /** Inset of the end posts from the ends (m). */
  inset?: number;
  /** The upright pane between the posts (default); an island's roof has none. */
  pane?: boolean;
}

/** Positions of the posts of a guard along the width (m). */
function postXs(w: number, inset: number, pitch?: number): number[] {
  const a = -w / 2 + inset;
  const b = w / 2 - inset;
  const n = pitch ? Math.max(1, Math.round((b - a) / pitch)) : 1;
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/**
 * A sneeze guard over a counter whose top is at `top`, rising `rise` above it: turned posts on
 * rosettes, an upright pane between them from a hand's gap over the top, and a glass shelf on
 * brackets at the top, optionally with a light or heat bar under it.
 */
export function sneezeGuard(p: Parts, w: number, top: number, rise: number, o: GuardOptions): void {
  const y1 = top + rise;
  const inset = o.inset ?? LEG;
  const xs = postXs(w, inset, o.pitch);
  const zs = Math.min(o.z0, o.zPost);
  const ze = Math.max(o.z1, o.zPost);
  const yShelf = y1 - GLASS;
  for (const x of xs) {
    p.lathe("handle", x, top, o.zPost, [
      [0, 0],
      [POST_FOOT, 0],
      [POST_FOOT, 0.003],
      [POST * 1.2, 0.012],
      [POST, 0.018],
      [POST, yShelf - 0.022 - top],
      [POST * 0.8, yShelf - 0.02 - top],
      [0, yShelf - 0.02 - top],
    ]);
    // Bracket under the shelf, from the post to the shelf's far edge.
    p.roundedBox("handle", x - POST * 0.6, x + POST * 0.6, yShelf - 0.02, yShelf, zs + 0.01, ze - 0.01, 0.003, "vertical", "z");
  }
  const gap = Math.min(0.15, rise * 0.35);
  const x0 = xs[0] + POST;
  const x1 = xs[xs.length - 1] - POST;
  if ((o.pane ?? true) && yShelf - 0.03 > top + gap + 0.02) p.plate("glass", x0, x1, top + gap, yShelf - 0.03, o.zPost - GLASS / 2, o.zPost + GLASS / 2, GLASS_RADIUS);
  // The shelf: a glass plate with polished edges over the posts' ends.
  p.roundedBox("glass", -w / 2 + inset - POST_FOOT, w / 2 - inset + POST_FOOT, yShelf, y1, o.z0, o.z1, 0.002, "vertical");
  if (o.light) {
    const lz0 = Math.max(o.z0 + 0.02, (o.z0 + o.z1) / 2 - 0.04);
    const lz1 = Math.min(o.z1 - 0.02, lz0 + 0.08);
    const ly = yShelf - 0.002;
    p.roundedBox("satin", x0 + 0.02, x1 - 0.02, ly - LIGHT_BAR, ly, lz0, lz1, 0.008, "all", "x");
    if (o.light === "light") p.roundedBox("panel", x0 + 0.04, x1 - 0.04, ly - LIGHT_BAR - 0.002, ly - LIGHT_BAR + 0.001, lz0 + 0.015, lz1 - 0.015, 0.005, "vertical");
    else for (const z of [lz0 + 0.022, lz1 - 0.022]) p.rod("ceramic", "x", (x0 + x1) / 2, ly - LIGHT_BAR - 0.004, z, x1 - x0 - 0.08, 0.006);
  }
}

/** A sneeze guard in the elevation: the posts and the pane above the top. */
export function sneezeGuardFront(f: Front, rise: number): void {
  const { l, r, top } = f;
  const I = FRONT_INSET;
  f.line("detail", [l + I, top], [l + I, top + rise]);
  f.line("detail", [r - I, top], [r - I, top + rise]);
  f.box("detail", l + I, r - I, top + rise * 0.35, top + rise, "glass");
}

/** Wheel radius and height of a castor of a mobile unit (m). */
export const CASTOR = { r: 0.05, h: 0.13 };

/** Four castors at the corners of a mobile unit, inside its footprint; the body starts at `CASTOR.h`. */
export function castors(p: Parts, w: number, d: number): void {
  const { r, h } = CASTOR;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - r - SHEET);
      const z = sz * (d / 2 - r - SHEET);
      castor(p, x, z, r, h);
    }
  }
}

/** Castors in the elevation: two wheels under the body. */
export function castorsFront(f: Front): void {
  const rr = CASTOR.r * 1000;
  f.circle("detail", f.l + rr + FRONT_INSET / 2, f.z0 + rr, rr);
  f.circle("detail", f.r - rr - FRONT_INSET / 2, f.z0 + rr, rr);
  f.line("detail", [f.l, f.z0 + CASTOR.h * 1000], [f.r, f.z0 + CASTOR.h * 1000]);
}

/**
 * A rubber bumper round the base of a mobile unit from `y0` to `y1`: a block with round corners
 * and rounded outer edges, filling the box.
 */
export function bumper(p: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  const w = x1 - x0;
  const d = z1 - z0;
  const r = Math.min(0.03, w / 4, d / 4);
  const t = Math.min(0.012, (y1 - y0) / 2);
  p.lathe(
    "rubber",
    (x0 + x1) / 2,
    y0,
    (z0 + z1) / 2,
    [
      [0, 0],
      [r - t, 0],
      [r, t],
      [r, y1 - y0 - t],
      [r - t, y1 - y0],
      [0, y1 - y0],
    ],
    { rect: [w / 2 - r, d / 2 - r] },
  );
}

/** Options of a control panel. */
export interface PanelOptions {
  /** Thermostat knobs spread over the panel. */
  knobs?: number;
  /** A temperature display at the left. */
  display?: boolean;
  /** A pilot lamp per knob (amber), above it. */
  pilots?: boolean;
  /** A rocker switch at the right. */
  rocker?: boolean;
}

/**
 * A control panel on a front at `zFace` (its knobs end at `zFront`): a dark plate with round
 * corners, thermostat knobs with a pilot lamp each, a display and a main switch as asked.
 */
export function controlPanel(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number, zFront: number, o: PanelOptions = {}): void {
  const zp = zFace + PANEL_SHEET;
  p.plate("panelDark", x0, x1, y0, y1, zFace, zp, BODY_RADIUS * 3, true);
  const h = y1 - y0;
  const cy = (y0 + y1) / 2;
  let a = x0 + 0.03;
  let b = x1 - 0.03;
  if (o.display && b - a > 0.15) {
    p.plate("glassDark", a, a + 0.07, cy - Math.min(0.016, h * 0.25), cy + Math.min(0.016, h * 0.25), zp, zp + 0.001, 0.003);
    a += 0.09;
  }
  if (o.rocker && b - a > 0.08) {
    rocker(p, b - 0.015, cy, zp, zFront);
    b -= 0.05;
  }
  const n = o.knobs ?? 0;
  if (n <= 0) return;
  const step = Math.min((b - a) / n, 0.12);
  const start = (a + b) / 2 - (step * (n - 1)) / 2;
  const kr = Math.min(0.02, h * 0.28, step * 0.35);
  for (let i = 0; i < n; i++) {
    const x = start + step * i;
    const ky = o.pilots ? cy - h * 0.1 : cy;
    p.knob(x, ky, zp, zFront, kr);
    if (o.pilots) pilotLamp(p, x + kr + 0.012, Math.min(y1 - PILOT_R - 0.004, ky + kr + 0.004), zp, "oil");
  }
}

/** A pilot lamp standing out of a face at `zFace`: a turned bezel with a domed lens. */
export function pilotLamp(p: Parts, x: number, y: number, zFace: number, lens: MaterialId = "oil", r = PILOT_R): void {
  p.lathe(
    "satin",
    x,
    y,
    zFace,
    [
      [0, 0],
      [r, 0],
      [r, 0.002],
      [r * 0.75, 0.003],
      [0, 0.003],
    ],
    { axis: "z" },
  );
  p.lathe(
    lens,
    x,
    y,
    zFace + 0.003,
    [
      [0, 0],
      [r * 0.68, 0],
      [r * 0.5, 0.002],
      [0, 0.003],
    ],
    { axis: "z" },
  );
}

/** A rocker switch centred at (x, y) on a face at `zFace`, standing out to at most `zFront`. */
export function rocker(p: Parts, x: number, y: number, zFace: number, zFront: number): void {
  const t = Math.min(0.012, zFront - zFace);
  p.roundedBox("knob", x - 0.012, x + 0.012, y - 0.018, y + 0.018, zFace, zFace + t * 0.5, 0.003, "top", "z");
  p.roundedBox("signalRed", x - 0.009, x + 0.009, y, y + 0.014, zFace + t * 0.5, zFace + t, 0.003, "top", "z");
}

/**
 * A rating plate (Typenschild): a small bright plate on a face at `zFace` with the dark band of
 * its text, a hair proud of the face.
 */
export function ratingPlate(p: Parts, x: number, y: number, zFace: number, dir: 1 | -1 = 1): void {
  // Parts are at least a millimetre thick: the plate stands a millimetre proud, its text half
  // a millimetre more.
  const z0 = dir > 0 ? zFace : zFace - 0.001;
  p.plate("satin", x - 0.04, x + 0.04, y - 0.02, y + 0.02, z0, z0 + 0.001, 0.002);
  for (const k of [0.008, -0.002]) p.box("slot", x - 0.03, x + 0.02, y + k - 0.002, y + k + 0.002, z0 + dir * 0.0005, z0 + dir * 0.0005 + 0.001);
}

/**
 * Door leaves with a dark gap round them on a front: `count` leaves side by side from x0 to x1,
 * rounded at the front, their faces at `zFace`, with a bar handle each ending at `zFront`; a
 * cooled door (`gasket`) sits on its rubber gasket.
 */
export function leafDoors(p: Parts, x0: number, x1: number, y0: number, y1: number, zBody: number, zFace: number, zFront: number, count: number, handle: "vertical" | "top" = "vertical", gasket = false): void {
  const dw = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const a = x0 + i * dw + GAP;
    const b = x0 + (i + 1) * dw - GAP;
    // An insulated (cooled) door sits on a rubber gasket that shows dark in the gap round it.
    const g = gasket ? GASKET : 0;
    if (gasket) p.roundedBox("rubber", a + GAP / 2, b - GAP / 2, y0 + GAP * 1.5, y1 - GAP * 1.5, zBody, zBody + g, 0.003, "vertical", "z");
    p.roundedBox("steel", a, b, y0 + GAP, y1 - GAP, zBody + g, zFace, gasket ? 0.004 : DOOR_RADIUS, "top", "z");
    if (handle === "vertical") {
      const atLeft = count > 1 && i % 2 === 1;
      const hx = atLeft ? a + HANDLE * 1.5 : b - HANDLE * 1.5;
      const len = Math.min(0.3, (y1 - y0) * 0.45);
      const mid = y1 - len / 2 - Math.min(0.06, (y1 - y0) * 0.1);
      p.barHandle("y", mid - len / 2, mid + len / 2, hx, zFace, zFront);
    } else {
      const len = Math.min(0.3, (b - a) * 0.6);
      p.barHandle("x", (a + b) / 2 - len / 2, (a + b) / 2 + len / 2, y1 - 0.045, zFace, zFront);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Tableware and goods (turned parts)

/**
 * A stack of plates standing at (x, y0, z), radius `r`, `h` high: one turned profile whose rims
 * step in and out per plate, the top plate with its well.
 */
export function plateStack(p: Parts, x: number, y0: number, z: number, r: number, h: number, mat: MaterialId = "panel"): void {
  const pitch = 0.016;
  const n = Math.max(1, Math.min(12, Math.round(h / pitch)));
  const step = h / n;
  const pts: ProfilePoint[] = [
    [0, 0],
    [r * 0.62, 0],
    [r * 0.7, step * 0.3],
  ];
  for (let i = 0; i < n; i++) {
    const y = i * step;
    // Two points a plate (its rim out, the next one's foot in): the stack reads as plates from a
    // metre away at two thirds of the triangles of a rounded rim.
    pts.push([r, y + step * 0.7], [r * 0.95, y + step]);
  }
  pts.push([r * 0.6, h - 0.004], [r * 0.55, h - 0.006], [0, h - 0.006]);
  p.lathe(mat, x, y0, z, pts);
}

/** A single plate lying at (x, y0, z), radius `r`, with a mound of food in its well if asked. */
export function dish(p: Parts, x: number, y0: number, z: number, r: number, food?: MaterialId): void {
  p.lathe("panel", x, y0, z, [
    [0, 0],
    [r * 0.6, 0],
    [r * 0.66, 0.006],
    [r * 0.98, 0.016],
    [r, 0.02],
    [r * 0.95, 0.02],
    [r * 0.62, 0.01],
    [0, 0.01],
  ]);
  if (food) {
    p.lathe(food, x, y0 + 0.009, z, [
      [0, 0],
      [r * 0.5, 0],
      [r * 0.42, 0.02],
      [r * 0.2, 0.034],
      [0, 0.036],
    ]);
  }
}

/** A drinking glass standing upside down at (x, y0, z) (radius `r` at its rim, `h` high). */
export function tumbler(p: Parts, x: number, y0: number, z: number, r: number, h: number, upright = false): void {
  const out: ProfilePoint[] = upright
    ? [
        [0, 0],
        [r * 0.8, 0],
        [r, h],
        [r * 0.93, h],
        [r * 0.75, 0.008],
        [0, 0.008],
      ]
    : [
        [0, 0],
        [r, 0],
        [r * 0.8, h],
        [0, h],
      ];
  // Glasses come by the dozen: twelve steps round are round enough at their size.
  p.lathe("glass", x, y0, z, out, { segments: 12 });
}

/** A cup standing upside down at (x, y0, z): a turned body in white porcelain. */
export function cup(p: Parts, x: number, y0: number, z: number, r: number, h: number): void {
  p.lathe("panel", x, y0, z, [
    [0, 0],
    [r, 0],
    [r * 0.96, h * 0.5],
    [r * 0.7, h * 0.94],
    [r * 0.6, h],
    [0, h],
  ]);
}

/** A bottle standing at (x, y0, z): body, shoulder, neck and cap, `h` high, radius `r`. */
export function bottle(p: Parts, x: number, y0: number, z: number, r: number, h: number, mat: MaterialId, cap: MaterialId = "satin"): void {
  // Bottles stand in rows of dozens: twelve steps round the body, eight round the cap.
  const neck = Math.max(0.008, r * 0.32);
  p.lathe(
    mat,
    x,
    y0,
    z,
    [
      [0, 0],
      [r, 0],
      [r, h * 0.6],
      [r * 0.8, h * 0.68],
      [neck * 1.1, h * 0.78],
      [neck, h * 0.92],
      [0, h * 0.92],
    ],
    { segments: 12 },
  );
  p.lathe(
    cap,
    x,
    y0 + h * 0.92,
    z,
    [
      [0, 0],
      [neck * 1.15, 0],
      [neck * 1.15, h * 0.08],
      [0, h * 0.08],
    ],
    { segments: 8 },
  );
}

/** Bottles in a row from x0 to x1 at (y0, z), `r` and `h` each, materials in turn. */
export function bottleRow(p: Parts, x0: number, x1: number, y0: number, z: number, r: number, h: number, mats: readonly MaterialId[], max = Infinity): void {
  const n = Math.max(1, Math.min(max, Math.floor((x1 - x0) / (r * 2 + 0.02))));
  const pitch = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const hh = h * (i % 3 === 1 ? 0.88 : 1);
    bottle(p, x0 + pitch * (i + 0.5), y0, z, r, hh, mats[i % mats.length]);
  }
}

/** A tap lever and spout of a drink dispenser on a face at `zFace`, its spout at height y. */
export function dispenserTap(p: Parts, x: number, y: number, zFace: number, zFront: number): void {
  const reach = zFront - zFace;
  p.lathe(
    "satin",
    x,
    y,
    zFace,
    [
      [0, 0],
      [0.014, 0],
      [0.014, 0.006],
      [0.009, 0.01],
      [0.009, reach * 0.6],
      [0, reach * 0.6],
    ],
    { axis: "z" },
  );
  p.tube(
    "satin",
    [
      { x, y, z: zFace + reach * 0.5 },
      { x, y, z: zFace + reach * 0.8 },
      { x, y: y - 0.03, z: zFace + reach * 0.8 },
    ],
    0.006,
    { bend: 0.01 },
  );
  // The lever on top of the tap body.
  p.tube(
    "knob",
    [
      { x, y: y + 0.008, z: zFace + reach * 0.4 },
      { x, y: y + 0.05, z: zFront - 0.01 },
    ],
    0.007,
  );
}

/** A drip tray: a shallow tray with a grid over it, filling the box. */
export function dripTray(p: Parts, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  p.pan("steelDark", x0, x1, y0, y1, z0, z1, { wall: 0.002, r: 0.008 });
  p.grid(x0 + 0.004, x1 - 0.004, y1 - 0.006, y1 - 0.001, z0 + 0.004, z1 - 0.004, 0.012, "x");
}

/** A hairline seam between two panels on a face: a dark strip a hair proud (dir: which side faces out). */
export function seam(p: Parts, axis: "x" | "y", a: number, b: number, at: number, zFace: number, dir: 1 | -1 = 1): void {
  // A millimetre thick (the least a part is), half of it in the face.
  const z0 = zFace - 0.0005 + dir * 0.0001;
  if (axis === "x") p.box("slot", a, b, at - 0.0012, at + 0.0012, z0, z0 + 0.001);
  else p.box("slot", at - 0.0012, at + 0.0012, a, b, z0, z0 + 0.001);
}

/**
 * A stack of serving trays from `y0`, `count` trays of `t` each filling x0..x1 and z0..z1: moulded
 * trays with round corners and a raised rim, alternating two dark tones so they read one by one.
 */
export function trayStack(p: Parts, x0: number, x1: number, y0: number, z0: number, z1: number, count: number, t: number): void {
  for (let i = 0; i < count; i++) {
    const y = y0 + i * t;
    p.roundedBox(i % 2 === 0 ? "panelDark" : "knob", x0, x1, y, y + t - 0.001, z0, z1, Math.min(0.025, (x1 - x0) / 4), "vertical");
  }
  // The top tray's rim round its well.
  const r = Math.min(0.025, (x1 - x0) / 4, (z1 - z0) / 4);
  const yt = y0 + count * t - 0.001;
  p.lathe(
    count % 2 === 1 ? "panelDark" : "knob",
    (x0 + x1) / 2,
    yt,
    (z0 + z1) / 2,
    [
      [r - 0.012, 0],
      [r, 0],
      [r - 0.002, 0.005],
      [r - 0.01, 0.005],
      [r - 0.012, 0],
    ],
    { rect: [(x1 - x0) / 2 - r, (z1 - z0) / 2 - r] },
  );
}

/**
 * A cooled drink dispenser standing at y0 from z0 (back) to z1 (front), `w` wide and `h` high
 * centred on x: the cooling base with its louvre, a clear tank with the drink in it and its lid,
 * the tap at the front of the base and the drip tray under it (in front of the base, up to z1).
 */
export function drinkDispenser(p: Parts, x: number, y0: number, z0: number, z1: number, w: number, h: number, drink: MaterialId): void {
  const hw = w / 2;
  const base = Math.min(0.22, h * 0.36);
  const zb = z1 - 0.1;
  p.roundedBox("steel", x - hw, x + hw, y0, y0 + base, z0, zb, 0.012, "vertical");
  ventSlots(p, x - hw * 0.6, x + hw * 0.6, y0 + 0.02, y0 + base * 0.35, zb, 3);
  // The tank: clear with round corners, the drink up to two thirds, a dark lid with a grip.
  const ty0 = y0 + base;
  const ty1 = y0 + h - 0.03;
  const r = Math.min(0.03, hw * 0.4);
  p.roundedBox("glass", x - hw * 0.92, x + hw * 0.92, ty0, ty1, z0 + 0.01, zb - 0.01, r, "vertical");
  p.roundedBox(drink, x - hw * 0.85, x + hw * 0.85, ty0 + 0.004, ty0 + (ty1 - ty0) * 0.66, z0 + 0.02, zb - 0.02, r * 0.7, "vertical");
  p.roundedBox("panelDark", x - hw * 0.95, x + hw * 0.95, ty1, y0 + h - 0.008, z0 + 0.006, zb - 0.006, r, "top");
  p.roundedBox("panelDark", x - 0.03, x + 0.03, y0 + h - 0.009, y0 + h, (z0 + zb) / 2 - 0.015, (z0 + zb) / 2 + 0.015, 0.005);
  dispenserTap(p, x, y0 + base * 0.62, zb, z1 - 0.03);
  dripTray(p, x - hw * 0.7, x + hw * 0.7, y0, y0 + 0.02, zb, z1);
}
