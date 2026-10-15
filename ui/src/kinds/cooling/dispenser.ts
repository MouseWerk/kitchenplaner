// Dispensers fed from the water mains: the ice and water dispenser (Eiswürfelspender) of hotel
// floors and self-service, a tall housing with the ice maker and its bin inside and a lit niche
// with push pads and a drip grate, on a cabinet stand; and the drinking water cooler
// (Trinkwasserspender), a slim housing with a niche for a glass, two push buttons and a drip tray.

import { foot, roundedRectOutline, TOP_RADIUS, type MaterialId, type Parts, type Point2 } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CABINET_RADIUS, coolDoor, display, displayFront, doorFront, FRONT, grille, grilleFront, LEAF_GAP_MM, m, pushButton } from "./common";

/** Edge radius of a pressed dispenser housing (m). */
const HOUSING_R = 0.01;
/** Niche of the ice dispenser: bottom and top above the floor, inset from the sides (mm). */
const ICE_NICHE = { y0: 1000, y1: 1300, side: 90 };
/** Height of the ice dispenser's stand (mm, a cabinet with a door). */
const STAND_MM = 750;
/** Niche of the water cooler: bottom and top above the floor (mm), inset from the sides. */
const WATER_NICHE = { y0: 800, y1: 1000, side: 60 };
/** Depth of the niches (m). */
const ICE_DEPTH = 0.2;
const WATER_DEPTH = 0.12;

type Kind = "ice" | "water";

const niche = (kind: Kind) => (kind === "ice" ? ICE_NICHE : WATER_NICHE);

/**
 * The front of a housing from `zb` to `zf` (m) over x0..x1 and y0..y1, with the niche cut into it
 * (nx0..nx1, ny0..ny1, round corners): the slab with its hole, the niche's dark back, the lit
 * roof, the drip tray with its grate at the bottom and the outlets in the roof.
 */
function nicheFront(p: Parts, mat: MaterialId, x0: number, x1: number, y0: number, y1: number, zb: number, zf: number, nx0: number, nx1: number, ny0: number, ny1: number, outlets: number): void {
  const out: Point2[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  p.extrude(mat, "z", zb, zf, out, [roundedRectOutline(nx0, nx1, ny0, ny1, NICHE_R)]);
  p.plate("panelDark", nx0, nx1, ny0, ny1, zb - 0.002, zb + 0.001, NICHE_R);
  // Drip tray: a shallow steel pan with a grate of bars over it.
  p.pan("steel", nx0 + 0.006, nx1 - 0.006, ny0, ny0 + 0.025, zb + 0.004, zf - 0.002, { wall: 0.003, r: 0.012 });
  p.grid(nx0 + 0.012, nx1 - 0.012, ny0 + 0.017, ny0 + 0.023, zb + 0.01, zf - 0.008, 0.012, "z");
  p.plate("panel", nx0 + 0.02, nx1 - 0.02, ny1 - 0.004, ny1 + 0.0005, zb + 0.01, zf - 0.01, 0.004);
  for (let i = 0; i < outlets; i++) {
    const x = nx0 + ((nx1 - nx0) * (i + 0.5)) / outlets;
    p.lathe("satin", x, ny1 - 0.034, (zb + zf) / 2 - 0.01, [
      [0, 0],
      [0.008, 0],
      [0.008, 0.012],
      [0.016, 0.026],
      [0.016, 0.03],
      [0, 0.03],
    ]);
  }
}

/** Corner radius of a niche (m). */
const NICHE_R = 0.03;

function dispenser(kind: string, what: Kind): KindDef {
  return {
    kind,
    plan(s) {
      const n = niche(what);
      s.line("detail", [s.L + n.side, s.F - INSET], [s.R - n.side, s.F - INSET]);
      if (what === "ice") s.line("detail", [s.L, s.F - INSET / 2], [s.R, s.F - INSET / 2]);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const n = niche(what);
      f.box("detail", l + n.side, r - n.side, z0 + n.y0, z0 + Math.min(n.y1, f.item.height - 150), "item-dark");
      if (what === "ice") {
        f.line("detail", [l, z0 + STAND_MM], [r, z0 + STAND_MM]);
        doorFront(f, l + LEAF_GAP_MM, r - LEAF_GAP_MM, z0 + 100, z0 + STAND_MM - LEAF_GAP_MM, true);
        grilleFront(f, l + 60, r - 60, top - 220, top - 80);
        displayFront(f, (l + r) / 2, z0 + n.y1 + 80);
      } else {
        grilleFront(f, l + 40, r - 40, z0 + 80, z0 + 220);
      }
    },
    mesh(p, s) {
      const n = niche(what);
      const zBody = s.d / 2 - (what === "ice" ? FRONT : 0.006);
      const top = Math.min(m(n.y1), s.h - 0.15);
      if (what === "ice") {
        // The stand: a cabinet with a door on feet, the dispenser on it.
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (s.w / 2 - 0.04), sz * (s.d / 2 - 0.08), 0.1);
        p.roundedBox("steelDark", -s.w / 2 + 0.03, s.w / 2 - 0.03, 0.012, 0.1, -s.d / 2 + 0.03, zBody - 0.04, 0.002, "vertical");
        p.roundedBox("steel", -s.w / 2, s.w / 2, 0.1, m(STAND_MM), -s.d / 2, zBody, CABINET_RADIUS, "vertical");
        coolDoor(p, { x0: -s.w / 2, x1: s.w / 2, y0: 0.1, y1: m(STAND_MM), zBody, zFront: s.d / 2, hinge: "left", handle: "top" });
        // The housing: its back part, and the front with the niche, the display over the niche,
        // the grille on top and the push pads in the niche's back.
        const zb = s.d / 2 - ICE_DEPTH;
        p.roundedBox("steel", -s.w / 2, s.w / 2, m(STAND_MM), s.h, -s.d / 2, zb + 0.002, HOUSING_R);
        nicheFront(p, "steel", -s.w / 2, s.w / 2, m(STAND_MM) + 0.004, s.h, zb, s.d / 2 - 0.006, -s.w / 2 + m(n.side), s.w / 2 - m(n.side), m(n.y0), top, 2);
        display(p, -0.04, top + 0.08, s.d / 2 - 0.006);
        grille(p, -s.w / 2 + 0.06, s.w / 2 - 0.06, s.h - 0.22, s.h - 0.08, s.d / 2 - 0.006, s.d / 2);
        for (const x of [-s.w / 2 + m(n.side) + 0.06, s.w / 2 - m(n.side) - 0.06]) pushButton(p, x, m(n.y0) + 0.12, zb + 0.001, 0.022, "handle");
      } else {
        // The slim housing on hidden feet, the niche with two buttons over it, a grille low down.
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) foot(p, sx * (s.w / 2 - 0.04), sz * (s.d / 2 - 0.04), 0.02, 0.015);
        const zb = zBody - WATER_DEPTH;
        p.roundedBox("panel", -s.w / 2, s.w / 2, 0.02, s.h - 0.03, -s.d / 2, zb + 0.002, HOUSING_R * 2, "vertical");
        nicheFront(p, "panel", -s.w / 2 + 0.002, s.w / 2 - 0.002, 0.02, s.h - 0.03, zb, zBody, -s.w / 2 + m(n.side), s.w / 2 - m(n.side), m(n.y0), top, 1);
        p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - 0.03, s.h, -s.d / 2, zBody, TOP_RADIUS);
        for (const dx of [-0.04, 0.04]) pushButton(p, dx, top + 0.05, zBody, 0.012, "handle");
        grille(p, -s.w / 2 + 0.04, s.w / 2 - 0.04, 0.08, 0.22, zBody - 0.003, s.d / 2);
      }
    },
  };
}

export const iceDispenser = dispenser("iceDispenser", "ice");
export const waterCooler = dispenser("waterCooler", "water");
