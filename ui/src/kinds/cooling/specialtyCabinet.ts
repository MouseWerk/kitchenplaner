// Upright cabinets for one kind of food, behind a glass door so the stock shows: the fish
// refrigerator (Fischkühlschrank) keeps fish on crushed ice in perforated GN trays over drip
// trays, near 0 °C; the dry-aging cabinet (Fleischreifeschrank) hangs and lays beef in moving
// air in front of a wall of salt blocks, in a dark body.

import { PLINTH, SHEET, type MaterialId, type Parts } from "../parts/mesh";
import type { KindDef } from "../types";
import {
  BASE_MM,
  cabinetShell,
  coolDoor,
  doorFront,
  doorSwings,
  FASCIA,
  FASCIA_MM,
  fasciaFront,
  FRONT,
  GLASS_FRAME_MM,
  gnPan,
  GRIP_HEIGHT_MM,
  LEAF_GAP_MM,
  m,
  uprightCarcass,
  wireShelves,
} from "./common";

type Stock = "fish" | "aging";

/** Trays of a fish refrigerator, and their depth (a perforated GN 2/1 tray in a drip tray, m). */
const FISH_TRAYS = 4;
const TRAY_H = 0.065;
/** Fish on a tray: their length and largest radius (m), and how many lie side by side. */
const FISH = { l: 0.36, r: 0.035, n: 3 };
/** Salt blocks at the back of a dry-aging cabinet: their size (m). */
const SALT = { w: 0.2, h: 0.1 };
/** Meat hanging from the rail of a dry-aging cabinet: pieces, length and radius (m). */
const MEAT = { n: 2, l: 0.45, r: 0.07 };

/**
 * A fish lying along x from `x` to `x + l` at height `y` (its belly), its round body turned
 * round its length: head, body and a narrowed tail.
 */
function fish(p: Parts, x: number, y: number, z: number, l: number, r: number): void {
  p.lathe(
    "foodCream",
    x,
    y + r * 0.8,
    z,
    [
      [0, 0],
      [r * 0.6, l * 0.04],
      [r * 0.95, l * 0.2],
      [r, l * 0.38],
      [r * 0.7, l * 0.65],
      [r * 0.25, l * 0.85],
      [r * 0.55, l * 0.97],
      [r * 0.5, l],
      [0, l],
    ],
    { axis: "x", segments: 8 },
  );
}

/** The fish refrigerator's trays: drip trays with perforated trays of fish on crushed ice in them. */
function fishTrays(p: Parts, inner: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): void {
  const pitch = (inner.y1 - inner.y0) / FISH_TRAYS;
  for (let i = 0; i < FISH_TRAYS; i++) {
    const y = inner.y0 + pitch * i + 0.02;
    // Runners carry the tray; the tray holds crushed ice (white) with the fish laid on it.
    for (const x of [inner.x0, inner.x1 - 0.012]) p.box("satin", x, x + 0.012, y - 0.008, y, inner.z0, inner.z1 - 0.01);
    const x0 = inner.x0 + 0.014;
    const x1 = inner.x1 - 0.014;
    const z0 = inner.z0 + 0.02;
    const z1 = Math.min(inner.z1 - 0.02, z0 + 0.65);
    gnPan(p, x0, x1, y, y + TRAY_H, z0, z1, "panel", 0.02);
    const fl = Math.min(FISH.l, x1 - x0 - 0.06);
    for (let k = 0; k < FISH.n; k++) {
      const z = z0 + ((z1 - z0) * (k + 0.5)) / FISH.n;
      fish(p, (x0 + x1) / 2 - fl / 2 + (k % 2 ? 0.03 : -0.03), y + TRAY_H - 0.02, z, fl, FISH.r);
    }
  }
}

/** The dry-aging cabinet's inside: the salt wall, a rail with hanging pieces and a shelf with more. */
function agingInside(p: Parts, inner: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): void {
  // The salt wall: blocks in courses against the back, joints offset course by course.
  const zs = inner.z0 + 0.001;
  const cols = Math.max(1, Math.floor((inner.x1 - inner.x0) / SALT.w));
  const bw = (inner.x1 - inner.x0) / cols;
  const rows = Math.max(1, Math.floor((inner.y1 - inner.y0) / SALT.h));
  const bh = (inner.y1 - inner.y0) / rows;
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 ? bw / 2 : 0;
    for (let c = -1; c < cols; c++) {
      const a = Math.max(inner.x0, inner.x0 + c * bw + shift);
      const b = Math.min(inner.x1, inner.x0 + (c + 1) * bw + shift);
      if (b - a < 0.02) continue;
      p.roundedBox(SALT_MAT, a + 0.002, b - 0.002, inner.y0 + r * bh + 0.002, inner.y0 + (r + 1) * bh - 0.002, zs, zs + 0.03, 0.006, "top", "z");
    }
  }
  // The hanging rail with hooks, the pieces on them, and a wire shelf with a loin on it.
  const yr = inner.y1 - 0.08;
  const zc = (inner.z0 + 0.05 + inner.z1) / 2;
  p.rod("satin", "x", (inner.x0 + inner.x1) / 2, yr, zc, inner.x1 - inner.x0, 0.008);
  for (let i = 0; i < MEAT.n; i++) {
    const x = inner.x0 + ((inner.x1 - inner.x0) * (i + 0.5)) / MEAT.n;
    p.tube("satin", [
      { x, y: yr + 0.008, z: zc },
      { x, y: yr - 0.03, z: zc },
      { x, y: yr - 0.05, z: zc + 0.015 },
    ], 0.003);
    const top = yr - 0.05;
    p.lathe(MEAT_MATS[i % MEAT_MATS.length], x, top - MEAT.l, zc + 0.01, [
      [0, 0],
      [MEAT.r * 0.7, MEAT.l * 0.05],
      [MEAT.r, MEAT.l * 0.3],
      [MEAT.r * 0.9, MEAT.l * 0.7],
      [MEAT.r * 0.45, MEAT.l * 0.95],
      [0, MEAT.l],
    ], { segments: 12 });
  }
  const shelf = wireShelves(p, { ...inner, y1: inner.y0 + 0.5 }, 1)[0];
  const loin = Math.min(0.4, inner.x1 - inner.x0 - 0.1);
  p.roundedBox("foodRed", -loin / 2 + (inner.x0 + inner.x1) / 2, loin / 2 + (inner.x0 + inner.x1) / 2, shelf, shelf + 0.09, zc - 0.08, zc + 0.08, 0.03);
}

/** Salt blocks (pink rock salt) and the colours of the hanging pieces (m). */
const SALT_MAT: MaterialId = "foodCream";
const MEAT_MATS: readonly MaterialId[] = ["foodRed", "foodBrown"];

function specialty(kind: string, stock: Stock): KindDef {
  return {
    kind,
    plan(s) {
      doorSwings(s, 1);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      fasciaFront(f);
      const y0 = z0 + BASE_MM;
      const y1 = top - FASCIA_MM;
      f.line("detail", [l, y0], [r, y0]);
      doorFront(f, l + LEAF_GAP_MM / 2, r - LEAF_GAP_MM / 2, y0 + LEAF_GAP_MM / 2, y1 - LEAF_GAP_MM / 2, true, true);
      // What shows through the pane: the trays, or the rail and the shelf.
      const a = l + GLASS_FRAME_MM;
      const b = r - GLASS_FRAME_MM;
      const inner = y1 - y0 - 2 * GLASS_FRAME_MM;
      if (stock === "fish") {
        for (let i = 1; i < FISH_TRAYS; i++) f.line("detail", [a, y0 + GLASS_FRAME_MM + (inner * i) / FISH_TRAYS], [b, y0 + GLASS_FRAME_MM + (inner * i) / FISH_TRAYS]);
      } else {
        f.line("detail", [a, y1 - GLASS_FRAME_MM - 120], [b, y1 - GLASS_FRAME_MM - 120]);
        f.line("detail", [a, y0 + GLASS_FRAME_MM + 250], [b, y0 + GLASS_FRAME_MM + 250]);
      }
    },
    mesh(p, s) {
      const zBody = s.d / 2 - FRONT;
      uprightCarcass(p, s, zBody, true, stock === "aging" ? "panelDark" : "steel");
      const inner = cabinetShell(p, s, PLINTH, s.h - FASCIA, zBody, stock === "aging" ? "panelDark" : "steel");
      if (stock === "fish") fishTrays(p, { ...inner, z1: inner.z1 - SHEET });
      else agingInside(p, { ...inner, z1: inner.z1 - SHEET });
      coolDoor(p, { x0: -s.w / 2, x1: s.w / 2, y0: PLINTH, y1: s.h - FASCIA, zBody, zFront: s.d / 2, hinge: "left", handle: "vertical", gripY: m(GRIP_HEIGHT_MM), glass: true, frame: stock === "aging" ? "panelDark" : "steel" });
    },
  };
}

export const fridgeFish = specialty("fridgeFish", "fish");
export const meatAgingCabinet = specialty("meatAgingCabinet", "aging");
