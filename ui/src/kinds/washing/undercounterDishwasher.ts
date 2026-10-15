// Front-loading dishwasher under a counter (Untertischspülmaschine) and glass washer
// (Gläserspülmaschine): a pressed body with a drop-down door, the control panel above the door.
// The same machine also stands raised on a base cabinet that holds the detergent canisters
// (Frontlader mit Unterschrank), so it loads at a comfortable height. In the plan the open door
// lies in front of the unit (it needs that room to load the rack).

import { FEET, INSET as FRONT_INSET } from "../parts/elevation";
import { BODY_RADIUS, CONTROLS, DOOR, DOOR_RADIUS, doors, GAP, PLINTH, TOP_RADIUS, type Parts, type Size } from "../parts/mesh";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { machineFeet, machinePanel } from "./details";
import { housing, ratingPlate } from "../parts/details";

/** Height of the control panel above the door (m). */
const PANEL = 0.08;
/** Height of the machine on a base cabinet (m), at most this share of the unit. */
const MACHINE = 0.82;
const MACHINE_SHARE = 0.7;

/** Height of the base cabinet under a raised machine of height `h` (m, mm alike). */
function standHeight(h: number, k: number): number {
  return Math.max(0, h - Math.min(MACHINE * k, h * MACHINE_SHARE));
}

/**
 * A front-loading machine from `y0` up to the top of the box (m): pressed body, cover, door with
 * its grip, the control panel above it; on its own feet unless it stands on a cabinet.
 */
function frontLoader(p: Parts, s: Size, y0: number): void {
  const zf = s.d / 2;
  const onFeet = y0 === 0;
  const base = onFeet ? PLINTH : y0;
  if (onFeet) machineFeet(p, s.w, s.d, zf - DOOR);
  housing(p, "steel", -s.w / 2, s.w / 2, base, s.h - 0.012, -s.d / 2, zf - DOOR);
  // The cover on top, rounded like a worktop.
  p.roundedBox("steel", -s.w / 2, s.w / 2, s.h - 0.014, s.h, -s.d / 2, zf - DOOR + 0.004, TOP_RADIUS);
  // Drop-down door, a dark joint under it, the grip bar along its top, the panel above.
  const panelY = s.h - Math.min(PANEL, CONTROLS) - 0.014;
  const doorY0 = base + GAP;
  p.box("slot", -s.w / 2 + 0.01, s.w / 2 - 0.01, doorY0 - 0.002, doorY0, zf - DOOR - 0.001, zf - DOOR + 0.0005);
  p.roundedBox("steel", -s.w / 2 + GAP, s.w / 2 - GAP, doorY0, panelY - GAP, zf - DOOR, zf - DOOR / 2, DOOR_RADIUS, "top", "z");
  ratingPlate(p, s.w / 2 - 0.06, doorY0 + 0.04, zf - DOOR / 2, 0.05, 0.03);
  p.barHandle("x", -s.w / 2 + 0.06, s.w / 2 - 0.06, panelY - 0.04, zf - DOOR / 2, zf);
  machinePanel(p, -s.w / 2 + GAP, s.w / 2 - GAP, panelY, s.h - 0.014 - GAP, zf - DOOR, zf - DOOR / 2, 3);
}

function makeFrontLoader(kind: string, cabinet: boolean): KindDef {
  return {
    kind,
    plan(s) {
      // The rack inside (hidden) and the dropped door in front of the unit.
      const rack = Math.min(500, s.w - 2 * INSET, s.d - 2 * INSET);
      s.rect("hidden", -rack / 2, -rack / 2, rack / 2, rack / 2);
      const machine = s.item.height - (cabinet ? standHeight(s.item.height, 1000) : 0);
      const open = Math.min(s.w, machine - (PLINTH + PANEL) * 1000);
      s.rect("opening", s.L + INSET / 2, s.F, s.R - INSET / 2, s.F + open);
    },
    elevation(f) {
      const { l, r, z0, top } = f;
      const I = FRONT_INSET;
      const c = (l + r) / 2;
      const panel = top - PANEL * 1000;
      const stand = cabinet ? standHeight(f.item.height, 1000) : 0;
      const doorZ0 = cabinet ? z0 + stand + I / 4 : z0 + FEET * 0.6;
      if (cabinet) {
        // The base cabinet's door with its handle and the joint under the machine.
        f.box("detail", l + I / 4, r - I / 4, z0 + FEET * 0.6, z0 + stand - I / 4);
        f.line("detail", [c - I * 3, z0 + stand - I * 2], [c + I * 3, z0 + stand - I * 2]);
      }
      f.box("detail", l + I / 4, r - I / 4, doorZ0, panel - I / 4);
      f.line("detail", [c - I * 3, panel - I * 1.5], [c + I * 3, panel - I * 1.5]);
      f.box("detail", l + I / 4, r - I / 4, panel, top - I / 4);
      f.box("detail", l + I, l + I * 4, panel + I / 2, top - I / 2);
      f.circle("detail", r - I * 1.5, (panel + top) / 2, I / 3);
    },
    mesh(p, s) {
      if (!cabinet) {
        frontLoader(p, s, 0);
        return;
      }
      // The base cabinet: a plain body on feet with one door, the machine standing on it.
      const stand = standHeight(s.h, 1);
      const zf = s.d / 2;
      machineFeet(p, s.w, s.d, zf - DOOR);
      p.roundedBox("steel", -s.w / 2, s.w / 2, PLINTH, stand, -s.d / 2, zf - DOOR, BODY_RADIUS, "vertical");
      doors(p, -s.w / 2, s.w / 2, PLINTH, stand, s.d, 1, "top");
      frontLoader(p, s, stand);
    },
  };
}

export const undercounterDishwasher = makeFrontLoader("undercounterDishwasher", false);
export const frontLoaderCabinet = makeFrontLoader("frontLoaderCabinet", true);
