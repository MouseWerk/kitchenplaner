import type { Area } from "../types";
import { column, columnRound } from "./column";
import { drainChannel } from "./drainChannel";
import { duct } from "./duct";
import { entries } from "./entries";
import { floorDrain } from "./floorDrain";
import { greaseSeparator } from "./greaseSeparator";
import { platform } from "./platform";
import { shaft } from "./shaft";
import { socketPanel } from "./socketPanel";
import { waterConnection } from "./waterConnection";

export const building: Area = {
  entries,
  kinds: [column, columnRound, shaft, floorDrain, drainChannel, greaseSeparator, socketPanel, waterConnection, duct, platform],
};
