// Mobile plate dispenser (Tellerspender, fahrbar): one or more spring-loaded tubes, the top
// plate of each stack level with the cover, on castors with a push handle at the back. The
// heated version has a thermostat knob and a pilot lamp on the front.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, SHEET, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { bumper, CASTOR, castors, castorsFront, PANEL_SHEET, pilotLamp, plateStack, ratingPlate } from "./common";
import { ventSlots } from "../parts/details";

/** Width taken by one tube (mm) and the largest plate (radius, m). */
const TUBE = 420;
const PLATE_R = 0.16;
/** Room for the push handle at the back (m). */
const HANDLE_SPACE = 0.04;
/** Rubber bumper round the base (m). */
const BUMPER = 0.03;

/** Number of tubes of a dispenser of the given width (mm). */
export function tubes(width: number): number {
  return Math.max(1, Math.round(width / TUBE));
}

function makePlateDispenser(kind: string, heated: boolean): KindDef {
  return {
    kind,
    plan(s) {
      const n = tubes(s.w);
      const tw = s.w / n;
      const cy = HANDLE_SPACE * 500;
      for (let i = 0; i < n; i++) {
        const cx = s.L + tw * (i + 0.5);
        const r = Math.min(PLATE_R * 1000, tw / 2 - INSET / 2, (s.d - HANDLE_SPACE * 1000) / 2 - INSET / 2);
        s.circle("detail", cx, cy, r);
        s.circle("detail", cx, cy, r * 0.6);
      }
      s.line("detail", [s.L + INSET, s.B + INSET / 2], [s.R - INSET, s.B + INSET / 2]);
    },
    elevation(f) {
      castorsFront(f);
      const top = f.top - TOP * 1000;
      f.line("detail", [f.l, top], [f.r, top]);
      if (heated) {
        const x = f.r - FRONT_INSET * 2;
        f.circle("detail", x, top - FRONT_INSET * 2, FRONT_INSET / 2);
        f.circle("detail", x, top - FRONT_INSET * 3.5, FRONT_INSET / 5);
      }
    },
    mesh(p, s, item) {
      const zb = -s.d / 2 + HANDLE_SPACE;
      const zc = (zb + s.d / 2) / 2;
      castors(p, s.w, s.d);
      bumper(p, -s.w / 2, s.w / 2, CASTOR.h, CASTOR.h + BUMPER, zb, s.d / 2);
      p.roundedBox("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, CASTOR.h + BUMPER, s.h - TOP, zb + SHEET, s.d / 2 - SHEET, BODY_RADIUS * 4, "vertical");
      // The cover with an opening per tube, the top plate of each stack in it, a little below
      // the cover so the tube's rim shows.
      const n = tubes(item.width);
      const tw = s.w / n;
      const r = Math.min(PLATE_R, tw / 2 - 0.03, (s.d - HANDLE_SPACE) / 2 - 0.03);
      const holes = Array.from({ length: n }, (_, i) => {
        const cx = -s.w / 2 + tw * (i + 0.5);
        return { x0: cx - r - 0.01, x1: cx + r + 0.01, z0: zc - r - 0.01, z1: zc + r + 0.01, r: r + 0.01 };
      });
      p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, holes);
      for (const h of holes) {
        const cx = (h.x0 + h.x1) / 2;
        // The tube's rolled collar in the opening and the stack of plates inside it.
        p.lathe("satin", cx, s.h - TOP - 0.02, zc, [
          [r + 0.004, 0],
          [r + 0.012, 0],
          [r + 0.012, TOP + 0.016],
          [r + 0.008, TOP + 0.019],
          [r + 0.004, TOP + 0.016],
          [r + 0.004, 0],
        ]);
        p.lathe("steelDark", cx, s.h - TOP - 0.02, zc, [
          [0, 0],
          [r + 0.005, 0],
          [r + 0.005, 0.004],
          [0, 0.004],
        ]);
        plateStack(p, cx, s.h - TOP - 0.016, zc, r, TOP + 0.01);
      }
      // Push handle at the back: one bent bar on its two stand-offs.
      const hy = s.h - 0.08;
      const hz = -s.d / 2 + 0.01;
      const hx = s.w / 2 - 0.08;
      p.tube(
        "handle",
        [
          { x: -hx, y: hy, z: zb + SHEET },
          { x: -hx, y: hy, z: hz },
          { x: hx, y: hy, z: hz },
          { x: hx, y: hy, z: zb + SHEET },
        ],
        0.01,
        { bend: 0.02 },
      );
      ratingPlate(p, -s.w / 2 + 0.08, CASTOR.h + BUMPER + 0.05, s.d / 2 - SHEET);
      if (heated) {
        const zp = s.d / 2 - SHEET;
        p.plate("panelDark", s.w / 2 - 0.13, s.w / 2 - 0.03, s.h - TOP - 0.2, s.h - TOP - 0.04, zp, zp + PANEL_SHEET, 0.006, true);
        p.knob(s.w / 2 - 0.08, s.h - TOP - 0.08, zp + PANEL_SHEET, s.d / 2);
        pilotLamp(p, s.w / 2 - 0.08, s.h - TOP - 0.155, zp + PANEL_SHEET);
        ventSlots(p, -s.w / 2 + 0.08, s.w / 2 - 0.16, s.h - TOP - 0.14, s.h - TOP - 0.06, zp, 3);
      }
    },
  };
}

export const plateDispenser = makePlateDispenser("plateDispenser", false);
export const plateDispenserHeated = makePlateDispenser("plateDispenserHeated", true);
