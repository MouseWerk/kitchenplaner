// Mobile plate dispenser (Tellerspender, fahrbar): one or more spring-loaded tubes, the top
// plate of each stack level with the cover, on castors with a push handle at the back. The
// heated version has a thermostat knob and a pilot lamp on the front.

import { INSET as FRONT_INSET } from "../parts/elevation";
import { SHEET, TOP } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { CASTOR, castors, castorsFront } from "./common";

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
      p.box("rubber", -s.w / 2, s.w / 2, CASTOR.h, CASTOR.h + BUMPER, zb, s.d / 2);
      p.box("steel", -s.w / 2 + SHEET, s.w / 2 - SHEET, CASTOR.h + BUMPER, s.h - TOP, zb + SHEET, s.d / 2 - SHEET);
      // The cover with an opening per tube, the top plate of each stack in it.
      const n = tubes(item.width);
      const tw = s.w / n;
      const r = Math.min(PLATE_R, tw / 2 - 0.03, (s.d - HANDLE_SPACE) / 2 - 0.03);
      const holes = Array.from({ length: n }, (_, i) => {
        const cx = -s.w / 2 + tw * (i + 0.5);
        return { x0: cx - r - 0.01, x1: cx + r + 0.01, z0: zc - r - 0.01, z1: zc + r + 0.01 };
      });
      // The cover reaches over the push handle as a grip lip.
      p.topWithHoles("steel", s.w, s.d, s.h - TOP, s.h, holes);
      for (const h of holes) {
        const cx = (h.x0 + h.x1) / 2;
        p.box("steelDark", h.x0, h.x1, s.h - TOP - 0.02, s.h - TOP, h.z0, h.z1);
        p.cyl("panel", cx, zc, s.h - TOP, s.h - 0.006, r);
        p.cyl("panel", cx, zc, s.h - 0.006, s.h - 0.003, r * 0.6);
      }
      // Push handle at the back, on two stand-offs.
      const hy = s.h - 0.08;
      const hz = -s.d / 2 + 0.012;
      p.rod("handle", "x", 0, hy, hz, s.w - 0.12, 0.01);
      for (const x of [-s.w / 2 + 0.08, s.w / 2 - 0.08]) p.box("handle", x - 0.008, x + 0.008, hy - 0.008, hy + 0.008, hz, zb + SHEET);
      if (heated) {
        p.knob(s.w / 2 - 0.08, s.h - TOP - 0.08, s.d / 2 - SHEET, s.d / 2);
        p.rod("oil", "z", s.w / 2 - 0.08, s.h - TOP - 0.14, s.d / 2 - SHEET / 2, SHEET, 0.007);
      }
    },
  };
}

export const plateDispenser = makePlateDispenser("plateDispenser", false);
export const plateDispenserHeated = makePlateDispenser("plateDispenserHeated", true);
