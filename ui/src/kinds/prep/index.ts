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
  ],
};
