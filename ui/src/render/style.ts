// Line weights and paper colors shared by every renderer. Widths and dash lengths are paper
// millimetres; a renderer multiplies them with its paper scale (or maps them to pixels on screen).
//
// The widths follow the ISO 128 line width series (0.13, 0.18, 0.25, 0.35, 0.5, 0.7 mm): cut
// walls heaviest, equipment outlines medium, details and dimensions thin.

import type { Pen } from "./drawing";

export interface PenStyle {
  /** Line width on paper (mm). */
  width: number;
  /** Dash pattern on paper (mm): dash, gap, ... ; undefined for a solid line. */
  dash?: number[];
}

/** Dash pattern of hidden and overhead edges (ISO 128 dashed line: 3 mm dash, 1.5 mm gap). */
const DASHED = [3, 1.5];
/** A shorter dash for thin swing arcs, so they stay distinct from overhead outlines. */
const DASHED_FINE = [1.5, 1];

export const PEN_STYLE: Record<Pen, PenStyle> = {
  wall: { width: 0.5 },
  opening: { width: 0.25 },
  swing: { width: 0.13 },
  item: { width: 0.35 },
  // Lighter than the item outlines: a hood's outline and cross lie over the units below it.
  overhead: { width: 0.18, dash: DASHED },
  detail: { width: 0.18 },
  hidden: { width: 0.18, dash: DASHED_FINE },
  floor: { width: 0.7 },
  dim: { width: 0.13 },
  frame: { width: 0.5 },
};

/** Colors of printed and exported drawings (SVG, PNG): black lines on white paper. */
export const PAPER = {
  line: "#000",
  wallFill: "#bdbdbd",
  itemFill: "#fff",
  itemDarkFill: "#e0e0e0",
  glassFill: "#dcebf5",
  warningFill: "#f8d7d3",
  background: "#fff",
} as const;
