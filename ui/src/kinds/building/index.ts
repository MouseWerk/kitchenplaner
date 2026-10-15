import type { Area } from "../types";
import { column, columnClad, columnRound } from "./column";
import { drainChannel } from "./drainChannel";
import { duct } from "./duct";
import { entries } from "./entries";
import { floorBox } from "./floorBox";
import { floorDrain } from "./floorDrain";
import { floorGully, floorGullyBucket } from "./floorGully";
import { greaseSeparator } from "./greaseSeparator";
import { cornerGuard, wallGuardRail } from "./guards";
import { mediaColumn } from "./mediaColumn";
import { platform } from "./platform";
import { shaft } from "./shaft";
import { socketPanel } from "./socketPanel";
import { distributionBoard, exitSign, fireBlanket, fireExtinguisher, gasShutoffBox, radiator, waterHeater } from "./wallFixtures";
import { greaseTrapCompact, liftingStation } from "./wasteWater";
import { waterConnection } from "./waterConnection";

export const building: Area = {
  entries,
  kinds: [
    column,
    columnRound,
    shaft,
    floorDrain,
    drainChannel,
    greaseSeparator,
    socketPanel,
    waterConnection,
    duct,
    platform,
    floorGully,
    floorGullyBucket,
    greaseTrapCompact,
    liftingStation,
    distributionBoard,
    gasShutoffBox,
    fireExtinguisher,
    fireBlanket,
    exitSign,
    wallGuardRail,
    cornerGuard,
    columnClad,
    mediaColumn,
    floorBox,
    radiator,
    waterHeater,
  ],
};
