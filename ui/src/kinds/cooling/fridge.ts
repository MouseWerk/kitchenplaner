// Upright refrigerator or freezer for GN 2/1 (Kühlschrank, Tiefkühlschrank): one door column per
// 700 mm of width, full-height or half doors, solid or glass, a fascia with the machine grille and
// the display on top. A single door is hinged on the left, a pair opens from the middle.

import { GAP, PLINTH, type Parts, type Size } from "../parts/mesh";
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
  GRIP_HEIGHT_MM,
  hingeLeft,
  LEAF_GAP_MM,
  m,
  uprightCarcass,
  uprightColumns,
  wireShelves,
} from "./common";

/** How a cabinet's door column is split. */
type DoorStyle = "full" | "half" | "glass";

/** Shelf pitch behind glass doors (m, GN 2/1 runners about every 400 mm). */
const SHELF_PITCH = 0.4;
/** GN containers standing on a shelf behind glass: height and how much of the shelf they fill. */
const CONTAINER_H = 0.1;
/** Distance of a half door's handle from the joint between the two doors (mm). */
const HALF_GRIP_MM = 250;

function upright(kind: string, style: DoorStyle): KindDef {
  return {
    kind,
    plan(s) {
      // Closed doors at the front with their swings; half doors swing like the full one.
      doorSwings(s, uprightColumns(s.w));
    },
    elevation(f) {
      const { l, z0, top } = f;
      fasciaFront(f);
      const cols = uprightColumns(f.w);
      const rows = style === "half" ? 2 : 1;
      const y0 = z0 + BASE_MM;
      const y1 = top - FASCIA_MM;
      f.line("detail", [l, y0], [f.r, y0]);
      const cw = f.w / cols;
      const rh = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        const a = l + c * cw + LEAF_GAP_MM / 2;
        const b = a + cw - LEAF_GAP_MM;
        for (let k = 0; k < rows; k++) {
          const zb = y0 + k * rh + LEAF_GAP_MM / 2;
          const zt = zb + rh - LEAF_GAP_MM;
          doorFront(f, a, b, zb, zt, hingeLeft(c, cols), style === "glass");
        }
        if (style === "glass") {
          // Shelves seen through the pane.
          const inner = y1 - y0 - 2 * GLASS_FRAME_MM;
          const n = shelfCount(m(inner));
          for (let i = 1; i <= n; i++) {
            const z = y0 + GLASS_FRAME_MM + (inner * i) / (n + 1);
            f.line("detail", [a + GLASS_FRAME_MM, z], [b - GLASS_FRAME_MM, z]);
          }
        }
      }
    },
    mesh(p, s) {
      const zBody = s.d / 2 - FRONT;
      uprightCarcass(p, s, zBody, style === "glass");
      const cols = uprightColumns(s.w * 1000);
      const cw = s.w / cols;
      const y0 = PLINTH;
      const y1 = s.h - FASCIA;
      if (style === "glass") glassInterior(p, s, zBody, cols);
      for (let c = 0; c < cols; c++) {
        const x0 = -s.w / 2 + c * cw;
        const hinge = hingeLeft(c, cols) ? "left" : "right";
        if (style === "half") {
          const ym = (y0 + y1) / 2;
          coolDoor(p, { x0, x1: x0 + cw, y0, y1: ym, zBody, zFront: s.d / 2, hinge, handle: "vertical", gripY: ym - m(HALF_GRIP_MM) });
          coolDoor(p, { x0, x1: x0 + cw, y0: ym, y1, zBody, zFront: s.d / 2, hinge, handle: "vertical", gripY: ym + m(HALF_GRIP_MM) });
        } else {
          coolDoor(p, { x0, x1: x0 + cw, y0, y1, zBody, zFront: s.d / 2, hinge, handle: "vertical", gripY: m(GRIP_HEIGHT_MM), glass: style === "glass" });
        }
      }
    },
  };
}

/** Number of shelves behind a glass door of the given inner height (m). */
function shelfCount(innerH: number): number {
  return Math.max(1, Math.round(innerH / SHELF_PITCH) - 1);
}

/** The inside behind glass doors: liner, wire shelves and GN containers standing on them. */
function glassInterior(p: Parts, s: Size, zBody: number, cols: number): void {
  const inner = cabinetShell(p, s, PLINTH, s.h - FASCIA, zBody);
  // A mullion between door pairs carries the gaskets of both doors.
  for (let c = 1; c < cols; c++) {
    const x = -s.w / 2 + (c * s.w) / cols;
    p.box("steel", x - 0.02, x + 0.02, inner.y0, inner.y1, inner.z0, zBody);
  }
  const shelves = wireShelves(p, inner, shelfCount(inner.y1 - inner.y0));
  // Two GN containers per door column on every shelf, side by side.
  const cw = (inner.x1 - inner.x0) / cols;
  const depth = Math.min(0.53, inner.z1 - inner.z0 - 0.08);
  for (const y of shelves) {
    for (let c = 0; c < cols; c++) {
      const a = inner.x0 + c * cw + 0.04;
      const b = inner.x0 + (c + 1) * cw - 0.04;
      const mid = (a + b) / 2;
      p.box("steelDark", a, mid - GAP * 2, y, y + CONTAINER_H, inner.z0 + 0.04, inner.z0 + 0.04 + depth);
      p.box("steelDark", mid + GAP * 2, b, y, y + CONTAINER_H * 0.65, inner.z0 + 0.04, inner.z0 + 0.04 + depth);
    }
  }
}

export const fridge = upright("fridge", "full");
export const fridgeHalf = upright("fridgeHalf", "half");
export const fridgeGlass = upright("fridgeGlass", "glass");
