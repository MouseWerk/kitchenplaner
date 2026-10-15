import type { Area } from "../types";
import { bainMarie } from "./bainMarie";
import { brattPan, teppanyaki } from "./brattPan";
import { charbroiler } from "./charbroiler";
import { chargrill } from "./chargrill";
import { combiOven, convectionOven, holdingCabinet, microwave, steamerTable } from "./combiOven";
import { contactGrill, waffleIron } from "./contactGrill";
import { cookHold1, cookHold2, smoker } from "./cookHold";
import { deckOven1, deckOven2 } from "./deckOven";
import { entries } from "./entries";
import { fryer, fryerSingle } from "./fryer";
import { griddle, griddleChrome, griddleRibbed } from "./griddle";
import { crepeMaker, griddleTable, inductionGriddle } from "./griddleTable";
import { induction, inductionOpen } from "./induction";
import { kettle, kettleIndirect, kettleMixer } from "./kettle";
import { hobCover, lineBridge, lineOvershelf } from "./lineBridge";
import { lineCabinet, lineHeatedCabinet, lineNeutral } from "./lineElements";
import { multiCooker } from "./multiCooker";
import { multiPan } from "./multiPan";
import { pastaCooker } from "./pastaCooker";
import { conveyorOven, domeOven, rotatingOven } from "./pizzaOven";
import { range, rangeOpen } from "./range";
import { donerGrill, rotisserie } from "./rotisserie";
import { salamander, salamanderLift } from "./salamander";
import { solidTop } from "./solidTop";
import { steamer } from "./steamer";
import { conveyorToaster, eggBoiler, riceCooker, sousVide, wokTable } from "./tableUnits";
import { tandoor } from "./tandoor";
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
    charbroiler,
    teppanyaki,
    brattPan,
    salamander,
    salamanderLift,
    kettle,
    kettleIndirect,
    kettleMixer,
    tiltingPan,
    pressurePan,
    multiPan,
    multiCooker,
    combiOven,
    convectionOven,
    holdingCabinet,
    steamerTable,
    microwave,
    cookHold1,
    cookHold2,
    smoker,
    deckOven1,
    deckOven2,
    conveyorOven,
    domeOven,
    rotatingOven,
    rotisserie,
    donerGrill,
    tandoor,
    steamer,
    griddleTable,
    inductionGriddle,
    crepeMaker,
    wokTable,
    contactGrill,
    waffleIron,
    conveyorToaster,
    eggBoiler,
    riceCooker,
    sousVide,
    lineNeutral,
    lineCabinet,
    lineHeatedCabinet,
    lineBridge,
    lineOvershelf,
    hobCover,
  ],
};
