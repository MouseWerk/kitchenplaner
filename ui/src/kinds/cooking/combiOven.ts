// Ovens with a side-hinged door: the combi oven (Kombidämpfer: glass door, touch display and
// dial at the right), the convection oven (Heißluftofen: glass door, knobs) and the holding
// cabinet (Warmhalteschrank: a solid door with a small window, controls across the top). The
// table-top sizes stand on a stand (their elevation), the floor sizes on their own feet.

import { INSET as FRONT_INSET, PANEL } from "../parts/elevation";
import { BODY_RADIUS, DOOR, GAP, type Parts } from "../parts/mesh";
import { frontDoorSwing, INSET } from "../parts/plan";
import { MM_PER_UNIT } from "../../three/shared";
import type { KindDef } from "../types";
import { standFront, standMesh, unitFeet } from "./common";

/** Width of the control panel at the right (m). */
const PANEL_W = 0.22;
/** Height of the control strip across the top of a holding cabinet (m). */
const TOP_PANEL = 0.12;
/** Edge radius of the housing: these units are pressed and deep drawn, rounder than a counter (m). */
const HOUSING_RADIUS = 0.008;
/** Edge radius of the door leaf and corner radius of its window (m). */
const LEAF_RADIUS = 0.005;
const WINDOW_RADIUS = 0.03;
/** Width of the black seal round the door window as seen from the front (m). */
const WINDOW_SEAL = 0.006;

interface OvenLook {
  /** Where the controls sit: a panel at the right or a strip across the top. */
  panel: "right" | "top";
  /** Touch display and dial, or knobs. */
  controls: "display" | "knobs";
  /** A large viewing window or a small one in a solid door. */
  window: "large" | "small";
}

/** Width of the control panel at the right of an oven `w` wide (same unit as `w`, m or mm). */
function panelWidth(w: number, perMetre: number): number {
  return Math.min(PANEL_W * perMetre, w / 4);
}

function makeOven(kind: string, look: OvenLook): KindDef {
  const right = look.panel === "right";
  return {
    kind,
    plan(s) {
      // The door swings open to the left of the controls; hinge at the left.
      const panel = right ? panelWidth(s.w, 1000) : 0;
      s.rect("detail", s.L + INSET / 2, s.F - INSET, s.R - panel - INSET / 2, s.F);
      if (right) s.line("detail", [s.R - panel, s.B + INSET], [s.R - panel, s.F]);
      frontDoorSwing(s, s.w - panel);
    },
    elevationBase(f) {
      standFront(f);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const I = FRONT_INSET;
      const panelW = right ? Math.min(PANEL + I, f.w / 4) : 0;
      const dr = r - panelW;
      const dTop = right ? top - I : top - TOP_PANEL * 1000;
      f.box("detail", l + I, dr - I / 2, z0 + I, dTop);
      if (look.window === "large") f.box("detail", l + I * 3, dr - I * 3, z0 + I * 4, dTop - I * 3, "glass");
      else {
        const cx = (l + dr) / 2;
        const ww = Math.min(f.w * 0.25, 200);
        f.box("detail", cx - ww / 2, cx + ww / 2, (z0 + dTop) / 2, dTop - I * 3, "glass");
      }
      // The handle at the free edge of the door.
      f.line("detail", [dr - I * 1.5, (z0 + dTop) / 2 - 150], [dr - I * 1.5, (z0 + dTop) / 2 + 150]);
      if (right) {
        f.box("detail", dr, r - I / 2, z0 + I, top - I, "item-dark");
        if (look.controls === "display") {
          f.box("detail", dr + I, r - I * 1.5, top - I * 2 - (top - z0) / 5, top - I * 2);
          f.circle("detail", (dr + r) / 2, top - I * 4 - (top - z0) / 5, panelW * 0.2);
        } else for (let i = 1; i <= 3; i++) f.circle("detail", (dr + r) / 2, top - I - ((top - z0) / 6) * i, panelW * 0.2);
      } else {
        f.box("detail", l + I / 2, r - I / 2, dTop + I / 2, top - I / 2, "item-dark");
        for (let i = 1; i <= 2; i++) f.circle("detail", l + (f.w / 3) * i, (dTop + top) / 2 + I / 4, (top - dTop) * 0.2);
      }
    },
    mesh(p, s, item) {
      const elev = item.elevation / MM_PER_UNIT;
      // On a stand: the stand reaches from the floor up to the unit (negative local y).
      standMesh(p, s, elev);
      const y0 = unitFeet(p, s, elev > 0);
      const zf = s.d / 2;
      p.roundedBox("steel", -s.w / 2, s.w / 2, y0, s.h, -s.d / 2, zf - DOOR, HOUSING_RADIUS);
      const panelW = right ? panelWidth(s.w, 1) : 0;
      const doorX1 = s.w / 2 - panelW;
      const doorTop = right ? s.h - GAP : s.h - TOP_PANEL;
      const m = 0.03;
      // The door: a steel leaf rounded at the front with the window in its seal, the handle at its
      // free edge.
      p.roundedBox("steel", -s.w / 2 + GAP, doorX1 - GAP, y0 + GAP, doorTop - GAP, zf - DOOR, zf - DOOR / 2, LEAF_RADIUS, "top", "z");
      if (look.window === "large") {
        doorWindow(p, -s.w / 2 + m * 2, doorX1 - m * 3, y0 + m * 2.5, doorTop - m * 2.5, zf - DOOR / 2);
      } else {
        const cx = (-s.w / 2 + doorX1) / 2;
        const ww = Math.min(0.2, s.w * 0.25);
        const wy = y0 + (doorTop - y0) * 0.55;
        doorWindow(p, cx - ww / 2, cx + ww / 2, wy, Math.min(wy + 0.25, doorTop - m * 2), zf - DOOR / 2);
      }
      const len = Math.min(0.5, (doorTop - y0) * 0.45);
      const hy = (y0 + doorTop) / 2;
      p.barHandle("y", hy - len / 2, hy + len / 2, doorX1 - m * 1.2, zf - DOOR / 2, zf);
      // The drip channel under the door.
      p.roundedBox("steelDark", -s.w / 2 + GAP, doorX1 - GAP, y0 - 0.012, y0 + 0.005, zf - DOOR - 0.03, zf - DOOR / 2, BODY_RADIUS);
      if (right) {
        const px = (doorX1 + s.w / 2) / 2;
        const zFace = zf - DOOR / 2;
        p.roundedBox("panelDark", doorX1 + GAP, s.w / 2 - GAP, y0 + m, s.h - m, zf - DOOR, zFace, LEAF_RADIUS, "top", "z");
        const pw = panelW - 0.05;
        const top = Math.min(s.h - m - 0.03, y0 + 0.95);
        if (look.controls === "display") {
          // Touch display and the central dial.
          const dh = Math.min(0.2, (s.h - y0) * 0.25);
          if (pw > 0.05 && top - dh - 0.12 > y0 + m) {
            p.plate("glassDark", px - pw / 2, px + pw / 2, top - dh, top, zFace, zFace + 0.003, 0.008, true);
            dial(p, px, top - dh - 0.08, zFace, zf, Math.min(0.035, pw / 2));
          }
        } else {
          for (let i = 0; i < 3; i++) p.knob(px, top - 0.06 - i * 0.12, zFace, zf, Math.min(0.025, pw / 2));
        }
      } else {
        const zFace = zf - DOOR / 2;
        p.roundedBox("panelDark", -s.w / 2 + GAP, s.w / 2 - GAP, s.h - TOP_PANEL + GAP, s.h - GAP, zf - DOOR, zFace, LEAF_RADIUS, "top", "z");
        p.plate("glassDark", -s.w / 2 + 0.06, -s.w / 2 + 0.2, s.h - TOP_PANEL * 0.7, s.h - TOP_PANEL * 0.3, zFace, zFace + 0.003, 0.006, true);
        p.knob(s.w / 2 - 0.08, s.h - TOP_PANEL / 2, zFace, zf, 0.02);
        p.knob(s.w / 2 - 0.16, s.h - TOP_PANEL / 2, zFace, zf, 0.02);
      }
    },
  };
}

/**
 * A door window from x0 to x1 and y0 to y1 on a face at `zFace` (m): the tinted pane with round
 * corners in a black seal that shows round it.
 */
function doorWindow(p: Parts, x0: number, x1: number, y0: number, y1: number, zFace: number): void {
  const r = Math.min(WINDOW_RADIUS, (x1 - x0) / 4, (y1 - y0) / 4);
  p.plate("rubber", x0 - WINDOW_SEAL, x1 + WINDOW_SEAL, y0 - WINDOW_SEAL, y1 + WINDOW_SEAL, zFace, zFace + 0.0015, r + WINDOW_SEAL);
  p.plate("glassDark", x0, x1, y0, y1, zFace, zFace + 0.003, r, true);
}

/**
 * The central dial of a control panel at (cx, cy) on a face at `zFace` (m): a large knob of radius
 * `r` in a satin bezel ring, ending at `zFront`.
 */
function dial(p: Parts, cx: number, cy: number, zFace: number, zFront: number, r: number): void {
  const t = 0.004;
  p.lathe(
    "satin",
    cx,
    cy,
    zFace,
    [
      [0, 0],
      [r * 1.25, 0],
      [r * 1.25, t * 0.4],
      [r * 1.12, t],
      [0, t],
    ],
    { axis: "z" },
  );
  p.knob(cx, cy, zFace + t, zFront, r);
}

export const combiOven = makeOven("combiOven", { panel: "right", controls: "display", window: "large" });
export const convectionOven = makeOven("convectionOven", { panel: "right", controls: "knobs", window: "large" });
export const holdingCabinet = makeOven("holdingCabinet", { panel: "top", controls: "knobs", window: "small" });
