import type { Area } from "../types";
import { backBar, barCounter, beerCooler, cocktailStation, draughtColumn, glassFroster, iceWell, juiceDispenser } from "./bar";
import { buffetCold, buffetHot, buffetNeutral } from "./buffet";
import { coffeeGrinder, cupWarmer, espressoMachine, filterCoffee, hotWaterDispenser, knockBoxModule, milkCooler } from "./coffee";
import { cutleryDispenser, frozenYoghurt, softServe, trayStand } from "./selfService";
import { carvingLamp, chafingDish, displayWarmer, holdingDrawers, soupKettle } from "./warmers";
import { beverageCounter } from "./beverageCounter";
import { carvingStation } from "./carvingStation";
import { cashDesk } from "./cashDesk";
import { coldCounter } from "./coldCounter";
import { cutleryStation } from "./cutleryStation";
import { entries } from "./entries";
import { foodCounter } from "./foodCounter";
import { hatchWarmer } from "./hatchWarmer";
import { heatLamp } from "./heatLamp";
import { heatLampPendant } from "./heatLampPendant";
import { hotCupboard } from "./hotCupboard";
import { passCounter } from "./passCounter";
import { plateDispenser, plateDispenserHeated } from "./plateDispenser";
import { saladBar } from "./saladBar";
import { soupStation } from "./soupStation";
import { traySlide } from "./traySlide";
import { trayDispenser } from "./trayDispenser";
import { waiterStation } from "./waiterStation";

export const serving: Area = {
  entries,
  kinds: [
    passCounter,
    heatLamp,
    heatLampPendant,
    foodCounter,
    coldCounter,
    hotCupboard,
    hatchWarmer,
    plateDispenser,
    plateDispenserHeated,
    trayDispenser,
    traySlide,
    saladBar,
    cutleryStation,
    carvingStation,
    soupStation,
    beverageCounter,
    cashDesk,
    waiterStation,
    buffetHot,
    buffetCold,
    buffetNeutral,
    soupKettle,
    chafingDish,
    carvingLamp,
    displayWarmer,
    holdingDrawers,
    espressoMachine,
    coffeeGrinder,
    filterCoffee,
    hotWaterDispenser,
    milkCooler,
    cupWarmer,
    knockBoxModule,
    barCounter,
    draughtColumn,
    beerCooler,
    glassFroster,
    iceWell,
    cocktailStation,
    backBar,
    juiceDispenser,
    cutleryDispenser,
    trayStand,
    softServe,
    frozenYoghurt,
  ],
};
