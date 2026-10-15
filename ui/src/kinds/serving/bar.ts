// The bar: the bar counter module with its wooden bar top and foot rail on the guest side (the
// back), the draught column with its taps and the flow cooler under the counter, the glass
// froster, the bottle cooler with glass doors, the ice well with its speed rail, the cocktail
// station, the back bar with mirror and bottle shelves, and the juice dispenser.

import { doorCount, FEET, INSET as FRONT_INSET, TOP as FRONT_TOP } from "../parts/elevation";
import { frostFront, frostMark } from "../parts/frost";
import { BODY_RADIUS, BOWL_RADIUS, DOOR, DOOR_RADIUS, GAP, PLINTH, plinth, SHEET, tap, TOP, type Hole, type MaterialId, type Parts } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bottleRow, counterBody, drinkDispenser, dripTray, foodMound, GLASS, leafDoors, pilotLamp, seam, tumbler } from "./common";
import { ventSlots } from "../parts/details";

/** Bottle materials of a bar, in turn: green glass, amber, dark, clear. */
const BOTTLES: readonly MaterialId[] = ["foodGreen", "oil", "glassDark", "glass", "oil"];

// ---------------------------------------------------------------------------------------------
// Bar counter

/** Height of the staff side's work top (mm) and depth of the bar top on the guest side (mm). */
const WORK_TOP = 900;
const BAR_TOP = 350;
/** Thickness of the bar top (m) and of the guest side's cladding (m); the foot rail (m). */
const BAR_TOP_T = 0.045;
const CLADDING = 0.03;
const RAIL_R = 0.025;
const FOOT_RAIL_Y = 0.22;
/** How far the cladding stands back from the bar top's edge (m), leaving room for the rail. */
const SETBACK = 0.08;

export const barCounter: KindDef = {
  kind: "barCounter",
  plan(s) {
    s.line("detail", [s.L, s.B + BAR_TOP], [s.R, s.B + BAR_TOP]);
    s.line("hidden", [s.L, s.B + SETBACK * 1000], [s.R, s.B + SETBACK * 1000]);
    s.line("detail", [s.L, s.B + RAIL_R * 1000], [s.R, s.B + RAIL_R * 1000]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const wt = z0 + WORK_TOP;
    f.box("detail", l, r, wt - FRONT_TOP, wt);
    f.box("detail", l, r, top - BAR_TOP_T * 1000, top);
    // Open shelves under the work top with glass racks.
    f.line("detail", [l + FRONT_INSET, (z0 + FEET + wt) / 2], [r - FRONT_INSET, (z0 + FEET + wt) / 2]);
    f.line("detail", [l, z0 + FEET], [r, z0 + FEET]);
  },
  elevationSide(f) {
    const { l, r, z0, top } = f;
    f.line("detail", [l, top - BAR_TOP_T * 1000], [r, top - BAR_TOP_T * 1000]);
    f.line("detail", [l, z0 + WORK_TOP], [r, z0 + WORK_TOP]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const wt = WORK_TOP / 1000;
    const zb = -d / 2;
    const zc = zb + SETBACK;
    // Guest side: the wooden cladding with its panel joints on a dark plinth, the foot rail on
    // its brackets and the wooden bar top over it.
    p.roundedBox("steelDark", -w / 2, w / 2, 0, PLINTH, zc + 0.01, zc + CLADDING + 0.02, 0.003, "vertical");
    p.roundedBox("wood", -w / 2, w / 2, PLINTH, h - BAR_TOP_T, zc, zc + CLADDING, 0.004, "all", "x");
    const n = Math.max(1, Math.round(w / 0.5));
    for (let i = 1; i < n; i++) seam(p, "y", PLINTH + 0.01, h - BAR_TOP_T - 0.01, -w / 2 + (w * i) / n, zc, -1);
    p.roundedBox("wood", -w / 2, w / 2, h - BAR_TOP_T, h, zb, zb + BAR_TOP / 1000, 0.01, "all", "x");
    p.rod("handle", "x", 0, FOOT_RAIL_Y, zb + RAIL_R, w, RAIL_R);
    for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
      p.tube(
        "handle",
        [
          { x, y: FOOT_RAIL_Y, z: zb + RAIL_R },
          { x, y: FOOT_RAIL_Y, z: zc },
        ],
        0.01,
      );
    }
    // Staff side: the steel work top on a frame, open shelves below with glass racks on them,
    // and the plinth.
    const z1 = d / 2;
    plinthBetween(p, w, zc + CLADDING, z1);
    p.roundedBox("steel", -w / 2, w / 2, wt - TOP, wt, zc + CLADDING, z1, 0.003);
    for (const x of [-w / 2, w / 2 - SHEET]) p.roundedBox("steel", x, x + SHEET, PLINTH, wt - TOP, zc + CLADDING, z1, 0.002);
    const ym = (PLINTH + wt - TOP) / 2;
    for (const y of [PLINTH, ym]) p.roundedBox("steel", -w / 2 + SHEET, w / 2 - SHEET, y, y + SHEET, zc + CLADDING, z1 - 0.01, 0.003);
    // Glass racks with glasses upside down on the middle shelf, bottle crates on the bottom one.
    const rw = Math.min(0.5, w / 2 - 0.05);
    const rz0 = zc + CLADDING + 0.02;
    const rz1 = Math.min(rz0 + rw, z1 - 0.02);
    for (const cx of w > 1.2 ? [-w / 4, w / 4] : [0]) {
      p.wireBox(cx - rw / 2, cx + rw / 2, ym + SHEET, ym + SHEET + 0.08, rz0, rz1, 0.08);
      for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) tumbler(p, cx - rw / 2 + rw * ((i + 0.5) / 4), ym + SHEET + 0.006, rz0 + (rz1 - rz0) * ((k + 0.5) / 3), 0.03, 0.09);
      p.roundedBox("panelDark", cx - rw / 2, cx + rw / 2, PLINTH + SHEET, PLINTH + SHEET + 0.25, rz0, rz1, 0.01, "vertical");
      p.plate("slot", cx - rw / 2 + 0.03, cx + rw / 2 - 0.03, PLINTH + SHEET + 0.2, PLINTH + SHEET + 0.22, rz1 - 0.0005, rz1 + 0.0005, 0.01);
    }
    // The back of the bar top's support, a dark band under it on the staff side.
    p.box("steelDark", -w / 2, w / 2, wt, h - BAR_TOP_T, zc + CLADDING, zc + CLADDING + 0.01);
  },
};

/** A plinth (kick plate and feet) under the staff side of a counter from z0 to z1 (m). */
function plinthBetween(p: Parts, w: number, z0: number, z1: number): void {
  const m = p.g.children.length;
  plinth(p, w, z1 - z0);
  for (const part of p.g.children.slice(m)) part.position.z += (z0 + z1) / 2;
}

// ---------------------------------------------------------------------------------------------
// Draught column

/** Taps on a column of the given width (mm): one per 150 mm or so, one to four. */
export function tapCount(width: number): number {
  return Math.max(1, Math.min(4, Math.round(width / 150)));
}

export const draughtColumn: KindDef = {
  kind: "draughtColumn",
  placement: "tableTop",
  plan(s) {
    s.rect("detail", s.L + INSET / 4, s.B + INSET / 4, s.R - INSET / 4, s.F - INSET / 4);
    s.circle("detail", 0, -s.d / 6, 40);
    const n = tapCount(s.w);
    for (let i = 0; i < n; i++) s.circle("detail", s.L + (s.w / n) * (i + 0.5), s.d / 6, 15);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const cx = (l + r) / 2;
    f.box("detail", l, r, z0, z0 + 25);
    f.box("detail", cx - 40, cx + 40, z0 + 25, top - 160);
    f.box("detail", l + 20, r - 20, top - 160, top - 100);
    const n = tapCount(f.item.width);
    for (let i = 0; i < n; i++) {
      const x = l + ((r - l) / n) * (i + 0.5);
      f.box("detail", x - 10, x + 10, top - 100, top);
      f.line("detail", [x, top - 160], [x, top - 200]);
    }
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    // The drip tray with its grid over the whole foot.
    dripTray(p, -w / 2, w / 2, 0, 0.025, -d / 2, d / 2);
    // The column: a chrome tower with a frosted cooling sleeve, the bar of taps on top.
    const zc = -d / 6;
    const yb = h - 0.16;
    p.lathe("chrome", 0, 0.025, zc, [
      [0, 0],
      [0.05, 0],
      [0.05, 0.01],
      [0.035, 0.03],
      [0.035, yb - 0.025],
      [0, yb - 0.025],
    ]);
    p.lathe("panel", 0, 0.08, zc, [
      [0.036, 0],
      [0.04, 0.004],
      [0.04, yb - 0.12],
      [0.036, yb - 0.116],
      [0, yb - 0.116],
      [0, 0],
    ]);
    p.roundedBox("chrome", -w / 2 + 0.02, w / 2 - 0.02, yb, yb + 0.06, zc - 0.035, zc + 0.035, 0.03, "all", "x");
    const n = tapCount(item.width);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      // The tap: a spout out of the bar's front, bending down, its black handle up on top.
      p.tube(
        "chrome",
        [
          { x, y: yb + 0.03, z: zc + 0.03 },
          { x, y: yb + 0.03, z: d / 6 },
          { x, y: yb - 0.04, z: d / 6 },
        ],
        0.012,
        { bend: 0.02 },
      );
      p.lathe("knob", x, yb + 0.05, d / 6 - 0.02, [
        [0, 0],
        [0.012, 0],
        [0.01, 0.03],
        [0.016, h - yb - 0.06],
        [0.012, h - yb - 0.05],
        [0, h - yb - 0.05],
      ]);
    }
    // A glass under the first tap.
    tumbler(p, -w / 2 + w / n / 2, 0.025, d / 6, 0.035, 0.14, true);
  },
};

// ---------------------------------------------------------------------------------------------
// Flow cooler

export const beerCooler: KindDef = {
  kind: "beerCooler",
  plan(s) {
    s.rect("detail", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
    for (const x of [-60, 0, 60]) s.circle("detail", x, s.B + 100, 12);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, z0 + 60, z0 + 260, "item-dark");
    f.circle("detail", r - FRONT_INSET * 2, top - 60, 15);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    // A painted housing on feet with its louvre and switch at the front, the beer lines and the
    // water bath's lid on top.
    for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) for (const z of [-d / 2 + 0.04, d / 2 - 0.06]) p.lathe("rubber", x, 0, z, [[0, 0], [0.02, 0], [0.02, 0.02], [0, 0.02]]);
    p.roundedBox("paintGray", -w / 2, w / 2, 0.02, h - 0.02, -d / 2, d / 2 - 0.02, 0.012);
    p.plate("panelDark", -w / 2 + 0.04, w / 2 - 0.04, 0.06, 0.26, d / 2 - 0.02, d / 2 - 0.018, 0.008);
    ventSlots(p, -w / 2 + 0.06, w / 2 - 0.06, 0.08, 0.24, d / 2 - 0.018, 6);
    p.knob(w / 2 - 0.08, h - 0.08, d / 2 - 0.02, d / 2, 0.018);
    pilotLamp(p, w / 2 - 0.14, h - 0.08, d / 2 - 0.02, "foodGreen");
    p.roundedBox("steel", -w / 2 + 0.03, w / 2 - 0.03, h - 0.025, h - 0.015, -d / 2 + 0.03, d / 2 - 0.05, 0.004);
    for (const x of [-0.06, 0, 0.06]) {
      p.lathe("satin", x, h - 0.02, -d / 2 + 0.1, [[0, 0], [0.014, 0], [0.014, 0.012], [0.009, 0.016], [0, 0.016]]);
      p.tube("glass", [{ x, y: h - 0.004, z: -d / 2 + 0.1 }, { x, y: h, z: -d / 2 + 0.1 }], 0.007, { caps: false });
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Glass froster

export const glassFroster: KindDef = {
  kind: "glassFroster",
  plan(s) {
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, s.F - INSET * 2);
    s.line("detail", [0, s.B + INSET], [0, s.F - INSET * 2]);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    f.worktop();
    f.box("detail", l + FRONT_INSET, r - FRONT_INSET, z0 + FEET, top - FRONT_TOP - FRONT_INSET);
    frostFront(f, l + FRONT_INSET, r - FRONT_INSET, top - FRONT_TOP - 120, top - FRONT_TOP - 70);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const zBody = d / 2 - DOOR;
    counterBody(p, s, [{ x0: -w / 2 + 0.05, x1: w / 2 - 0.05, z0: -d / 2 + 0.05, z1: d / 2 - 0.1, r: 0.02 }], "steel", zBody);
    // The frozen well: white frosted walls with rows of glasses upside down on its floor, under
    // two sliding glass lids in a frame.
    const x0 = -w / 2 + 0.05;
    const x1 = w / 2 - 0.05;
    const z0 = -d / 2 + 0.05;
    const z1 = d / 2 - 0.1;
    p.tub("panel", x0, x1, h - 0.3, h - 0.001, z0, z1, 0.006, 0.02);
    const nx = Math.max(1, Math.floor((x1 - x0) / 0.085));
    const nz = Math.max(1, Math.floor((z1 - z0) / 0.085));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) tumbler(p, x0 + ((x1 - x0) / nx) * (i + 0.5), h - 0.294, z0 + ((z1 - z0) / nz) * (k + 0.5), 0.035, 0.15);
    for (const [k, xa, xb] of [
      [0, x0, 0.02],
      [1, -0.02, x1],
    ] as const) {
      const y = h - 0.004 - k * 0.006;
      p.box("glass", xa, xb, y - GLASS / 2, y, z0, z1);
      const gx = k === 0 ? xb - 0.04 : xa + 0.04;
      p.roundedBox("knob", gx - 0.012, gx + 0.012, y, y + 0.004, (z0 + z1) / 2 - 0.05, (z0 + z1) / 2 + 0.05, 0.003, "vertical");
    }
    // The front: one panel with the frost label, the machine's louvre below it.
    p.roundedBox("steel", -w / 2 + GAP, w / 2 - GAP, PLINTH + GAP, h - TOP - GAP, zBody, d / 2 - DOOR / 2, DOOR_RADIUS, "top", "z");
    frostMark(p, -w / 2 + GAP, w / 2 - GAP, h - TOP - 0.12, h - TOP - 0.07, d / 2 - DOOR / 2);
    ventSlots(p, -w / 2 + 0.1, w / 2 - 0.1, PLINTH + 0.04, PLINTH + 0.2, d / 2 - DOOR / 2, 5);
    p.knob(w / 2 - 0.08, h - TOP - 0.22, d / 2 - DOOR / 2, d / 2, 0.018);
  },
};

// ---------------------------------------------------------------------------------------------
// Ice well and cocktail station

/** Depth of the speed rail in front of the counter body (m), its bottles' height, and how far
 * under the top its bottles end (m): the necks stand just under the top's front edge. */
const SPEED_RAIL = 0.1;
const RAIL_BOTTLE = 0.3;
const SPEED_RAIL_Y = TOP + RAIL_BOTTLE + 0.05;

/**
 * The speed rail under the front edge of a bar module: a bent tray along x0..x1 standing out of
 * the body at `zBody` to `zFront`, with a row of bottles in it.
 */
function speedRail(p: Parts, x0: number, x1: number, y: number, zBody: number, zFront: number): void {
  p.roundedBox("steel", x0, x1, y, y + 0.006, zBody, zFront, 0.003);
  p.roundedBox("steel", x0, x1, y, y + 0.08, zFront - 0.006, zFront, 0.003, "top");
  for (const x of [x0, x1 - 0.006]) p.roundedBox("steel", x, x + 0.006, y, y + 0.08, zBody, zFront, 0.002);
  bottleRow(p, x0 + 0.01, x1 - 0.01, y + 0.006, (zBody + zFront) / 2, Math.min(0.036, (zFront - zBody) / 2 - 0.008), RAIL_BOTTLE, BOTTLES);
}

/** An insulated ice well in a top: a deep tub with crushed ice heaped in it and its scoop. */
function iceWellIn(p: Parts, hole: Hole, top: number): void {
  p.tub("steel", hole.x0, hole.x1, top - 0.28, top - 0.001, hole.z0, hole.z1, SHEET / 2, hole.r ?? BOWL_RADIUS);
  foodMound(p, "panel", hole.x0 + 0.01, hole.x1 - 0.01, top - 0.27, top - 0.04, hole.z0 + 0.01, hole.z1 - 0.01);
  p.tube(
    "satin",
    [
      { x: hole.x1 - 0.06, y: top - 0.035, z: (hole.z0 + hole.z1) / 2 - 0.04 },
      { x: hole.x1 - 0.06, y: top - 0.035, z: hole.z1 - 0.01 },
      { x: hole.x1 - 0.06, y: top + 0.01, z: hole.z1 - 0.004 },
    ],
    0.008,
    { bend: 0.02 },
  );
}

/** The front of a bar module: the body set back for the speed rail, the rail and the doors. */
function barModuleFront(f: Parameters<KindDef["elevation"]>[0]): void {
  const { l, r, z0, top } = f;
  const yr = top - SPEED_RAIL_Y * 1000;
  f.worktop();
  f.box("detail", l + FRONT_INSET, r - FRONT_INSET, yr, yr + 80);
  f.doors(doorCount(f.w), z0 + FEET, yr - FRONT_INSET);
}

export const iceWell: KindDef = {
  kind: "iceWell",
  rise: 20,
  plan(s) {
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, s.F - SPEED_RAIL * 1000 - INSET);
    s.line("detail", [s.L + INSET, s.F - SPEED_RAIL * 1000], [s.R - INSET, s.F - SPEED_RAIL * 1000]);
  },
  elevation(f) {
    barModuleFront(f);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const zBody = d / 2 - SPEED_RAIL;
    const hole: Hole = { x0: -w / 2 + 0.05, x1: w / 2 - 0.05, z0: -d / 2 + 0.05, z1: zBody - 0.05, r: BOWL_RADIUS };
    behindRail(p, w, d, h, [hole]);
    iceWellIn(p, hole, h);
    // The speed rail across the front, the doors under it.
    speedRail(p, -w / 2 + 0.02, w / 2 - 0.02, h - SPEED_RAIL_Y, zBody, d / 2);
    leafDoors(p, -w / 2, w / 2, PLINTH, h - SPEED_RAIL_Y - 0.01, zBody - DOOR, zBody - DOOR / 2, zBody, doorCount(w * 1000));
  },
};

/**
 * The counter body of a bar module behind its speed rail: built for the depth less the rail
 * (with the holes in its top, given in the item's frame) and moved back against the wall.
 */
function behindRail(p: Parts, w: number, d: number, h: number, holes: readonly Hole[]): void {
  const m = p.g.children.length;
  const dd = d - SPEED_RAIL;
  const shift = SPEED_RAIL / 2;
  counterBody(p, { w, d: dd, h }, holes.map((hl) => ({ ...hl, z0: hl.z0 + shift, z1: hl.z1 + shift })), "steel", dd / 2 - DOOR);
  for (const part of p.g.children.slice(m)) part.position.z -= shift;
}

export const cocktailStation: KindDef = {
  kind: "cocktailStation",
  rise: 300,
  plan(s) {
    const zb = s.F - SPEED_RAIL * 1000;
    const third = (s.w - INSET * 2) / 3;
    s.rect("detail", s.L + INSET, s.B + INSET, s.L + INSET + third - INSET / 2, zb - INSET);
    s.circle("detail", s.L + INSET + third / 2, s.B + INSET * 2.5, 20);
    s.rect("detail", s.L + INSET + third, s.B + INSET, s.L + INSET + third * 2 - INSET / 2, zb - INSET);
    for (let k = 0; k < 3; k++) s.rect("detail", s.L + INSET + third * 2 + (third / 3) * k, s.B + INSET, s.L + INSET + third * 2 + (third / 3) * (k + 1) - INSET / 4, zb - INSET);
    s.line("detail", [s.L + INSET, zb], [s.R - INSET, zb]);
  },
  elevation(f) {
    barModuleFront(f);
    const x = f.l + FRONT_INSET + (f.w - FRONT_INSET * 2) / 6;
    f.line("detail", [x, f.top], [x, f.top + 300]);
  },
  mesh(p, s) {
    const { w, d, h } = s;
    const zBody = d / 2 - SPEED_RAIL;
    const third = (w - 0.1) / 3;
    const x0 = -w / 2 + 0.05;
    const zb0 = -d / 2 + 0.05;
    const zb1 = zBody - 0.05;
    const sink: Hole = { x0, x1: x0 + third - 0.025, z0: zb0 + 0.06, z1: zb1, r: BOWL_RADIUS };
    const ice: Hole = { x0: x0 + third, x1: x0 + third * 2 - 0.025, z0: zb0, z1: zb1, r: BOWL_RADIUS };
    const gn: Hole[] = [0, 1, 2].map((k) => ({ x0: x0 + third * 2 + (third / 3) * k, x1: x0 + third * 2 + (third / 3) * (k + 1) - 0.012, z0: zb0, z1: zb1, r: 0 }));
    behindRail(p, w, d, h, [sink, ice, ...gn]);
    // Sink with its tap, the ice well, and three garnish pans (GN 1/9) with fruit.
    p.tub("steel", sink.x0, sink.x1, h - 0.2, h - 0.001, sink.z0, sink.z1, SHEET / 2);
    p.roundedBox("water", sink.x0 + 0.01, sink.x1 - 0.01, h - 0.19, h - 0.12, sink.z0 + 0.01, sink.z1 - 0.01, BOWL_RADIUS - 0.01, "vertical");
    tap(p, (sink.x0 + sink.x1) / 2, -d / 2 + 0.005, h, 0.3);
    iceWellIn(p, ice, h);
    const fruit: MaterialId[] = ["foodGreen", "foodRed", "foodCream"];
    gn.forEach((g, k) => {
      p.pan("steel", g.x0, g.x1, h - 0.1, h + 0.002, g.z0, g.z1, { wall: 0.003, r: 0.01, rim: 0.006 });
      foodMound(p, fruit[k], g.x0 + 0.012, g.x1 - 0.012, h - 0.09, h - 0.02, g.z0 + 0.012, g.z1 - 0.012);
    });
    speedRail(p, -w / 2 + 0.02, w / 2 - 0.02, h - SPEED_RAIL_Y, zBody, d / 2);
    leafDoors(p, -w / 2, w / 2, PLINTH, h - SPEED_RAIL_Y - 0.01, zBody - DOOR, zBody - DOOR / 2, zBody, doorCount(w * 1000));
  },
};

// ---------------------------------------------------------------------------------------------
// Back bar

/** Height of the back bar's cupboard (mm) and of its cornice with the lights (m). */
const BACK_BAR_BASE = 900;
const CORNICE = 0.08;
/** Glass shelves over the cupboard. */
const BACK_SHELVES = 3;
/** Most bottles on a shelf of the back bar, for the budget (a wide one spaces them out). */
const BACK_BAR_BOTTLES = 15;

export const backBar: KindDef = {
  kind: "backBar",
  plan(s) {
    s.line("detail", [s.L, s.F - INSET], [s.R, s.F - INSET]);
    s.rect("hidden", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.B + INSET * 5);
  },
  elevation(f) {
    const { l, r, z0, top } = f;
    const ct = z0 + Math.min(BACK_BAR_BASE, f.item.height - 300);
    f.box("detail", l, r, ct - FRONT_TOP, ct);
    f.doors(doorCount(f.w), z0 + FEET, ct - FRONT_TOP - FRONT_INSET);
    f.box("detail", l + FRONT_INSET / 2, r - FRONT_INSET / 2, ct, top - CORNICE * 1000, "glass");
    for (let k = 1; k <= BACK_SHELVES; k++) {
      const z = ct + ((top - CORNICE * 1000 - ct) * k) / (BACK_SHELVES + 1);
      f.line("detail", [l + FRONT_INSET / 2, z], [r - FRONT_INSET / 2, z]);
    }
    f.line("detail", [l, top - CORNICE * 1000], [r, top - CORNICE * 1000]);
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    const ct = Math.min(BACK_BAR_BASE, item.height - 300) / 1000;
    const zBody = d / 2 - DOOR;
    // The cupboard: wooden doors in a steel body, a wooden top.
    plinth(p, w, d);
    p.roundedBox("steel", -w / 2, w / 2, PLINTH, ct - TOP, -d / 2, zBody, BODY_RADIUS, "vertical");
    p.box("top", -w / 2 + 0.002, w / 2 - 0.002, PLINTH + 0.002, ct - TOP, zBody, zBody + 0.002);
    const n = doorCount(w * 1000);
    const dw = w / n;
    for (let i = 0; i < n; i++) {
      const a = -w / 2 + dw * i + GAP;
      const b = a + dw - GAP * 2;
      p.roundedBox("wood", a, b, PLINTH + GAP, ct - TOP - GAP, zBody + 0.002, d / 2 - DOOR / 2, DOOR_RADIUS, "top", "z");
      const hx = i % 2 === 0 ? b - 0.04 : a + 0.04;
      p.barHandle("y", ct - TOP - 0.25, ct - TOP - 0.08, hx, d / 2 - DOOR / 2, d / 2);
    }
    p.roundedBox("wood", -w / 2, w / 2, ct - TOP, ct, -d / 2, d / 2, 0.006);
    // The upper part: wooden sides, a mirror at the back, glass shelves with bottles on them, and
    // the cornice with its downlights.
    const zt = -d / 2 + Math.min(0.3, d - 0.05);
    for (const x of [-w / 2, w / 2 - 0.025]) p.roundedBox("wood", x, x + 0.025, ct, h, -d / 2, zt, 0.004);
    p.box("wood", -w / 2 + 0.025, w / 2 - 0.025, ct, h - CORNICE, -d / 2, -d / 2 + 0.015);
    p.box("chrome", -w / 2 + 0.03, w / 2 - 0.03, ct + 0.02, h - CORNICE - 0.02, -d / 2 + 0.015, -d / 2 + 0.017);
    for (let k = 0; k <= BACK_SHELVES; k++) {
      const y = ct + ((h - CORNICE - ct) * k) / (BACK_SHELVES + 1);
      // The cupboard's top stays clear as the bar's work surface; the bottles stand on the shelves.
      if (k === 0) continue;
      p.roundedBox("glass", -w / 2 + 0.025, w / 2 - 0.025, y - GLASS, y, -d / 2 + 0.02, zt - 0.01, 0.002, "vertical");
      const space = (h - CORNICE - ct) / (BACK_SHELVES + 1) - 0.03;
      bottleRow(p, -w / 2 + 0.05, w / 2 - 0.05, y, -d / 2 + 0.11, 0.035, Math.min(0.32, space), k % 2 === 0 ? BOTTLES : ["oil", "glassDark", "glass"], BACK_BAR_BOTTLES);
    }
    p.roundedBox("wood", -w / 2, w / 2, h - CORNICE, h, -d / 2, zt + 0.02, 0.006, "all", "x");
    const nl = Math.max(2, Math.round(w / 0.5));
    for (let i = 0; i < nl; i++) {
      const x = -w / 2 + (w / nl) * (i + 0.5);
      p.lathe("panel", x, h - CORNICE - 0.002, (-d / 2 + zt) / 2, [[0, 0], [0.025, 0], [0.025, 0.003], [0, 0.003]]);
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Juice dispenser

/** Bowls of a juice dispenser of the given width (mm): one per 200 mm. */
export function juiceBowls(width: number): number {
  return Math.max(1, Math.min(3, Math.round(width / 210)));
}

export const juiceDispenser: KindDef = {
  kind: "juiceDispenser",
  placement: "tableTop",
  plan(s) {
    const n = juiceBowls(s.w);
    for (let i = 0; i < n; i++) {
      const x = s.L + (s.w / n) * (i + 0.5);
      s.rect("detail", x - s.w / n / 2 + INSET / 4, s.B + INSET / 4, x + s.w / n / 2 - INSET / 4, s.F - 100);
      s.rect("detail", x - s.w / n / 3, s.F - 100, x + s.w / n / 3, s.F - INSET / 4);
    }
  },
  elevation(f) {
    const { l, z0, top } = f;
    const n = juiceBowls(f.item.width);
    const bw = f.w / n;
    for (let i = 0; i < n; i++) {
      const a = l + bw * i;
      f.box("detail", a + 5, a + bw - 5, z0, z0 + f.item.height * 0.36, "item-dark");
      f.box("detail", a + bw * 0.04, a + bw * 0.96, z0 + f.item.height * 0.36, top - 30, "glass");
    }
  },
  mesh(p, s, item) {
    const { w, d, h } = s;
    const n = juiceBowls(item.width);
    const bw = w / n;
    const drinks: MaterialId[] = ["foodRed", "oil", "foodCream"];
    for (let i = 0; i < n; i++) drinkDispenser(p, -w / 2 + bw * (i + 0.5), 0, -d / 2, d / 2, bw, h, drinks[i % drinks.length]);
  },
};
