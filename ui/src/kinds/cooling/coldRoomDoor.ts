// Walk-in door units (Kühlzellentür, Tiefkühlzellentür): a front panel element with the hinged
// insulated door, for a cold or freezer room built into a room or closed with masonry. The door
// and its swing match the cold room; the freezer room door has the thicker panel and the frost
// mark.

import { frostPlan } from "../parts/frost";
import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { COLD_PANEL_MM, DOOR_ZONE_MM, doorSpan, FREEZER_PANEL_MM, walkInFront, walkInFrontElevation } from "./coldRoom";
import { m } from "./common";

/** Radius of the snowflake in the plan of a freezer room door (mm). */
const FROST_PLAN_MM = 60;

function doorUnit(kind: string, panelMm: number, freezer: boolean): KindDef {
  return {
    kind,
    plan(s) {
      const face = s.F - Math.min(DOOR_ZONE_MM, s.d / 2);
      const { x0, x1 } = doorSpan(s.w, panelMm);
      s.line("detail", [s.L, face], [x0, face]);
      s.line("detail", [x1, face], [s.R, face]);
      s.line("detail", [x0, s.B], [x0, face]);
      s.line("detail", [x1, s.B], [x1, face]);
      // The threshold across the opening, then the leaf drawn open with its swing.
      s.line("detail", [x0, s.B + INSET / 2], [x1, s.B + INSET / 2]);
      s.line("opening", [x0, s.F], [x0, s.F + (x1 - x0)]);
      s.quarter("swing", x0, s.F, x1 - x0, 0);
      if (freezer) frostPlan(s, (x1 + s.R) / 2, (s.B + face) / 2, FROST_PLAN_MM);
    },
    elevation(f) {
      walkInFrontElevation(f, panelMm, freezer);
    },
    mesh(p, s) {
      const zFace = s.d / 2 - m(Math.min(DOOR_ZONE_MM, (s.d * 1000) / 2));
      walkInFront(p, s, panelMm, { xa: -s.w / 2, xb: s.w / 2, yTop: s.h, zIn: -s.d / 2, zFace, zFront: s.d / 2 }, freezer);
    },
  };
}

export const coldRoomDoor = doorUnit("coldRoomDoor", COLD_PANEL_MM, false);
export const freezerRoomDoor = doorUnit("freezerRoomDoor", FREEZER_PANEL_MM, true);
