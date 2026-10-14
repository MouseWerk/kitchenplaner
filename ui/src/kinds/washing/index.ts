import type { Area } from "../types";
import { dishCornerTable } from "./dishCornerTable";
import { dishInletTable } from "./dishInletTable";
import { dishOutletTable } from "./dishOutletTable";
import { dishwasher } from "./dishwasher";
import { entries } from "./entries";
import { flightDishwasher } from "./flightDishwasher";
import { handwash, handwashKnee, handwashStation } from "./handwash";
import { mopSink } from "./mopSink";
import { potWasher } from "./potWasher";
import { preRinseUnit } from "./preRinseUnit";
import { rackConveyor, rackConveyorDryer } from "./rackConveyor";
import { rackTrolley } from "./rackTrolley";
import { potSink, sink, sinkDrainerRight, sinkThree } from "./sink";
import { sortingTable } from "./sortingTable";
import { undercounterDishwasher } from "./undercounterDishwasher";
import { wasteStation } from "./wasteStation";

export const washing: Area = {
  entries,
  kinds: [
    sink,
    sinkDrainerRight,
    sinkThree,
    potSink,
    handwash,
    handwashKnee,
    handwashStation,
    mopSink,
    preRinseUnit,
    dishwasher,
    undercounterDishwasher,
    rackConveyor,
    rackConveyorDryer,
    flightDishwasher,
    potWasher,
    dishInletTable,
    dishOutletTable,
    dishCornerTable,
    sortingTable,
    rackTrolley,
    wasteStation,
  ],
};
