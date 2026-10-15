import type { Area } from "../types";
import { breadRack } from "./breadRack";
import { cleaningCabinet, cutleryCabinet, linenCabinet, locker } from "./cabinets";
import { dunnageRack } from "./dunnageRack";
import { entries } from "./entries";
import { gnShelving } from "./gnShelving";
import { ingredientBin } from "./ingredientBin";
import { knifeBar } from "./knifeBar";
import { mobileShelving } from "./mobileShelving";
import { plateRackWall, plateTrolley, potRackWall } from "./plateRacks";
import { rackTrolley15, rackTrolley20, trayRack } from "./rackTrolley";
import { coldRoomShelving, shelving, shelving5, shelvingCorner, shelvingPerforated, shelvingSlatted } from "./shelving";
import { tallCabinet } from "./tallCabinet";
import { crateDolly, crates, euroPallet, sackTruck } from "./transport";
import { utensilRail } from "./utensilRail";
import { wallCabinet } from "./wallCabinet";
import { wallShelf, wallShelfDouble } from "./wallShelf";
import { wineRack } from "./wineRack";

export const storage: Area = {
  entries,
  kinds: [
    shelving,
    shelving5,
    shelvingPerforated,
    shelvingSlatted,
    shelvingCorner,
    dunnageRack,
    rackTrolley15,
    rackTrolley20,
    wallShelf,
    wallShelfDouble,
    wallCabinet,
    tallCabinet,
    ingredientBin,
    utensilRail,
    knifeBar,
    mobileShelving,
    coldRoomShelving,
    gnShelving,
    wineRack,
    breadRack,
    trayRack,
    plateTrolley,
    plateRackWall,
    potRackWall,
    cutleryCabinet,
    cleaningCabinet,
    locker,
    linenCabinet,
    euroPallet,
    crates,
    crateDolly,
    sackTruck,
  ],
};
