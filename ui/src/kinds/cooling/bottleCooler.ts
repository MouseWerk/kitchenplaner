// Beverage coolers (Getränkekühlschrank) with glass doors: bottles on wire shelves behind the
// panes, a lit sign panel on top and the machine behind a grille in the base. The bottle cooler
// has one hinged door per 600 mm; the wide one has sliding doors in two planes that overlap in
// the middle, so it opens without a swing in front of a counter.

import { BODY_RADIUS, type MaterialId, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bottle, CABINET_RADIUS, cabinetShell, coolDoor, doorFront, doorSwings, FRONT, GLASS_FRAME_MM, grille, grilleFront, hingeLeft, LEAF_GAP_MM, m, STANDOFF, wireShelves } from "./common";

/** Height of the grille base and of the lit head (mm). */
const BASE_MM = 120;
const HEAD_MM = 160;
/** Width of one hinged door (mm); sliding doors are two up to this width, else three (mm). */
const DOOR_MM = 600;
const TWO_SLIDING_UP_TO = 1600;
/** How far two sliding doors overlap, and the depth between their planes (m). */
const OVERLAP = 0.05;
const TRACK = 0.025;
/** Shelves behind each door, and the bottles standing in the front row of a shelf (fewer per door on a wide cooler, for the budget). */
const SHELVES = 4;
const BOTTLE = { r: 0.03, pitch: 0.1, max: 4, maxWide: 3 };
/** Bottles in turn: dark glass, amber glass and green glass. */
const BOTTLE_MATS: readonly MaterialId[] = ["glassDark", "oil", "foodGreen"];

/** Number of doors of a cooler of the given width (mm). */
const doorsOf = (width: number, sliding: boolean) => (sliding ? (width <= TWO_SLIDING_UP_TO ? 2 : 3) : Math.max(1, Math.round(width / DOOR_MM)));

/**
 * The cabinet behind the doors: base with the grille, the lit head, the shell, mullions between
 * hinged doors, wire shelves and rows of bottles. Returns the front of the body (m).
 */
function cabinet(p: Parts, s: Size, n: number, sliding: boolean): { zBody: number; y0: number; y1: number } {
  const zBody = s.d / 2 - FRONT - (sliding ? TRACK : 0);
  const zLeaf = s.d / 2 - STANDOFF;
  const y0 = m(BASE_MM);
  const y1 = s.h - m(HEAD_MM);
  // The base with the grille, down to the floor.
  p.roundedBox("steelDark", -s.w / 2, s.w / 2, 0, y0, -s.d / 2, zLeaf - 0.004, CABINET_RADIUS, "vertical");
  grille(p, -s.w / 2 + 0.02, s.w / 2 - 0.02, 0.022, y0 - 0.01, zLeaf - 0.004, zLeaf + 0.004);
  // The head with the lit sign panel in the door plane.
  p.roundedBox("steelDark", -s.w / 2, s.w / 2, y1, s.h, -s.d / 2, zLeaf - 0.004, CABINET_RADIUS, "vertical");
  p.plate("panel", -s.w / 2 + 0.02, s.w / 2 - 0.02, y1 + 0.02, s.h - 0.02, zLeaf - 0.004, zLeaf, 0.01, true);
  const inner = cabinetShell(p, s, y0, y1, zBody, "steelDark");
  const dw = s.w / n;
  if (!sliding) for (let i = 1; i < n; i++) p.roundedBox("steelDark", -s.w / 2 + i * dw - 0.02, -s.w / 2 + i * dw + 0.02, inner.y0, inner.y1, inner.z0, zBody - 0.001, BODY_RADIUS, "vertical");
  // A front row of bottles on every shelf, and on the floor of a single-door cooler (a wide
  // cooler keeps within the budget with fewer).
  const shelves = [...(n > 1 ? [] : [inner.y0]), ...wireShelves(p, inner, SHELVES)];
  for (const [k, y] of shelves.entries()) {
    const above = k + 1 < shelves.length ? shelves[k + 1] : inner.y1;
    const h = Math.min(0.27, above - y - 0.04);
    for (let i = 0; i < n; i++) {
      const a = -s.w / 2 + i * dw + 0.05;
      const b = -s.w / 2 + (i + 1) * dw - 0.05;
      const count = Math.min(n > 1 ? BOTTLE.maxWide : BOTTLE.max, Math.floor((b - a) / BOTTLE.pitch));
      const x0 = (a + b) / 2 - ((count - 1) * BOTTLE.pitch) / 2;
      for (let j = 0; j < count; j++) bottle(p, x0 + j * BOTTLE.pitch, y + 0.001, zBody - 0.09, h, BOTTLE.r, BOTTLE_MATS[(k + j) % BOTTLE_MATS.length]);
    }
  }
  return { zBody, y0, y1 };
}

function glassCooler(kind: string, sliding: boolean): KindDef {
  return {
    kind,
    plan(s) {
      const n = doorsOf(s.w, sliding);
      if (!sliding) {
        doorSwings(s, n);
        return;
      }
      // Sliding doors: the leaves in their two tracks, overlapping at the joints.
      const dw = s.w / n;
      const lap = OVERLAP * 500;
      for (let i = 0; i < n; i++) {
        const y = s.F - (i % 2 === 0 ? INSET : INSET / 2);
        s.line("detail", [Math.max(s.L, s.L + i * dw - lap), y], [Math.min(s.R, s.L + (i + 1) * dw + lap), y]);
      }
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      grilleFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + LEAF_GAP_MM, z0 + BASE_MM - LEAF_GAP_MM);
      f.box("detail", l + LEAF_GAP_MM, r - LEAF_GAP_MM, top - HEAD_MM + LEAF_GAP_MM, top - LEAF_GAP_MM);
      const n = doorsOf(f.w, sliding);
      const dw = f.w / n;
      const y0 = z0 + BASE_MM;
      const y1 = top - HEAD_MM;
      const lap = sliding ? OVERLAP * 500 : 0;
      for (let i = 0; i < n; i++) {
        const a = Math.max(l, l + i * dw + LEAF_GAP_MM / 2 - lap);
        const b = Math.min(r, l + (i + 1) * dw - LEAF_GAP_MM / 2 + lap);
        doorFront(f, a, b, y0, y1, sliding ? i % 2 === 0 : hingeLeft(i, n), true);
        for (let k = 1; k <= SHELVES; k++) {
          const z = y0 + GLASS_FRAME_MM + ((y1 - y0 - 2 * GLASS_FRAME_MM) * k) / (SHELVES + 1);
          f.line("detail", [a + GLASS_FRAME_MM, z], [b - GLASS_FRAME_MM, z]);
        }
      }
    },
    mesh(p, s) {
      const n = doorsOf(s.w * 1000, sliding);
      const { zBody, y0, y1 } = cabinet(p, s, n, sliding);
      const dw = s.w / n;
      for (let i = 0; i < n; i++) {
        const lap = sliding ? OVERLAP / 2 : 0;
        const x0 = Math.max(-s.w / 2, -s.w / 2 + i * dw - lap);
        const x1 = Math.min(s.w / 2, -s.w / 2 + (i + 1) * dw + lap);
        // Sliding leaves alternate between the rear and the front track; their grips face the joint.
        const back = sliding && i % 2 === 0;
        const zb = back ? zBody : zBody + TRACK;
        const zf = back ? s.d / 2 - TRACK : s.d / 2;
        const hinge = sliding ? (i % 2 === 0 ? "left" : "right") : hingeLeft(i, n) ? "left" : "right";
        coolDoor(p, { x0, x1, y0, y1, zBody: zb, zFront: zf, hinge, handle: "vertical", glass: true, frame: "steelDark", hinges: !sliding });
      }
      if (sliding) {
        // The track over the leaves, a dark profile under the head.
        p.box("steelDark", -s.w / 2 + 0.002, s.w / 2 - 0.002, y1 - 0.006, y1, zBody, s.d / 2 - 0.004);
      }
    },
  };
}

export const bottleCooler = glassCooler("bottleCooler", false);
export const slidingDoorCooler = glassCooler("slidingDoorCooler", true);
