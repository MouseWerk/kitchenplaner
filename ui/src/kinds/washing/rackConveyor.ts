// Rack conveyor dishwasher (Korbtransportspülmaschine): racks travel from left to right through a
// tunnel with a pre-wash, a wash and a rinse zone, the longer machines with a drying zone at the
// outlet. The zones grow with the machine's length; the dish tables join at both open ends.

import { flowArrow, tunnelFront, tunnelHousing, tunnelPlan } from "./common";
import type { KindDef } from "../types";

/** Length of the drying zone (mm). */
const DRYER = 600;
/** Shares of pre-wash, wash and rinse zone in the rest of the length. */
const ZONE_SHARES = [0.3, 0.4, 0.3];
/** The zone that carries the control panel: the wash zone. */
const PANEL_ZONE = 1;

/** Zone lengths from the left (mm). */
function zones(w: number, dryer: boolean): number[] {
  const dry = dryer ? Math.min(DRYER, w * 0.25) : 0;
  const out = ZONE_SHARES.map((share) => (w - dry) * share);
  return dryer ? [...out, dry] : out;
}

function makeRackConveyor(kind: string, dryer: boolean): KindDef {
  return {
    kind,
    plan(s) {
      tunnelPlan(s, s.L, zones(s.w, dryer));
      flowArrow(s, s.L + s.w * 0.2, s.R - s.w * 0.2, s.d / 4, "right");
    },
    elevation(f) {
      tunnelFront(f, f.l, f.r, zones(f.w, dryer), PANEL_ZONE);
    },
    mesh(p, s) {
      tunnelHousing(
        p,
        s,
        -s.w / 2,
        s.w / 2,
        zones(s.w * 1000, dryer).map((z) => z / 1000),
        PANEL_ZONE,
      );
    },
  };
}

export const rackConveyor = makeRackConveyor("rackConveyor", false);
export const rackConveyorDryer = makeRackConveyor("rackConveyorDryer", true);
