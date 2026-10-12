// 3D models of the equipment, one group per item, built from a few shared parts.
//
// Units: 1 three.js unit = 1 m, y up. Plan (x, y) maps to three (x, z): the plan's y axis
// (south, down on screen) becomes +z. Every model is first built in its own frame, x along the
// width, z towards the front and y up from the floor, then placed and turned.
//
// All meshes reuse one unit box and one unit cylinder, scaled per part, and a fixed set of
// materials, so a kitchen with a hundred items creates no new GPU buffers when it changes.
// Callers that own a renderer hold the cache with `retainShared()` and give it back with
// `releaseShared()`; the last release disposes it. The code needs no WebGL context.

import * as THREE from "three";
import type { Item } from "../model/types";
import { kindOf, sinkBowlCount, type ItemKind } from "../model/catalog";
import { rad } from "../model/geometry";

/** Millimetres per three.js unit (metre). */
export const MM_PER_UNIT = 1000;

/** Segments around a cylinder: round enough at kitchen scale, cheap to draw. */
const CYLINDER_SEGMENTS = 24;

// ---------------------------------------------------------------------------------------------
// Shared geometry and materials

interface Shared {
  box: THREE.BoxGeometry;
  cylinder: THREE.CylinderGeometry;
  mat: Record<MaterialId, THREE.Material>;
  /** Selected look of each material, made on first use. */
  highlighted: Map<THREE.Material, THREE.Material>;
}

/**
 * Selected items glow faintly in a neutral gray: a lift in brightness that reads on every
 * colour of steel and panel, without an accent colour.
 */
const HIGHLIGHT_EMISSIVE = 0x2e2e2e;

type MaterialId =
  | "steel"
  | "steelDark"
  | "handle"
  | "top"
  | "ceramic"
  | "zone"
  | "plate"
  | "glass"
  | "panel"
  | "panelDark"
  | "oil"
  | "basket"
  | "concrete";

let shared: Shared | null = null;
let holders = 0;

function std(color: number, metalness: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function getShared(): Shared {
  if (shared) return shared;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, CYLINDER_SEGMENTS);
  const mat: Record<MaterialId, THREE.Material> = {
    // Brushed stainless steel: light gray, half metallic so it reads in a dim scene too.
    steel: std(0xc8ccd0, 0.6, 0.35),
    steelDark: std(0x8c9196, 0.6, 0.4),
    handle: std(0xe2e5e8, 0.8, 0.25),
    top: std(0x2c2e31, 0.35, 0.5),
    ceramic: std(0x121315, 0.1, 0.15),
    zone: std(0x45484d, 0.1, 0.3),
    plate: std(0x1d1e20, 0.5, 0.45),
    glass: std(0x9fb2bd, 0.1, 0.05, { transparent: true, opacity: 0.35, depthWrite: false }),
    panel: std(0xeceeef, 0, 0.6),
    panelDark: std(0x3b3e42, 0.2, 0.6),
    oil: std(0x7a5a22, 0.1, 0.2),
    basket: std(0x9ea3a8, 0.7, 0.4, { wireframe: true }),
    concrete: std(0xbab7b1, 0, 0.9),
  };
  // Named after their id so tests and debugging can tell the parts apart.
  for (const [id, m] of Object.entries(mat)) m.name = id;
  shared = { box, cylinder, mat, highlighted: new Map() };
  return shared;
}

/** Holds the shared geometry and materials for a renderer that draws item models. */
export function retainShared(): void {
  holders++;
}

/** Gives the shared parts back; the last holder disposes them (they are rebuilt on next use). */
export function releaseShared(): void {
  holders = Math.max(0, holders - 1);
  if (holders === 0) disposeShared();
}

/** Disposes the shared geometry and materials now, whoever holds them. */
export function disposeShared(): void {
  if (!shared) return;
  shared.box.dispose();
  shared.cylinder.dispose();
  for (const m of Object.values(shared.mat)) m.dispose();
  for (const m of shared.highlighted.values()) m.dispose();
  shared = null;
}

// ---------------------------------------------------------------------------------------------
// Part helpers, all in the item's own frame (metres)

class Parts {
  readonly s = getShared();
  constructor(readonly g: THREE.Group) {}

  /** An axis-aligned box from its extents. */
  box(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.Mesh {
    const m = new THREE.Mesh(this.s.box, this.s.mat[mat]);
    m.scale.set(Math.max(x1 - x0, MIN_PART), Math.max(y1 - y0, MIN_PART), Math.max(z1 - z0, MIN_PART));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.g.add(m);
    return m;
  }

  /** A standing cylinder from its centre on the plan, its height range and radius. */
  cyl(mat: MaterialId, cx: number, cz: number, y0: number, y1: number, r: number): THREE.Mesh {
    const m = new THREE.Mesh(this.s.cylinder, this.s.mat[mat]);
    m.scale.set(2 * r, Math.max(y1 - y0, MIN_PART), 2 * r);
    m.position.set(cx, (y0 + y1) / 2, cz);
    this.g.add(m);
    return m;
  }

  /**
   * An open tub: floor and four walls, its rim at `y1`. Used for sink bowls, basins and pans so
   * they look recessed instead of painted on.
   */
  tub(mat: MaterialId, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, wall = SHEET): void {
    this.box(mat, x0, x1, y0, y0 + wall, z0, z1);
    this.box(mat, x0, x1, y0, y1, z0, z0 + wall);
    this.box(mat, x0, x1, y0, y1, z1 - wall, z1);
    this.box(mat, x0, x0 + wall, y0, y1, z0, z1);
    this.box(mat, x1 - wall, x1, y0, y1, z0, z1);
  }

  /**
   * A worktop with rectangular holes cut out (bowls, basins): the top is split into strips
   * around the holes so the holes stay open from above.
   */
  topWithHoles(mat: MaterialId, w: number, d: number, y0: number, y1: number, holes: readonly Hole[]): void {
    const hz0 = Math.min(...holes.map((h) => h.z0));
    const hz1 = Math.max(...holes.map((h) => h.z1));
    this.box(mat, -w / 2, w / 2, y0, y1, -d / 2, hz0);
    this.box(mat, -w / 2, w / 2, y0, y1, hz1, d / 2);
    const sorted = [...holes].sort((a, b) => a.x0 - b.x0);
    let x = -w / 2;
    for (const h of sorted) {
      if (h.x0 > x) this.box(mat, x, h.x0, y0, y1, hz0, hz1);
      x = h.x1;
    }
    if (x < w / 2) this.box(mat, x, w / 2, y0, y1, hz0, hz1);
  }
}

interface Hole {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

// Typical construction sizes of stainless equipment (m).
/** Smallest extent of a part, so a resized tiny item never gets a zero scale. */
const MIN_PART = 0.001;
/** Sheet metal thickness as drawn (thicker than real so it is visible). */
const SHEET = 0.01;
/** Worktop thickness. */
const TOP = 0.04;
/** Square table leg. */
const LEG = 0.04;
/** Height of the lower shelf of an open table above the floor. */
const UNDERSHELF = 0.18;
/** Plinth height of cabinets and fridges. */
const PLINTH = 0.1;
/** Gap between a door and the next one or the body edge. */
const GAP = 0.004;
/** Depth of a door panel standing proud of the body. */
const DOOR = 0.02;
/** Handle bar size; handles end flush with the item's front. */
const HANDLE = 0.02;
/** Height of the control strip on the front of cooking appliances. */
const CONTROLS = 0.12;
/** Thickness of a cooking top (dark plate on the body). */
const COOKTOP = 0.05;
/** Height a tap rises above a sink's worktop. */
export const TAP_RISE = 0.3;

// ---------------------------------------------------------------------------------------------
// Builders per kind. Each gets the size in metres and fills the group; the body always spans
// the full width and depth from 0 to h so the model matches the plan footprint.

interface Size {
  w: number;
  d: number;
  h: number;
}

type Builder = (p: Parts, s: Size, item: Item) => void;

/** A stainless body with a worktop: the base of most counters. */
function body(p: Parts, { w, d, h }: Size, topMat: MaterialId = "steel", topThickness = TOP, holes: readonly Hole[] = []): void {
  p.box("steelDark", -w / 2 + LEG, w / 2 - LEG, 0, PLINTH, -d / 2 + LEG, d / 2 - LEG);
  p.box("steel", -w / 2, w / 2, PLINTH, h - topThickness, -d / 2, d / 2 - DOOR);
  if (holes.length > 0) p.topWithHoles(topMat, w, d, h - topThickness, h, holes);
  else p.box(topMat, -w / 2, w / 2, h - topThickness, h, -d / 2, d / 2);
}

/** Door panels side by side over a width range, each with a vertical or horizontal handle. */
function doors(p: Parts, x0: number, x1: number, y0: number, y1: number, d: number, count: number, handle: "vertical" | "top"): void {
  const zf = d / 2;
  const dw = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const a = x0 + i * dw + GAP;
    const b = x0 + (i + 1) * dw - GAP;
    p.box("steel", a, b, y0 + GAP, y1 - GAP, zf - DOOR, zf - DOOR / 2);
    if (handle === "vertical") {
      // Handles sit at the meeting edges of a pair of doors; a single door has it on the right.
      const atLeft = count > 1 && i % 2 === 1;
      const hx = atLeft ? a + HANDLE : b - HANDLE * 2;
      const len = Math.min(0.4, (y1 - y0) * 0.5);
      const mid = (y0 + y1) / 2;
      p.box("handle", hx, hx + HANDLE, mid - len / 2, mid + len / 2, zf - HANDLE, zf);
    } else {
      const len = Math.min(0.3, (b - a) * 0.6);
      const cx = (a + b) / 2;
      p.box("handle", cx - len / 2, cx + len / 2, y1 - 0.06, y1 - 0.06 + HANDLE, zf - HANDLE, zf);
    }
  }
}

/** Four legs and a lower shelf: the frame of open tables and sinks. */
function openFrame(p: Parts, { w, d }: Size, topY: number): void {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (w / 2 - LEG / 2 - SHEET);
      const z = sz * (d / 2 - LEG / 2 - SHEET);
      p.box("steelDark", x - LEG / 2, x + LEG / 2, 0, topY, z - LEG / 2, z + LEG / 2);
    }
  }
  p.box("steel", -w / 2 + SHEET, w / 2 - SHEET, UNDERSHELF, UNDERSHELF + SHEET * 2, -d / 2 + SHEET, d / 2 - SHEET);
}

const worktable: Builder = (p, s) => {
  openFrame(p, s, s.h - TOP);
  p.box("steel", -s.w / 2, s.w / 2, s.h - TOP, s.h, -s.d / 2, s.d / 2);
};

const cabinet: Builder = (p, s) => {
  body(p, s);
  doors(p, -s.w / 2, s.w / 2, PLINTH, s.h - TOP, s.d, Math.max(1, Math.round(s.w / DOOR_WIDTH)), "vertical");
};
/** Usual width of one cabinet door. */
const DOOR_WIDTH = 0.6;

const drawers: Builder = (p, s) => {
  body(p, s);
  doors(p, -s.w / 2, s.w / 2, PLINTH, s.h - TOP, s.d, 1, "top");
  // Drawer fronts stacked instead of one door: replace the door split with horizontal bands.
  const bands = DRAWER_COUNT;
  const bh = (s.h - TOP - PLINTH) / bands;
  for (let i = 1; i < bands; i++) {
    const y = PLINTH + i * bh;
    p.box("steelDark", -s.w / 2 + GAP, s.w / 2 - GAP, y - GAP / 2, y + GAP / 2, s.d / 2 - DOOR, s.d / 2 - HANDLE);
    const len = Math.min(0.3, s.w * 0.5);
    p.box("handle", -len / 2, len / 2, y - 0.06, y - 0.06 + HANDLE, s.d / 2 - HANDLE, s.d / 2);
  }
};
const DRAWER_COUNT = 4;

/** Bowl size of a sink (m), shrunk to fit small tables. */
const BOWL = { w: 0.5, d: 0.4, depth: 0.25, margin: 0.06 };

function tap(p: Parts, x: number, zBack: number, y0: number, rise: number): void {
  const r = 0.015;
  const z = zBack + 0.05;
  p.cyl("handle", x, z, y0, y0 + rise, r);
  // The spout reaches forward from the top of the column.
  p.box("handle", x - r, x + r, y0 + rise - 2 * r, y0 + rise, z, z + Math.min(0.2, rise * 0.7));
}

const sink: Builder = (p, s, item) => {
  const count = sinkBowlCount(item.width);
  const bw = Math.min(BOWL.w, (s.w - BOWL.margin * (count + 1)) / count);
  const bd = Math.min(BOWL.d, s.d - 2 * BOWL.margin - UPSTAND);
  const zc = UPSTAND / 2;
  // Bowls sit at the right end, the drainer on the left.
  const holes: Hole[] = [];
  for (let i = 0; i < count; i++) {
    const x1 = s.w / 2 - BOWL.margin - i * (bw + BOWL.margin);
    holes.push({ x0: x1 - bw, x1, z0: zc - bd / 2, z1: zc + bd / 2 });
  }
  openFrame(p, s, s.h - TOP - BOWL.depth);
  p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, holes);
  for (const h of holes) p.tub("steel", h.x0, h.x1, s.h - BOWL.depth, s.h, h.z0, h.z1);
  // Upstand along the back wall.
  p.box("steel", -s.w / 2, s.w / 2, s.h, s.h + UPSTAND_HEIGHT, -s.d / 2, -s.d / 2 + SHEET * 2);
  for (const h of holes) tap(p, (h.x0 + h.x1) / 2, -s.d / 2, s.h, TAP_RISE);
};
/** Rear upstand of a sink table: depth taken from the top and height above it. */
const UPSTAND = 0.05;
const UPSTAND_HEIGHT = 0.04;

const handwash: Builder = (p, s) => {
  // A wall basin: a block whose upper part is the bowl, the tap on the back rim.
  const rim = 0.03;
  const bowlTop = s.h * 0.7;
  p.box("steel", -s.w / 2, s.w / 2, 0, bowlTop * 0.4, -s.d / 2, s.d / 2);
  p.tub("steel", -s.w / 2, s.w / 2, bowlTop * 0.4, bowlTop, -s.d / 2, s.d / 2, rim);
  p.box("steel", -s.w / 2, s.w / 2, bowlTop, s.h, -s.d / 2, -s.d / 2 + rim * 2);
  tap(p, 0, -s.d / 2, bowlTop, s.h - bowlTop);
};

/** Cooking body: steel cabinet with a control strip on top of the front and a dark top. */
function cookingBody(p: Parts, s: Size, topMat: MaterialId, ovenDoor: boolean, holes: readonly Hole[] = []): void {
  body(p, s, topMat, COOKTOP, holes);
  const yc = s.h - COOKTOP - CONTROLS;
  p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, yc, s.h - COOKTOP - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
  if (ovenDoor) doors(p, -s.w / 2, s.w / 2, PLINTH, yc, s.d, 1, "top");
}

/** Positions of cooking zones in a grid of rows and columns over the top (centres, radius). */
function zones(s: Size, cols: number, rows: number): { x: number; z: number; r: number }[] {
  const cw = s.w / cols;
  const rd = (s.d - CONTROLS) / rows;
  const r = Math.min(cw, rd) * ZONE_FILL;
  const out = [];
  for (let c = 0; c < cols; c++) {
    for (let k = 0; k < rows; k++) out.push({ x: -s.w / 2 + cw * (c + 0.5), z: -s.d / 2 + rd * (k + 0.5), r });
  }
  return out;
}
/** Share of a zone's cell that its radius takes. */
const ZONE_FILL = 0.32;
/** Width taken by one column of cooking zones (two zones front to back). */
const ZONE_COLUMN_WIDTH = 0.4;

const range: Builder = (p, s) => {
  cookingBody(p, s, "top", true);
  const cols = Math.max(1, Math.round(s.w / ZONE_COLUMN_WIDTH));
  // Hotplates are recessed into the top so the model stays within the item height.
  for (const z of zones(s, cols, 2)) p.cyl("plate", z.x, z.z, s.h - COOKTOP, s.h, z.r);
};

const induction: Builder = (p, s) => {
  cookingBody(p, s, "ceramic", true);
  const cols = Math.max(1, Math.round(s.w / ZONE_COLUMN_WIDTH));
  const mark = 0.002;
  for (const z of zones(s, cols, 2)) p.cyl("zone", z.x, z.z, s.h - mark, s.h, z.r);
};

const fryer: Builder = (p, s) => {
  // Two oil basins with a basket each, side by side, open in the top.
  const count = s.w >= FRYER_TWIN_WIDTH ? 2 : 1;
  const m = 0.04;
  const bw = (s.w - m * (count + 1)) / count;
  const z0 = -s.d / 2 + m;
  const z1 = s.d / 2 - CONTROLS - m;
  const depth = 0.25;
  const holes = Array.from({ length: count }, (_, i) => {
    const x0 = -s.w / 2 + m + i * (bw + m);
    return { x0, x1: x0 + bw, z0, z1 };
  });
  cookingBody(p, s, "steel", true, holes);
  for (const { x0 } of holes) {
    p.box("oil", x0, x0 + bw, s.h - depth, s.h - 0.08, z0, z1);
    p.tub("steelDark", x0, x0 + bw, s.h - depth, s.h, z0, z1, SHEET / 2);
    const inset = 0.02;
    p.box("basket", x0 + inset, x0 + bw - inset, s.h - 0.15, s.h - 0.03, z0 + inset, z1 - inset);
    // Basket handle reaching to the front edge of the basin.
    const cx = x0 + bw / 2;
    p.box("handle", cx - 0.01, cx + 0.01, s.h - 0.03, s.h, z1 - inset, z1);
  }
};
/** From this width a fryer has two basins (m). */
const FRYER_TWIN_WIDTH = 0.38;

const griddle: Builder = (p, s) => {
  const plateTop = s.h - 0.08;
  body(p, { ...s, h: plateTop }, "plate", 0.03);
  const yc = plateTop - 0.03 - CONTROLS;
  p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, yc, plateTop - 0.03 - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
  doors(p, -s.w / 2, s.w / 2, PLINTH, yc, s.d, Math.max(1, Math.round(s.w / DOOR_WIDTH)), "vertical");
  // Splash guard at the back and sides.
  p.box("steel", -s.w / 2, s.w / 2, plateTop, s.h, -s.d / 2, -s.d / 2 + SHEET);
  p.box("steel", -s.w / 2, -s.w / 2 + SHEET, plateTop, s.h, -s.d / 2, 0);
  p.box("steel", s.w / 2 - SHEET, s.w / 2, plateTop, s.h, -s.d / 2, 0);
  // Grease gutter at the front of the plate.
  p.box("steelDark", -s.w / 2 + 0.05, s.w / 2 - 0.05, plateTop - 0.01, plateTop + 0.002, s.d / 2 - 0.08, s.d / 2 - 0.05);
};

const kettle: Builder = (p, s) => {
  // Round vessel in front of a control column, on a plinth.
  const column = Math.min(0.25, s.d * 0.3);
  p.box("steelDark", -s.w / 2, s.w / 2, 0, PLINTH, -s.d / 2, s.d / 2);
  p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, -s.d / 2 + column);
  p.box("panelDark", -s.w / 3, s.w / 3, s.h - CONTROLS, s.h - GAP, -s.d / 2 + column, -s.d / 2 + column + GAP);
  const r = Math.min(s.w, s.d - column) / 2 - 0.02;
  const cz = -s.d / 2 + column + (s.d - column) / 2;
  p.cyl("steel", 0, cz, PLINTH, s.h - 0.03, r);
  p.cyl("steelDark", 0, cz, s.h - 0.03, s.h, r);
  // Lid handle across the front.
  p.box("handle", -r * 0.4, r * 0.4, s.h - 0.03, s.h, cz + r * 0.7, cz + r * 0.7 + HANDLE);
};

const tiltingPan: Builder = (p, s) => {
  // Two pedestals carry the pan between them on its tilting axis.
  const ped = Math.min(0.2, s.w * 0.15);
  const panTop = s.h;
  const panBottom = s.h - 0.3;
  p.box("steel", -s.w / 2, -s.w / 2 + ped, 0, s.h, -s.d / 2, s.d / 2);
  p.box("steel", s.w / 2 - ped, s.w / 2, 0, s.h, -s.d / 2, s.d / 2);
  p.box("panelDark", s.w / 2 - ped + GAP, s.w / 2 - GAP, s.h - CONTROLS * 2, s.h - CONTROLS, s.d / 2 - GAP, s.d / 2);
  const x0 = -s.w / 2 + ped + GAP * 2;
  const x1 = s.w / 2 - ped - GAP * 2;
  p.tub("steel", x0, x1, panBottom, panTop - 0.02, -s.d / 2, s.d / 2 - 0.05);
  // The lid lies closed on the pan, its handle bar along the front.
  p.box("steel", x0, x1, panTop - 0.02, panTop, -s.d / 2, s.d / 2 - 0.05);
  p.box("handle", x0 + 0.1, x1 - 0.1, panTop - 0.06, panTop - 0.06 + HANDLE, s.d / 2 - HANDLE, s.d / 2);
};

const combiOven: Builder = (p, s, item) => {
  const elev = item.elevation / MM_PER_UNIT;
  // A combi oven on a stand: the stand reaches from the floor up to the oven (negative local y).
  if (elev > 0) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (s.w / 2 - LEG);
        const z = sz * (s.d / 2 - LEG);
        p.box("steelDark", x - LEG / 2, x + LEG / 2, -elev, 0, z - LEG / 2, z + LEG / 2);
      }
    }
    // Tray runners of the stand.
    p.box("steel", -s.w / 2 + LEG / 2, s.w / 2 - LEG / 2, -elev + UNDERSHELF, -elev + UNDERSHELF + SHEET, -s.d / 2 + LEG / 2, s.d / 2 - LEG / 2);
  }
  p.box("steel", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, s.d / 2 - DOOR);
  // The control panel takes the right quarter, the glass door the rest.
  const panelW = Math.min(0.22, s.w * 0.25);
  const doorX1 = s.w / 2 - panelW;
  const m = 0.03;
  p.box("panelDark", doorX1 + GAP, s.w / 2 - GAP, m, s.h - m, s.d / 2 - DOOR, s.d / 2 - HANDLE);
  p.box("steel", -s.w / 2 + GAP, doorX1 - GAP, m, s.h - m, s.d / 2 - DOOR, s.d / 2 - DOOR / 2);
  p.box("ceramic", -s.w / 2 + m * 2, doorX1 - m * 2, m * 3, s.h - m * 3, s.d / 2 - DOOR / 2, s.d / 2 - DOOR / 2 + GAP);
  p.box("glass", -s.w / 2 + m * 2, doorX1 - m * 2, m * 3, s.h - m * 3, s.d / 2 - DOOR / 2 + GAP, s.d / 2 - HANDLE);
  const len = Math.min(0.5, s.h * 0.4);
  p.box("handle", doorX1 - m * 1.5, doorX1 - m * 1.5 + HANDLE, s.h / 2 - len / 2, s.h / 2 + len / 2, s.d / 2 - HANDLE, s.d / 2);
};

const fridge: Builder = (p, s) => {
  p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, 0, PLINTH, -s.d / 2, s.d / 2 - DOOR);
  p.box("steel", -s.w / 2, s.w / 2, PLINTH, s.h, -s.d / 2, s.d / 2 - DOOR);
  doors(p, -s.w / 2, s.w / 2, PLINTH, s.h - CONTROLS, s.d, 1, "vertical");
  p.box("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, s.h - CONTROLS + GAP, s.h - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
};

const counterFridge: Builder = (p, s) => {
  body(p, s);
  // Machine compartment with a louvre on the left, then the doors.
  const machine = Math.min(COUNTER_MACHINE, s.w * 0.3);
  const doorsCount = Math.max(1, Math.round((s.w - machine) / COUNTER_DOOR));
  p.box("panelDark", -s.w / 2 + GAP, -s.w / 2 + machine - GAP, PLINTH + GAP, s.h - TOP - GAP, s.d / 2 - DOOR, s.d / 2 - HANDLE);
  doors(p, -s.w / 2 + machine, s.w / 2, PLINTH, s.h - TOP, s.d, doorsCount, "top");
};
/** Width of a counter fridge's machine compartment and of one door (m). */
const COUNTER_MACHINE = 0.4;
const COUNTER_DOOR = 0.46;

const dishwasher: Builder = (p, s) => {
  // Base with the wash tank, the hood above, and the column at the back that carries the hood.
  const tankTop = Math.min(DISH_TANK_TOP, s.h * 0.6);
  const column = Math.min(0.15, s.d * 0.2);
  body(p, { ...s, h: tankTop });
  doors(p, -s.w / 2, s.w / 2, PLINTH, tankTop - TOP, s.d, 1, "top");
  p.box("steel", -s.w / 2, s.w / 2, tankTop, s.h, -s.d / 2, -s.d / 2 + column);
  p.box("panelDark", -s.w / 4, s.w / 4, s.h - CONTROLS, s.h - GAP, -s.d / 2 + column, -s.d / 2 + column + GAP);
  const hoodTop = s.h - CONTROLS - GAP;
  const hoodBottom = tankTop + GAP * 2;
  p.box("steel", -s.w / 2 + GAP, s.w / 2 - GAP, hoodBottom, hoodTop, -s.d / 2 + column, s.d / 2 - HANDLE);
  p.box("handle", -s.w / 3, s.w / 3, hoodBottom + 0.05, hoodBottom + 0.05 + HANDLE, s.d / 2 - HANDLE, s.d / 2);
};
/** Height of the wash tank (working height of the dish line, m). */
const DISH_TANK_TOP = 0.85;

const hood: Builder = (p, s) => {
  // An open canopy: top and four skirts, grease filters inside along the back.
  const skirt = Math.min(0.25, s.h * 0.6);
  p.box("steel", -s.w / 2, s.w / 2, s.h - SHEET, s.h, -s.d / 2, s.d / 2);
  p.box("steel", -s.w / 2, s.w / 2, s.h - skirt, s.h, s.d / 2 - SHEET, s.d / 2);
  p.box("steel", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, -s.d / 2 + SHEET);
  p.box("steel", -s.w / 2, -s.w / 2 + SHEET, s.h - skirt, s.h, -s.d / 2, s.d / 2);
  p.box("steel", s.w / 2 - SHEET, s.w / 2, s.h - skirt, s.h, -s.d / 2, s.d / 2);
  // The lower edge is a gutter all around.
  p.box("steelDark", -s.w / 2, s.w / 2, s.h - skirt, s.h - skirt + SHEET * 2, s.d / 2 - SHEET * 4, s.d / 2);
  const filters = Math.max(1, Math.round(s.w / HOOD_FILTER));
  const fw = (s.w - SHEET * 2) / filters;
  for (let i = 0; i < filters; i++) {
    const x0 = -s.w / 2 + SHEET + i * fw;
    p.box("panelDark", x0 + GAP, x0 + fw - GAP, s.h - skirt, s.h - SHEET, -s.d / 2 + SHEET, -s.d / 2 + SHEET + 0.05);
  }
};
/** Width of one grease filter cassette (m). */
const HOOD_FILTER = 0.5;

const wallShelf: Builder = (p, s) => {
  const board = 0.03;
  p.box("steel", -s.w / 2, s.w / 2, 0, board, -s.d / 2, s.d / 2);
  // Brackets at both ends, fixed to the wall at the back.
  const bracket = 0.01;
  for (const x of [-s.w / 2 + 0.05, s.w / 2 - 0.05 - bracket]) {
    p.box("steelDark", x, x + bracket, board, s.h, -s.d / 2, -s.d / 2 + 0.04);
    p.box("steelDark", x, x + bracket, board, board + 0.04, -s.d / 2, s.d / 2 - 0.02);
  }
};

const shelving: Builder = (p, s) => {
  const post = 0.03;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (s.w / 2 - post / 2);
      const z = sz * (s.d / 2 - post / 2);
      p.box("steelDark", x - post / 2, x + post / 2, 0, s.h, z - post / 2, z + post / 2);
    }
  }
  const board = 0.02;
  const lowest = 0.15;
  for (let i = 0; i < SHELF_LEVELS; i++) {
    const y = lowest + ((s.h - board - lowest) * i) / (SHELF_LEVELS - 1);
    p.box("steel", -s.w / 2 + post, s.w / 2 - post, y, y + board, -s.d / 2, s.d / 2);
  }
};
/** Boards of a shelving unit (the catalog's "4 Böden"). */
const SHELF_LEVELS = 4;

const coldRoom: Builder = (p, s) => {
  const wall = Math.min(COLD_ROOM_PANEL, s.w / 4, s.d / 4);
  p.box("panel", -s.w / 2, s.w / 2, s.h - wall, s.h, -s.d / 2, s.d / 2);
  p.box("panel", -s.w / 2, s.w / 2, 0, s.h - wall, -s.d / 2, -s.d / 2 + wall);
  p.box("panel", -s.w / 2, -s.w / 2 + wall, 0, s.h - wall, -s.d / 2, s.d / 2);
  p.box("panel", s.w / 2 - wall, s.w / 2, 0, s.h - wall, -s.d / 2, s.d / 2);
  const front = s.d / 2 - DOOR;
  p.box("panel", -s.w / 2, s.w / 2, 0, s.h - wall, front - wall, front);
  // The door, offset to one side, with a lever handle.
  const dw = Math.min(COLD_ROOM_DOOR.w, s.w - wall * 2);
  const dh = Math.min(COLD_ROOM_DOOR.h, s.h - wall * 2);
  // Near the left corner when it fits beside the side wall, else centred.
  const left = -s.w / 2 + wall + COLD_ROOM_DOOR.side;
  const x0 = left + dw <= s.w / 2 - wall ? left : -dw / 2;
  p.box("panel", x0, x0 + dw, 0, dh, front, s.d / 2 - HANDLE);
  p.box("steelDark", x0 - GAP, x0 + dw + GAP, dh, dh + GAP * 4, front, s.d / 2 - HANDLE);
  p.box("handle", x0 + dw - 0.12, x0 + dw - 0.04, dh * 0.5, dh * 0.5 + HANDLE * 2, s.d / 2 - HANDLE, s.d / 2);
};
/** Insulated panel thickness and door clear size of a cold room (m). */
const COLD_ROOM_PANEL = 0.1;
const COLD_ROOM_DOOR = { w: 0.8, h: 1.9, side: 0.1 };

const column: Builder = (p, s) => {
  p.box("concrete", -s.w / 2, s.w / 2, 0, s.h, -s.d / 2, s.d / 2);
};

const BUILDERS: Record<ItemKind, Builder> = {
  worktable,
  cabinet,
  drawers,
  sink,
  handwash,
  range,
  induction,
  fryer,
  griddle,
  kettle,
  tiltingPan,
  combiOven,
  fridge,
  counterFridge,
  dishwasher,
  hood,
  wallShelf,
  shelving,
  coldRoom,
  column,
};

/** Materials that should not darken what is behind them in shadows. */
const NO_SHADOW = new Set<MaterialId>(["glass", "basket"]);

/**
 * The 3D model of an item, placed and turned in the room. Every mesh carries
 * `userData.itemId` for picking. The group's own geometry and materials are shared; removing
 * it from the scene needs no disposal.
 */
export function buildItemObject(item: Item): THREE.Group {
  const g = new THREE.Group();
  g.name = item.name;
  g.userData.itemId = item.id;
  const s: Size = {
    w: Math.max(item.width, 1) / MM_PER_UNIT,
    d: Math.max(item.depth, 1) / MM_PER_UNIT,
    h: Math.max(item.height, 1) / MM_PER_UNIT,
  };
  const parts = new Parts(g);
  BUILDERS[kindOf(item.catalogId)](parts, s, item);

  const noShadow = new Set([...NO_SHADOW].map((id) => parts.s.mat[id]));
  g.traverse((o) => {
    o.userData.itemId = item.id;
    if (o instanceof THREE.Mesh) {
      o.castShadow = !noShadow.has(o.material as THREE.Material);
      o.receiveShadow = true;
    }
  });

  // Plan (x, y) -> three (x, z); a clockwise turn on the plan (y down) is a negative turn about
  // three's y axis (seen from above, with z pointing towards the viewer's bottom).
  g.position.set(item.x / MM_PER_UNIT, item.elevation / MM_PER_UNIT, item.y / MM_PER_UNIT);
  g.rotation.y = -rad(item.rotation);
  g.updateMatrixWorld(true);
  return g;
}

/** Shows an item model as selected (a neutral tint) or plain. */
export function setItemHighlight(g: THREE.Object3D, on: boolean): void {
  const s = getShared();
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const base = (o.userData.baseMaterial as THREE.Material | undefined) ?? (o.material as THREE.Material);
    o.userData.baseMaterial = base;
    if (!on) {
      o.material = base;
      return;
    }
    let lit = s.highlighted.get(base);
    if (!lit) {
      lit = base.clone();
      if (lit instanceof THREE.MeshStandardMaterial) lit.emissive.setHex(HIGHLIGHT_EMISSIVE);
      s.highlighted.set(base, lit);
    }
    o.material = lit;
  });
}

/** The item id of a picked object, walking up to the item's group. */
export function itemIdOf(o: THREE.Object3D | null): string | null {
  for (let cur = o; cur; cur = cur.parent) {
    const id = cur.userData.itemId;
    if (typeof id === "string") return id;
  }
  return null;
}
