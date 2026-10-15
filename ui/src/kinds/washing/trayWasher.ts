// Tray washer (Tablettspülmaschine): trays stand upright in a slotted conveyor that carries them
// from the loading section at the left through the tunnel (pre-wash, wash, rinse and drying
// zone) to the right, where they leave dry. The tunnel is the housing of the conveyor
// dishwashers; the loading section shows the conveyor's comb and a few trays in it.

import { LEG as FRONT_LEG } from "../parts/elevation";
import { BODY_RADIUS, foot, LEG, LEG_RADIUS, SHEET, TOP_RADIUS, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CONVEYOR, flowArrow, tunnelFront, tunnelHousing, tunnelPlan } from "./common";

/** Loading section: share of the length and the most it takes (mm). */
const LOAD = { share: 0.25, max: 800 };
/** Shares of pre-wash, wash, rinse and drying zone in the tunnel. */
const ZONE_SHARES = [0.2, 0.3, 0.2, 0.3];
const PANEL_ZONE = 1;
const DRY_ZONE = 3;
/** A tray standing in the conveyor (m): length across the conveyor, height, thickness. */
const TRAY = { l: 0.53, h: 0.37, t: 0.02 };
/** Distance of the comb's slots (m) and of the trays shown in them. */
const SLOT_PITCH = 0.05;
const TRAY_PITCH = 0.15;
/** Height of the guard along the conveyor and the inset of the conveyor from the sides (m). */
const GUARD = 0.12;
const BELT_INSET = 0.1;

/** Loading section and tunnel along the width (mm, or m with `k` 1/1000). */
function sections(w: number, k = 1) {
  const load = Math.min(LOAD.max * k, w * LOAD.share);
  const x0 = -w / 2 + load;
  const zones = ZONE_SHARES.map((share) => (w / 2 - x0) * share);
  return { load: { x0: -w / 2, x1: x0 }, tunnel: { x0, x1: w / 2 }, zones };
}

/** The loading section in 3D: frame on legs, the comb conveyor, guards and trays standing in it. */
function loading(p: Parts, s: Size, x0: number, x1: number): void {
  const z0 = -s.d / 2 + BELT_INSET;
  const z1 = s.d / 2 - BELT_INSET;
  const frameTop = CONVEYOR - 0.03;
  for (const x of [x0 + 0.05, x1 - 0.05]) {
    for (const z of [z0 + LEG / 2, z1 - LEG / 2]) {
      p.roundedBox("steelDark", x - LEG / 2, x + LEG / 2, 0.08, frameTop - 0.14, z - LEG / 2, z + LEG / 2, LEG_RADIUS, "vertical");
      foot(p, x, z, 0.08, LEG * 0.55);
    }
  }
  p.roundedBox("steel", x0, x1, frameTop - 0.14, frameTop, z0, z1, BODY_RADIUS);
  // The comb: a dark belt with rubber fingers across it, one row per slot.
  p.box("plate", x0, x1, frameTop, CONVEYOR - 0.001, z0 + SHEET, z1 - SHEET);
  const n = Math.floor((x1 - x0) / SLOT_PITCH);
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    p.roundedBox("rubber", x - 0.004, x + 0.004, CONVEYOR - 0.002, CONVEYOR + 0.04, z0 + SHEET * 2, z1 - SHEET * 2, 0.003, "top");
  }
  // Guards along the front and the back with a rounded top edge.
  for (const [a, b] of [
    [-s.d / 2, z0 + SHEET],
    [z1 - SHEET, s.d / 2],
  ]) {
    p.roundedBox("steel", x0, x1, frameTop - 0.14, CONVEYOR + GUARD, a, b, TOP_RADIUS, "top");
  }
  // Trays standing in the comb.
  const l = Math.min(TRAY.l, z1 - z0 - SHEET * 4);
  for (let x = x0 + TRAY_PITCH; x < x1 - TRAY_PITCH / 2; x += TRAY_PITCH) {
    p.roundedBox("paintGray", x - TRAY.t / 2, x + TRAY.t / 2, CONVEYOR + 0.01, CONVEYOR + 0.01 + TRAY.h, -l / 2, l / 2, 0.02, "vertical", "x");
  }
}

export const trayWasher: KindDef = {
  kind: "trayWasher",
  plan(s) {
    const { load, tunnel, zones } = sections(s.w);
    tunnelPlan(s, tunnel.x0, zones);
    const b = BELT_INSET * 1000;
    s.rect("detail", load.x0 + INSET / 2, s.B + b, load.x1 - INSET / 2, s.F - b);
    for (let x = load.x0 + TRAY_PITCH * 1000; x < load.x1 - INSET; x += TRAY_PITCH * 1000) s.line("detail", [x, -TRAY.l * 500], [x, TRAY.l * 500]);
    flowArrow(s, tunnel.x0 + INSET * 4, tunnel.x1 - INSET * 4, s.d / 4, "right");
  },
  elevation(f) {
    const c = (f.l + f.r) / 2;
    const { load, tunnel, zones } = sections(f.w);
    tunnelFront(f, c + tunnel.x0, c + tunnel.x1, zones, PANEL_ZONE, DRY_ZONE);
    const belt = f.z0 + CONVEYOR * 1000;
    const a = c + load.x0;
    const b = c + load.x1;
    f.box("detail", a, b, belt - 170, belt + GUARD * 1000);
    for (const x of [a + 30, b - 30 - FRONT_LEG]) f.box("detail", x, x + FRONT_LEG, f.z0, belt - 170);
    for (let x = a + TRAY_PITCH * 1000; x < b - TRAY_PITCH * 500; x += TRAY_PITCH * 1000) f.box("detail", x - 10, x + 10, belt + GUARD * 1000, belt + (TRAY.h + 0.01) * 1000);
  },
  mesh(p, s) {
    const { load, tunnel, zones } = sections(s.w, 1 / 1000);
    loading(p, s, load.x0, load.x1);
    tunnelHousing(p, s, tunnel.x0, tunnel.x1, zones, PANEL_ZONE, DRY_ZONE);
  },
};
