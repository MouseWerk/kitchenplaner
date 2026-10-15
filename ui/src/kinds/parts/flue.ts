// The flue outlet (Abgasstutzen) of gas appliances: the slotted outlet at the back of the top
// through which the burners' exhaust leaves. Every gas variant gets it from the registry
// (`withGasFlue`), so a gas unit always looks different from its electric twin in 3D and in the
// plan; a kind that draws its own outlet sets `flue: false`.

import type { KindDef } from "../types";
import type { Front } from "./elevation";
import type { Parts, Size } from "./mesh";
import type { PlanSketch } from "./plan";

// Sizes (m), within the item's box at the back of its top.
/** Widest outlet; narrower units get a share of their width. */
const FLUE_WIDTH = 0.3;
const FLUE_WIDTH_SHARE = 0.6;
/** Depth of the outlet from front to back, and its distance from the back face. */
const FLUE_DEPTH = 0.03;
const FLUE_BACK = 0.005;
/** Height of the outlet down from the top. */
const FLUE_HEIGHT = 0.03;
/** How far the collar round the slots stays under the top. */
const COLLAR_DROP = 0.002;
/** Edge radius of the collar (m). */
const COLLAR_RADIUS = 0.003;
/** Width and pitch of the slots. */
const SLOT = 0.008;
const SLOT_PITCH = 0.016;

/** Where an outlet lies in the item frame (m). */
export interface FlueBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

/** The outlet's extent in the item frame (m): x centred, z from the back, y down from the top. */
export function flueBox(s: Size): FlueBox {
  const half = Math.min(FLUE_WIDTH, s.w * FLUE_WIDTH_SHARE) / 2;
  const z0 = -s.d / 2 + Math.min(FLUE_BACK, s.d / 4);
  const z1 = Math.min(z0 + FLUE_DEPTH, 0);
  return { x0: -half, x1: half, z0, z1, y0: Math.max(0, s.h - FLUE_HEIGHT), y1: s.h };
}

/**
 * The outlet in 3D, its parts named "flue": dark slots across it in a steel collar, at the back
 * of the top (`flueBox`) or, for a kind that draws its own outlet (`flue: false`), in the box
 * `b`. The collar stops just under the top, so where the outlet is set into a worktop only the
 * slots show, and where the top lies lower (a gas range's burner tray) the outlet stands as a
 * steel block with dark slots.
 */
export function flueMesh(p: Parts, s: Size, b: FlueBox = flueBox(s)): void {
  p.roundedBox("steel", b.x0, b.x1, b.y0, b.y1 - COLLAR_DROP, b.z0, b.z1, COLLAR_RADIUS, "top").name = "flue";
  const n = Math.max(1, Math.floor((b.x1 - b.x0) / SLOT_PITCH));
  const pitch = (b.x1 - b.x0) / n;
  for (let i = 0; i < n; i++) {
    const x = b.x0 + pitch * (i + 0.5);
    p.box("slot", x - SLOT / 2, x + SLOT / 2, b.y0, b.y1, b.z0, b.z1).name = "flue";
  }
}

/** The outlet in the plan: a crossed rectangle at the back, the usual mark of a flue. */
export function fluePlan(s: PlanSketch): void {
  const b = flueBox({ w: s.w / 1000, d: s.d / 1000, h: s.item.height / 1000 });
  const [x0, x1, y0, y1] = [b.x0, b.x1, b.z0, b.z1].map((v) => v * 1000);
  s.rect("detail", x0, y0, x1, y1);
  s.line("detail", [x0, y0], [x1, y1]);
  s.line("detail", [x1, y0], [x0, y1]);
}

/** The outlet in the front elevation: behind the front, so drawn hidden at the top. */
export function flueFront(f: Front): void {
  const b = flueBox({ w: f.w / 1000, d: f.item.depth / 1000, h: f.item.height / 1000 });
  const c = (f.l + f.r) / 2;
  f.box("hidden", c + b.x0 * 1000, c + b.x1 * 1000, f.z0 + b.y0 * 1000, f.z0 + b.y1 * 1000);
}

/**
 * The kind with the flue outlet added to its gas variants in the plan, the front elevation and
 * 3D; a kind with `flue: false` is returned as it is.
 */
export function withGasFlue(def: KindDef): KindDef {
  if (def.flue === false) return def;
  return {
    ...def,
    plan(s) {
      def.plan(s);
      if (s.item.energy === "gas") fluePlan(s);
    },
    elevation(f) {
      def.elevation(f);
      if (f.item.energy === "gas") flueFront(f);
    },
    mesh(p, s, item) {
      def.mesh(p, s, item);
      if (item.energy === "gas") flueMesh(p, s);
    },
  };
}
