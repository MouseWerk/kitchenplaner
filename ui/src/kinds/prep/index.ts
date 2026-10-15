import type { Area } from "../types";
import { cabinet } from "./cabinet";
import { cabinetDrawers } from "./cabinetDrawers";
import { cabinetIsland } from "./cabinetIsland";
import { cabinetSliding } from "./cabinetSliding";
import { cornerTableLeft, cornerTableRight } from "./cornerTable";
import { cutter } from "./cutter";
import { doughSheeter } from "./doughSheeter";
import { drawers } from "./drawers";
import { entries } from "./entries";
import { heatedCabinet } from "./heatedCabinet";
import { mincer } from "./mincer";
import { mixerFloor, mixerTable } from "./mixer";
import { mobileTable } from "./mobileTable";
import { peeler } from "./peeler";
import { benchScale, platformScale } from "./scale";
import { slicer } from "./slicer";
import { tableDrawer } from "./tableDrawer";
import { tableSink } from "./tableSink";
import { vacuumFloor, vacuumTable } from "./vacuumPacker";
import { vegCutter } from "./vegCutter";
import { wallTable } from "./wallTable";
import { wallTableOpen } from "./wallTableOpen";
import { worktable } from "./worktable";
import { stickBlender } from "./stickBlender";
import { bowlCutter } from "./bowlCutter";
import { spiralMixer } from "./spiralMixer";
import { dividerRounder } from "./dividerRounder";
import { breadSlicer } from "./breadSlicer";
import { proofer } from "./proofer";
import { tenderiser } from "./tenderiser";
import { boneSaw } from "./boneSaw";
import { burgerPress } from "./burgerPress";
import { vacuumTumbler } from "./vacuumTumbler";
import { sauceDispenser } from "./sauceDispenser";
import { cookingBlender } from "./cookingBlender";
import { juicer } from "./juicer";
import { iceShaver } from "./iceShaver";
import { temperingMachine } from "./temperingMachine";
import { pastaMachine } from "./pastaMachine";
import { labelScale } from "./labelScale";
import { labelPrinter } from "./labelPrinter";
import { stoneTable } from "./stoneTable";
import { pastryTable } from "./pastryTable";
import { butcherBlock } from "./butcherBlock";
import { cuttingTable } from "./cuttingTable";
import { gnTable } from "./gnTable";
import { tableHandwash } from "./tableHandwash";
import { mobileGnTable } from "./mobileGnTable";
import { prepTrolley } from "./prepTrolley";
import { machineStand } from "./machineStand";
import { boardRack } from "./boardRack";

export const prep: Area = {
  entries,
  kinds: [
    worktable,
    wallTable,
    wallTableOpen,
    tableDrawer,
    tableSink,
    cornerTableLeft,
    cornerTableRight,
    mobileTable,
    cabinet,
    cabinetIsland,
    cabinetSliding,
    cabinetDrawers,
    drawers,
    heatedCabinet,
    stoneTable,
    pastryTable,
    butcherBlock,
    cuttingTable,
    gnTable,
    tableHandwash,
    mobileGnTable,
    prepTrolley,
    machineStand,
    boardRack,
    vegCutter,
    slicer,
    mixerTable,
    mixerFloor,
    mincer,
    cutter,
    vacuumTable,
    vacuumFloor,
    benchScale,
    platformScale,
    doughSheeter,
    peeler,
    stickBlender,
    bowlCutter,
    spiralMixer,
    dividerRounder,
    breadSlicer,
    proofer,
    tenderiser,
    boneSaw,
    burgerPress,
    vacuumTumbler,
    sauceDispenser,
    cookingBlender,
    juicer,
    iceShaver,
    temperingMachine,
    pastaMachine,
    labelScale,
    labelPrinter,
  ],
};
