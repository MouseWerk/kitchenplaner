import type { Area } from "../types";
import { blastChiller } from "./blastChiller";
import { blastChillerRollIn } from "./blastChillerRollIn";
import { bottleCooler } from "./bottleCooler";
import { chefBase } from "./chefBase";
import { coldRoom, freezerRoom } from "./coldRoom";
import { coldRoomDoor } from "./coldRoomDoor";
import { counterDrawers, counterFridge } from "./counterFridge";
import { entries } from "./entries";
import { fridge, fridgeGlass, fridgeHalf } from "./fridge";
import { gnColdWell } from "./gnColdWell";
import { iceMachine } from "./iceMachine";
import { multideck } from "./multideck";
import { pizzaPrep } from "./pizzaPrep";
import { saladette } from "./saladette";
import { underCounterFridge } from "./underCounterFridge";

export const cooling: Area = {
  entries,
  kinds: [
    fridge,
    fridgeHalf,
    fridgeGlass,
    underCounterFridge,
    counterFridge,
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
