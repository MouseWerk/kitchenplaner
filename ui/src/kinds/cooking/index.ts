import type { Area } from "../types";
import { bainMarie } from "./bainMarie";
import { chargrill } from "./chargrill";
import { combiOven, convectionOven, holdingCabinet } from "./combiOven";
import { deckOven1, deckOven2 } from "./deckOven";
import { entries } from "./entries";
import { fryer, fryerSingle } from "./fryer";
import { griddle, griddleChrome, griddleRibbed } from "./griddle";
import { induction, inductionOpen } from "./induction";
import { kettle, kettleIndirect } from "./kettle";
import { lineCabinet, lineHeatedCabinet, lineNeutral } from "./lineElements";
import { multiPan } from "./multiPan";
import { pastaCooker } from "./pastaCooker";
import { range, rangeOpen } from "./range";
import { salamander } from "./salamander";
import { solidTop } from "./solidTop";
import { steamer } from "./steamer";
import { pressurePan, tiltingPan } from "./tiltingPan";
import { wok } from "./wok";

export const cooking: Area = {
  entries,
  kinds: [
    range,
    rangeOpen,
    solidTop,
    induction,
    inductionOpen,
    wok,
    pastaCooker,
    bainMarie,
    fryer,
    fryerSingle,
    griddle,
    griddleRibbed,
    griddleChrome,
    chargrill,
    salamander,
    kettle,
    kettleIndirect,
    tiltingPan,
    pressurePan,
    multiPan,
    combiOven,
    convectionOven,
    holdingCabinet,
    deckOven1,
    deckOven2,
    steamer,
    lineNeutral,
    lineCabinet,
    lineHeatedCabinet,
  ],
};
