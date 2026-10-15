// Accessories of the cooking line: the heated bridge (Wärmebrücke: a shelf on two posts over the
// line or the pass, heat lamps hanging under it), the overshelf (Aufsatzbord: two shelves on the
// same posts) and the hob cover (Abdeckplatte: a folded plate laid over a hob that is not in use,
// with two grip slots).

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, LEG_RADIUS, TOP_RADIUS } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { pilot } from "./details";
import { controlPanel, housing } from "../parts/details";

/** Size of the square posts and of their foot plates (m). */
const POST = 0.03;
const POST_FOOT = 0.06;
/** Thickness of a shelf (m). */
const SHELF = 0.03;
/** Pitch of the heat lamps along the bridge, and their shade's radius and height (m). */
const LAMP_PITCH = 0.3;
const SHADE_R = 0.055;
const SHADE_H = 0.11;
/** Depth of the heater housing under the shelf of the heated bridge (m). */
const HEATER = 0.05;

function lamps(w: number): number {
  return Math.max(1, Math.round((w - 0.1) / LAMP_PITCH));
}

function makeBridge(kind: string, heated: boolean): KindDef {
  return {
    kind,
    placement: "overhead",
    plan(s) {
      const p = POST_FOOT * 500;
      for (const sx of [-1, 1]) s.rect("overhead", sx * (s.w / 2 - p) - p, -p, sx * (s.w / 2 - p) + p, p);
      s.rect("overhead", s.L + INSET / 2, s.B + INSET / 2, s.R - INSET / 2, s.F - INSET / 2);
      if (heated) {
        const n = lamps(s.w / 1000);
        for (let i = 0; i < n; i++) s.circle("overhead", s.L + (s.w / n) * (i + 0.5), 0, SHADE_R * 1000);
      }
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const pw = POST * 1000;
      f.box("detail", l + FRONT_INSET / 2, l + FRONT_INSET / 2 + pw, z0, top - SHELF * 1000);
      f.box("detail", r - FRONT_INSET / 2 - pw, r - FRONT_INSET / 2, z0, top - SHELF * 1000);
      f.box("detail", l, r, top - SHELF * 1000, top);
      if (heated) {
        f.box("detail", l + 10, r - 10, top - (SHELF + HEATER) * 1000, top - SHELF * 1000, "item-dark");
        const n = lamps(f.w / 1000);
        for (let i = 0; i < n; i++) {
          const x = l + (f.w / n) * (i + 0.5);
          const y = top - (SHELF + HEATER) * 1000;
          f.line("detail", [x - SHADE_R * 1000, y - SHADE_H * 1000], [x, y], [x + SHADE_R * 1000, y - SHADE_H * 1000], [x - SHADE_R * 1000, y - SHADE_H * 1000]);
        }
      } else {
        const mid = z0 + (top - z0) * 0.5;
        f.box("detail", l + FRONT_INSET / 2 + pw, r - FRONT_INSET / 2 - pw, mid - SHELF * 1000, mid);
      }
    },
    mesh(p, s) {
      // The posts on foot plates, standing on the line's top.
      for (const sx of [-1, 1]) {
        const x = sx * (s.w / 2 - POST_FOOT / 2);
        p.roundedBox("steelDark", x - POST_FOOT / 2, x + POST_FOOT / 2, 0, 0.008, -POST_FOOT / 2, POST_FOOT / 2, BODY_RADIUS);
        p.roundedBox("steel", x - POST / 2, x + POST / 2, 0.006, s.h - SHELF + 0.002, -POST / 2, POST / 2, LEG_RADIUS, "vertical");
      }
      // The top shelf with a low upstand at the back.
      p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - SHELF, s.h - 0.012, -s.d / 2, s.d / 2, TOP_RADIUS);
      p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - 0.012 - TOP_RADIUS, s.h, -s.d / 2, -s.d / 2 + 0.008, TOP_RADIUS, "top");
      if (!heated) {
        // The lower shelf between the posts.
        const y = s.h * 0.5;
        const px = s.w / 2 - POST_FOOT / 2 - POST / 2;
        p.roundedBox("steel", -px, px, y - SHELF, y, -s.d / 2 + 0.02, s.d / 2 - 0.02, TOP_RADIUS);
        return;
      }
      // The heater housing under the shelf with the lamps hanging from it, a switch on its front.
      const hy = s.h - SHELF - HEATER;
      housing(p, "steel", -s.w / 2 + 0.01, s.w / 2 - 0.01, hy, s.h - SHELF + 0.002, -s.d / 2 + 0.03, s.d / 2 - 0.03, 0.006);
      const n = lamps(s.w);
      for (let i = 0; i < n; i++) {
        const x = -s.w / 2 + (s.w / n) * (i + 0.5);
        p.lathe("satin", x, hy - SHADE_H, 0, [
          [SHADE_R * 0.92, 0],
          [SHADE_R, 0],
          [SHADE_R * 0.6, SHADE_H * 0.7],
          [SHADE_R * 0.3, SHADE_H * 0.85],
          [SHADE_R * 0.2, SHADE_H],
          [0, SHADE_H],
          [0, SHADE_H * 0.9],
          [SHADE_R * 0.27, SHADE_H * 0.78],
          [SHADE_R * 0.55, SHADE_H * 0.62],
          [SHADE_R * 0.92, 0],
        ]);
        p.lathe("panel", x, hy - SHADE_H * 0.75, 0, [
          [0, 0],
          [SHADE_R * 0.3, SHADE_H * 0.08],
          [SHADE_R * 0.42, SHADE_H * 0.3],
          [SHADE_R * 0.25, SHADE_H * 0.5],
          [0, SHADE_H * 0.5],
        ]);
      }
      const zFace = s.d / 2 - 0.027;
      controlPanel(p, s.w / 2 - 0.15, s.w / 2 - 0.03, hy + 0.008, s.h - SHELF - 0.008, s.d / 2 - 0.03, zFace);
      p.knob(s.w / 2 - 0.11, hy + HEATER / 2, zFace, s.d / 2, 0.014);
      pilot(p, s.w / 2 - 0.06, hy + HEATER / 2, zFace);
    },
  };
}

export const lineBridge = makeBridge("lineBridge", true);
export const lineOvershelf = makeBridge("lineOvershelf", false);

/** Thickness of the hob cover's sheet, and the size of its grip slots (m). */
const COVER_SHEET = 0.008;
const GRIP_W = 0.12;
const GRIP_D = 0.03;

export const hobCover: KindDef = {
  kind: "hobCover",
  placement: "tableTop",
  plan(s) {
    for (const sy of [-1, 1]) {
      const y = sy * (s.d / 2 - INSET * 2);
      s.rect("detail", -GRIP_W * 500, y - GRIP_D * 500, GRIP_W * 500, y + GRIP_D * 500);
    }
  },
  elevation(f) {
    f.line("detail", [f.l, f.top - COVER_SHEET * 1000], [f.r, f.top - COVER_SHEET * 1000]);
  },
  mesh(p, s) {
    // The plate and its skirts folded down all round, so it sits over the hob's frame.
    p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - COVER_SHEET, s.h, -s.d / 2, s.d / 2, TOP_RADIUS);
    for (const sx of [-1, 1]) p.roundedBox("steel", sx * s.w / 2 - (sx > 0 ? COVER_SHEET : 0), sx * s.w / 2 + (sx < 0 ? COVER_SHEET : 0), 0, s.h - COVER_SHEET / 2, -s.d / 2, s.d / 2, BODY_RADIUS, "vertical");
    for (const sz of [-1, 1]) p.roundedBox("steel", -s.w / 2 + COVER_SHEET, s.w / 2 - COVER_SHEET, 0, s.h - COVER_SHEET / 2, sz * s.d / 2 - (sz > 0 ? COVER_SHEET : 0), sz * s.d / 2 + (sz < 0 ? COVER_SHEET : 0), BODY_RADIUS, "vertical");
    // Grip slots near the front and the back.
    for (const sz of [-1, 1]) {
      const z = sz * (s.d / 2 - INSET * 2 / 1000);
      p.roundedBox("slot", -GRIP_W / 2, GRIP_W / 2, s.h - 0.001, s.h, z - GRIP_D / 2, z + GRIP_D / 2, GRIP_D / 2, "vertical");
    }
  },
};
