import type { Area } from "../types";
import { backBarCooler } from "./backBarCooler";
import { blastChiller, blastChillerTop } from "./blastChiller";
import { blastChillerRollIn, freezerRollIn, fridgeRollIn } from "./blastChillerRollIn";
import { bottleCooler, slidingDoorCooler } from "./bottleCooler";
import { chefBase, chefBaseHeavy } from "./chefBase";
import { chestFreezer, iceCreamConservator } from "./chestFreezer";
import { chilledDisplayTop } from "./chilledDisplayTop";
import { coldPass } from "./coldPass";
import { coldRoom, coldRoomGlass, freezerRoom } from "./coldRoom";
import { coldRoomDoor, freezerRoomDoor } from "./coldRoomDoor";
import { condensingUnit } from "./condensingUnit";
import { counterDrawers, counterFreezer, counterFridge } from "./counterFridge";
import { entries } from "./entries";
import { iceDispenser, waterCooler } from "./dispenser";
import { doughRetarder } from "./doughRetarder";
import { freezer, fridge, fridgeGlass, fridgeHalf } from "./fridge";
import { gnColdWell, gnColdWellDropIn } from "./gnColdWell";
import { iceBin, iceMachine } from "./iceMachine";
import { iceCreamDisplay } from "./iceCreamDisplay";
import { multideck } from "./multideck";
import { fridgePassThrough } from "./passThrough";
import { pizzaPrep } from "./pizzaPrep";
import { saladette } from "./saladette";
import { fridgeFish, meatAgingCabinet } from "./specialtyCabinet";
import { wineCabinet } from "./wineCabinet";
import { underCounterFreezer, underCounterFridge } from "./underCounterFridge";

export const cooling: Area = {
  entries,
  kinds: [
    fridge,
    freezer,
    fridgeHalf,
    fridgeGlass,
    underCounterFridge,
    underCounterFreezer,
    counterFridge,
    counterFreezer,
    counterDrawers,
    chefBase,
    saladette,
    pizzaPrep,
    gnColdWell,
    blastChiller,
    blastChillerRollIn,
    iceMachine,
    bottleCooler,
    multideck,
    coldRoom,
    freezerRoom,
    coldRoomDoor,
    fridgeRollIn,
    freezerRollIn,
    fridgePassThrough,
    fridgeFish,
    meatAgingCabinet,
    doughRetarder,
    wineCabinet,
    slidingDoorCooler,
    backBarCooler,
    iceCreamDisplay,
    chestFreezer,
    iceCreamConservator,
    chilledDisplayTop,
    coldPass,
    chefBaseHeavy,
    iceDispenser,
    iceBin,
    waterCooler,
    condensingUnit,
    coldRoomGlass,
    freezerRoomDoor,
    gnColdWellDropIn,
    blastChillerTop,
  ],
};
