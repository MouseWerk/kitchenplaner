// Building blocks of the elevation drawings. An item is drawn in its elevation frame: X runs
// along the viewer's right axis from `l` to `r` (drawing units, mm), heights are millimetres
// above the floor (`z`); `Front` turns them into drawing coordinates (Y = -z) and tags the shapes
// with the item.
//
// The body box from the item's elevation to its top is drawn by `elevationDrawing`
// (model/elevation.ts); a kind adds the front details when its front faces the viewer.

import type { Item, Vec2 } from "../../model/types";
import type { Fill, Pen, Shape } from "../../render/drawing";

/** Thickness of a table top or appliance top (mm). */
export const TOP = 40;
/** Height of the control panel of cooking appliances (mm). */
export const PANEL = 150;
/** Height of the feet / plinth below doors and drawers (mm, usual 150 mm adjustable feet). */
export const FEET = 150;
/** Height of the undershelf of a work table above the floor (mm). */
export const UNDERSHELF = 250;
/** Width of legs and posts (mm, 40 mm square tube). */
export const LEG = 40;
/** Usual width of one door of cabinets and counters (mm). */
export const DOOR_MODULE = 600;
/** Height of the tap above the top (mm). */
export const TAP = 300;
/** Inset of front details from the item outline (mm). */
export const INSET = 40;

/** A rectangle from X `a` to `b` and from height `z0` to `z1` (drawing coordinates). */
export function rect(a: number, b: number, z0: number, z1: number): Vec2[] {
  return [
    { x: a, y: -z0 },
    { x: b, y: -z0 },
    { x: b, y: -z1 },
    { x: a, y: -z1 },
  ];
}

/** Draws boxes and lines of one item in its elevation frame: X from `l` to `r`, heights in mm. */
export class Front {
  constructor(
    readonly item: Item,
    readonly l: number,
    readonly r: number,
    private readonly out: Shape[],
  ) {}

  get w(): number {
    return this.r - this.l;
  }
  /** Lower edge and top of the item above the floor (mm). */
  get z0(): number {
    return this.item.elevation;
  }
  get top(): number {
    return this.item.elevation + this.item.height;
  }

  box(pen: Pen, a: number, b: number, z0: number, z1: number, fill?: Fill) {
    this.out.push({ t: "poly", pen, fill, itemId: this.item.id, pts: rect(a, b, z0, z1), closed: true });
  }

  line(pen: Pen, ...pts: [number, number][]) {
    this.out.push({ t: "poly", pen, itemId: this.item.id, pts: pts.map(([x, z]) => ({ x, y: -z })), closed: false });
  }

  circle(pen: Pen, x: number, z: number, r: number) {
    this.out.push({ t: "circle", pen, itemId: this.item.id, c: { x, y: -z }, r });
  }

  /** `n` equal doors between z0 and z1 with vertical handles next to the middle joint. */
  doors(n: number, z0: number, z1: number) {
    const dw = (this.w - INSET * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const a = this.l + INSET + i * (dw + INSET);
      this.box("detail", a, a + dw, z0, z1);
      // Hinges outside, handles towards the middle (left half: handle right, right half: left).
      const hx = i < n / 2 ? a + dw - INSET : a + INSET;
      const zm = z1 - INSET * 2;
      this.line("detail", [hx, zm], [hx, zm - INSET * 4]);
    }
  }

  /** `n` drawers stacked between z0 and z1, each with a horizontal handle. */
  drawers(n: number, z0: number, z1: number) {
    const dh = (z1 - z0 - INSET * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const b = z0 + i * (dh + INSET);
      this.box("detail", this.l + INSET, this.r - INSET, b, b + dh);
      const c = (this.l + this.r) / 2;
      this.line("detail", [c - INSET * 3, b + dh - INSET * 1.5], [c + INSET * 3, b + dh - INSET * 1.5]);
    }
  }

  /** A control panel strip from z0 to z1 with `n` knobs. */
  panel(z0: number, z1: number, n: number) {
    this.box("detail", this.l, this.r, z0, z1);
    const step = this.w / (n + 1);
    for (let i = 1; i <= n; i++) this.circle("detail", this.l + step * i, (z0 + z1) / 2, (z1 - z0) * 0.25);
  }

  /** The worktop (or appliance top) band at the top of the item. */
  worktop() {
    this.box("detail", this.l, this.r, this.top - TOP, this.top);
  }

  /** Two legs from the lower edge up to the top band and the undershelf between them. */
  legsAndUndershelf(legTop = this.top - TOP) {
    const { l, r, z0 } = this;
    this.box("detail", l, l + LEG, z0, legTop);
    this.box("detail", r - LEG, r, z0, legTop);
    this.line("detail", [l + LEG, z0 + UNDERSHELF], [r - LEG, z0 + UNDERSHELF]);
  }
}

/** Number of doors of a cabinet front of the given width. */
export function doorCount(width: number): number {
  return Math.max(1, Math.round(width / DOOR_MODULE));
}
