// Mobile shelving (Fahrregalanlage): runs of shelving on carriages that roll on rails across the
// store, so only one aisle is needed. The back run stands against the wall, the two in front of
// it move; the aisle is open between them. Each moving run has a hand wheel on its end panel.

import type { Front } from "../parts/elevation";
import { BODY_RADIUS, type Parts } from "../parts/mesh";
import type { PlanSketch } from "../parts/plan";
import type { KindDef } from "../types";
import { LIP, roundPost, shelf } from "./helpers";

// Construction sizes (m).
/** Depth of one run of shelving. */
const RUN = 0.4;
/** Height of a carriage and of a floor rail. */
const CARRIAGE = 0.12;
const RAIL = 0.012;
/** Width of the end panel with the hand wheel, and the room the wheel takes beside it. */
const END = 0.02;
const WHEEL_ROOM = 0.06;
/** Radius of the hand wheel. */
const WHEEL_R = 0.14;
/** Shelves per run. */
const LEVELS = 5;
/** Room a post takes at each corner of a run. */
const POST = 0.03;

/** The runs' depth ranges from the back (m): back run, moving run, aisle, front run. */
function runs(d: number): [number, number][] {
  const run = Math.min(RUN, d / 4);
  const B = -d / 2;
  return [
    [B, B + run],
    [B + run + 0.005, B + 2 * run],
    [d / 2 - run, d / 2],
  ];
}

/** The rails across the depth (x of their centres, m). */
function rails(w: number): number[] {
  return [-w / 2 + 0.15, 0, w / 2 - WHEEL_ROOM - 0.15];
}

/** Heights of the shelves' lower edges (m). */
function levels(h: number): number[] {
  const low = CARRIAGE + 0.12;
  return Array.from({ length: LEVELS }, (_, i) => low + ((h - LIP - low) * i) / (LEVELS - 1));
}

/** A run of shelving on its carriage from x0 to x1 and z0 to z1, with the end panel at x1. */
function shelvingRun(p: Parts, x0: number, x1: number, z0: number, z1: number, h: number, wheel: boolean) {
  p.roundedBox("paintGray", x0, x1, RAIL, CARRIAGE, z0, z1, BODY_RADIUS);
  const xe = x1 - END;
  // The end panel closing the run, full height.
  p.roundedBox("paintGray", xe, x1, CARRIAGE, h, z0, z1, BODY_RADIUS * 2);
  for (const x of [x0 + POST / 2, xe - POST / 2]) for (const z of [z0 + POST / 2, z1 - POST / 2]) roundPost(p, "paintGray", x, z, h, undefined, CARRIAGE);
  for (const y of levels(h)) shelf(p, "solid", x0 + POST / 2, xe - 0.001, z0, z1, y, "paintGray");
  if (wheel) {
    // A three-spoke hand wheel on the end panel, turning about x.
    const zc = (z0 + z1) / 2;
    const yc = Math.min(1.1, h * 0.55);
    const r = Math.min(WHEEL_R, (z1 - z0) / 2 - 0.01);
    const xw = x1 + WHEEL_ROOM;
    p.lathe("satin", x1, yc, zc, [[0, 0], [0.03, 0], [0.03, 0.01], [0.02, WHEEL_ROOM - 0.02], [0, WHEEL_ROOM - 0.02]], { axis: "x" });
    const rim = p.ring("knob", 0, 0, 0, r - 0.012, 0.012);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(xw - 0.025, yc, zc);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
      p.tube("satin", [
        { x: xw - 0.035, y: yc, z: zc },
        { x: xw - 0.025, y: yc + Math.sin(a) * (r - 0.02), z: zc + Math.cos(a) * (r - 0.02) },
      ], 0.006);
    }
    // The crank grip on the rim.
    p.lathe("knob", xw - 0.025, yc + r - 0.012, zc, [[0, 0], [0.012, 0], [0.014, 0.012], [0.012, 0.025], [0, 0.025]], { axis: "x" });
  }
}

function planRun(s: PlanSketch, y0: number, y1: number) {
  const xe = s.R - WHEEL_ROOM * 1000;
  s.rect("detail", s.L, y0, xe, y1);
  s.line("detail", [s.L, y0], [xe - END * 1000, y1]);
  s.line("detail", [xe - END * 1000, y0], [xe - END * 1000, y1]);
}

function frontRuns(f: Front) {
  const { l, r, z0 } = f;
  const xe = r - WHEEL_ROOM * 1000;
  f.box("detail", l, xe, z0 + RAIL * 1000, z0 + CARRIAGE * 1000);
  f.box("detail", xe - END * 1000, xe, z0 + CARRIAGE * 1000, f.top);
  f.box("detail", l, l + POST * 1000, z0 + CARRIAGE * 1000, f.top);
  for (const y of levels(f.item.height / 1000)) f.line("detail", [l + POST * 1000, z0 + y * 1000], [xe - END * 1000, z0 + y * 1000]);
  // The hand wheel seen edge on beside the end panel.
  const yc = z0 + Math.min(1.1, (f.item.height / 1000) * 0.55) * 1000;
  f.box("detail", xe, r, yc - WHEEL_R * 1000, yc + WHEEL_R * 1000);
}

export const mobileShelving: KindDef = {
  kind: "mobileShelving",
  plan(s) {
    for (const [a, b] of runs(s.d / 1000)) planRun(s, a * 1000, b * 1000);
    for (const x of rails(s.w / 1000)) s.line("hidden", [x * 1000, s.B], [x * 1000, s.F]);
  },
  elevation: frontRuns,
  elevationSide(f) {
    // Seen from the side or the back: the carriages over the rail.
    f.line("detail", [f.l, f.z0 + RAIL * 1000], [f.r, f.z0 + RAIL * 1000]);
    f.line("detail", [f.l, f.z0 + CARRIAGE * 1000], [f.r, f.z0 + CARRIAGE * 1000]);
  },
  mesh(p, s) {
    for (const x of rails(s.w)) p.roundedBox("steelDark", x - 0.025, x + 0.025, 0, RAIL, -s.d / 2, s.d / 2, 0.002, "top");
    const x1 = s.w / 2 - WHEEL_ROOM;
    runs(s.d).forEach(([z0, z1], i) => shelvingRun(p, -s.w / 2, x1, z0, z1, s.h, i > 0));
  },
};
