import type { Area } from "../types";
import { blastChiller } from "./blastChiller";
import { blastChillerRollIn } from "./blastChillerRollIn";
import { bottleCooler } from "./bottleCooler";
import { chefBase } from "./chefBase";
import { coldRoom, freezerRoom } from "./coldRoom";
import { coldRoomDoor } from "./coldRoomDoor";
import { counterDrawers, counterFreezer, counterFridge } from "./counterFridge";
import { entries } from "./entries";
import { freezer, fridge, fridgeGlass, fridgeHalf } from "./fridge";
import { gnColdWell } from "./gnColdWell";
import { iceMachine } from "./iceMachine";
import { multideck } from "./multideck";
import { pizzaPrep } from "./pizzaPrep";
import { saladette } from "./saladette";
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
  ],
};
