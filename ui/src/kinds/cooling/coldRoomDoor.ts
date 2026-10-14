// Walk-in door unit (Kühlzellentür): a front panel element with the hinged insulated door, for a
// cold room built into a room or closed with masonry. The door and its swing match the cold room.

import { INSET } from "../parts/plan";
import type { KindDef } from "../types";
import { COLD_PANEL_MM, DOOR_ZONE_MM, doorSpan, walkInFront, walkInFrontElevation } from "./coldRoom";
import { m } from "./common";

export const coldRoomDoor: KindDef = {
  kind: "coldRoomDoor",
  plan(s) {
    const face = s.F - Math.min(DOOR_ZONE_MM, s.d / 2);
    const { x0, x1 } = doorSpan(s.w, COLD_PANEL_MM);
    s.line("detail", [s.L, face], [x0, face]);
    s.line("detail", [x1, face], [s.R, face]);
    s.line("detail", [x0, s.B], [x0, face]);
    s.line("detail", [x1, s.B], [x1, face]);
    // The threshold across the opening, then the leaf drawn open with its swing.
    s.line("detail", [x0, s.B + INSET / 2], [x1, s.B + INSET / 2]);
    s.line("opening", [x0, s.F], [x0, s.F + (x1 - x0)]);
    s.quarter("swing", x0, s.F, x1 - x0, 0);
  },
  elevation(f) {
    walkInFrontElevation(f, COLD_PANEL_MM);
  },
  mesh(p, s) {
    const zFace = s.d / 2 - m(Math.min(DOOR_ZONE_MM, (s.d * 1000) / 2));
    walkInFront(p, s, COLD_PANEL_MM, { xa: -s.w / 2, xb: s.w / 2, yTop: s.h, zIn: -s.d / 2, zFace, zFront: s.d / 2 }, false);
  },
};
