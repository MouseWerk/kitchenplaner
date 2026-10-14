// Building blocks of the plan symbols. A symbol is drawn in the item's own frame: millimetres,
// x along the width (centred), y from the back (-d/2) to the front (+d/2), the front being the
// operating side. `PlanSketch` turns the shapes into plan coordinates and tags them with the item.
//
// The outline of the footprint is drawn by `planDrawing` (model/plan.ts); a symbol only adds the
// inner details.

import { toPlan } from "../../model/geometry";
import type { Item, Vec2 } from "../../model/types";
import type { Pen, Shape } from "../../render/drawing";

/** Height of the back upstand of work tables (mm, the usual 50 mm splash edge). */
export const UPSTAND = 50;
/** Depth of the control strip at the front of cooking appliances (mm). */
export const CONTROL_STRIP = 150;
/** Inset of inner symbols from the item outline (mm). */
export const INSET = 50;

/** Collects shapes given in an item's own frame (x along the width, y from back to front). */
export class PlanSketch {
  constructor(
    readonly item: Item,
    private readonly out: Shape[],
  ) {}

  /** Width and depth of the item (mm). */
  get w(): number {
    return this.item.width;
  }
  get d(): number {
    return this.item.depth;
  }
  /** Left, right, back and front edge in the item frame. */
  get L(): number {
    return -this.item.width / 2;
  }
  get R(): number {
    return this.item.width / 2;
  }
  get B(): number {
    return -this.item.depth / 2;
  }
  get F(): number {
    return this.item.depth / 2;
  }

  private p(x: number, y: number): Vec2 {
    return toPlan(this.item, { x, y });
  }

  line(pen: Pen, ...pts: [number, number][]) {
    this.out.push({ t: "poly", pen, itemId: this.item.id, pts: pts.map(([x, y]) => this.p(x, y)), closed: false });
  }

  rect(pen: Pen, x0: number, y0: number, x1: number, y1: number) {
    const pts = [this.p(x0, y0), this.p(x1, y0), this.p(x1, y1), this.p(x0, y1)];
    this.out.push({ t: "poly", pen, itemId: this.item.id, pts, closed: true });
  }

  circle(pen: Pen, x: number, y: number, r: number) {
    this.out.push({ t: "circle", pen, itemId: this.item.id, c: this.p(x, y), r });
  }

  /** A quarter arc around (x, y), from the local direction at `from` degrees clockwise by 90. */
  quarter(pen: Pen, x: number, y: number, r: number, from: number) {
    // The item frame is only turned, never mirrored, so local angles just shift by the rotation.
    const a0 = from + this.item.rotation;
    this.out.push({ t: "arc", pen, itemId: this.item.id, c: this.p(x, y), r, a0, a1: a0 + 90 });
  }
}

/** The line of the control strip across the front of a cooking appliance. */
export function controlStrip(s: PlanSketch) {
  s.line("detail", [s.L, s.F - CONTROL_STRIP + INSET], [s.R, s.F - CONTROL_STRIP + INSET]);
}

/** Plate grid of a hob: `cols` × 2 circles (or squares) in the area behind the control strip. */
export function hob(s: PlanSketch, cols: number, round: boolean) {
  const { w, d } = s;
  const x0 = -w / 2 + INSET;
  const y0 = -d / 2 + INSET;
  const cw = (w - 2 * INSET) / cols;
  const rh = (d - INSET - CONTROL_STRIP) / 2;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 2; r++) {
      const cx = x0 + cw * (c + 0.5);
      const cy = y0 + rh * (r + 0.5);
      const half = Math.min(cw, rh) * 0.4;
      if (round) s.circle("detail", cx, cy, half);
      else s.rect("detail", cx - half, cy - half, cx + half, cy + half);
    }
  }
  controlStrip(s);
}

/** The back upstand of a worktop: a line parallel to the back edge. */
export function upstandLine(s: PlanSketch) {
  s.line("detail", [s.L, s.B + UPSTAND], [s.R, s.B + UPSTAND]);
}

/**
 * A hinged door at the front, drawn closed with its swing (90 degrees, dashed) in front of the
 * unit: hinge on the left, leaf as wide as `leaf` (default the whole width).
 */
export function frontDoorSwing(s: PlanSketch, leaf = s.w) {
  s.line("detail", [s.L, s.F - INSET / 2], [s.L + leaf, s.F - INSET / 2]);
  s.quarter("hidden", s.L, s.F, leaf, 0);
}

/** A diagonal cross over the footprint (open structures, hoods), or one diagonal. */
export function cross(s: PlanSketch, pen: Pen, both = true) {
  s.line(pen, [s.L, s.B], [s.R, s.F]);
  if (both) s.line(pen, [s.R, s.B], [s.L, s.F]);
}
