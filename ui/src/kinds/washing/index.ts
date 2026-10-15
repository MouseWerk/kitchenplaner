import type { Area } from "../types";
import { bootWasher } from "./bootWasher";
import { cleaningStation, cleaningTrolley, dosingStation } from "./cleaning";
import { cornerSinkLeft, cornerSinkRight } from "./cornerSink";
import { cutleryPolisher } from "./cutleryPolisher";
import { disinfectionDispenser, disinfectionStand } from "./disinfection";
import { dishCornerTable } from "./dishCornerTable";
import { dishInletTable, dishInletTableLeft } from "./dishInletTable";
import { dishOutletTable, dishOutletTableRight } from "./dishOutletTable";
import { dishReturnBelt } from "./dishReturnBelt";
import { dishwasher } from "./dishwasher";
import { entries } from "./entries";
import { eyeWashStation } from "./eyeWashStation";
import { flightDishwasher } from "./flightDishwasher";
import { granulateWasher } from "./granulateWasher";
import { handwash, handwashKnee, handwashStation } from "./handwash";
import { handwashPedal } from "./handwashPedal";
import { mopSink } from "./mopSink";
import { potWasher } from "./potWasher";
import { preRinseUnit } from "./preRinseUnit";
import { rackConveyor, rackConveyorDryer } from "./rackConveyor";
import { rackTrolley } from "./rackTrolley";
import { potSink, sink, sinkCentre, sinkDrainerRight, sinkThree } from "./sink";
import { sortingTable, sortingTableLeft } from "./sortingTable";
import { trayWasher } from "./trayWasher";
import { cutlerySoakTrolley, rackDispenser, trayReturnTrolley } from "./trolleys";
import { ultrasonicTank } from "./ultrasonicTank";
import { frontLoaderCabinet, undercounterDishwasher } from "./undercounterDishwasher";
import { vegetableWasher } from "./vegetableWasher";
import { wastePulper } from "./wastePulper";
import { wasteStation } from "./wasteStation";
import { waterSoftener } from "./waterSoftener";

export const washing: Area = {
  entries,
  kinds: [
    sink,
    sinkDrainerRight,
    sinkThree,
    potSink,
    sinkCentre,
    cornerSinkLeft,
    cornerSinkRight,
    handwash,
    handwashKnee,
    handwashStation,
    handwashPedal,
    mopSink,
    preRinseUnit,
    dishwasher,
    undercounterDishwasher,
    frontLoaderCabinet,
    rackConveyor,
    rackConveyorDryer,
    flightDishwasher,
    trayWasher,
    potWasher,
    granulateWasher,
    dishInletTable,
    dishInletTableLeft,
    dishOutletTable,
    dishOutletTableRight,
    dishCornerTable,
    sortingTable,
    sortingTableLeft,
    rackTrolley,
    rackDispenser,
    trayReturnTrolley,
    cutlerySoakTrolley,
    cutleryPolisher,
    dishReturnBelt,
    wasteStation,
    wastePulper,
    ultrasonicTank,
    vegetableWasher,
    disinfectionDispenser,
    disinfectionStand,
    eyeWashStation,
    cleaningStation,
    dosingStation,
    cleaningTrolley,
    bootWasher,
    waterSoftener,
  ],
};
