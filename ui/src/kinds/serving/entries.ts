// Serving: food distribution and pass counters (sidebar group "serving"). Sizes and connection
// values are typical starting points of the trade, not a manufacturer's data.

import type { Connections } from "../../model/types";
import { withVariants } from "../parts/entries";
import { WORK_HEIGHT } from "../parts/sizes";
import type { CatalogEntry } from "../types";
import { dispenserXs } from "./beverageCounter";
import { wellCount } from "./common";
import { lampCount } from "./heatLampPendant";
import { tubes } from "./plateDispenser";
import { kettleXs } from "./soupStation";

/** Usual lower edge of a heat lamp over a pass (mm): about 550 mm over the counter top. */
const HEAT_LAMP_ELEVATION = 1450;
/** Lower edge of a pass-through cabinet in a hatch (mm): the counter height under the hatch. */
const HATCH_ELEVATION = 900;
/** Height of a tray slide's tubes: just under the counter top it is fixed to (mm). */
const TRAY_SLIDE_ELEVATION = 820;

/** Power rounded to tens of watts (kW). */
const kw = (v: number) => Math.round(v * 100) / 100;
/** Electric connection on 230 V up to 3.6 kW (16 A), above that on 400 V. */
const electric = (v: number): Connections => ({ electricKw: kw(v), voltage: v > 3.6 ? 400 : 230 });

export const entries: readonly CatalogEntry[] = [
  withVariants(
    { id: "pass-counter", kind: "passCounter", category: "serving", name: "cat.passCounter", description: "catDesc.passCounter", width: 1600, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1600, 2000], tags: ["pass", "ausgabe", "wärmeplatte", "glaskeramik", "heated pass", "durchgabe"] },
    ({ width }) => electric((width / 1600) * 2),
  ),
  withVariants(
    { id: "heat-lamp-bridge", kind: "heatLamp", category: "serving", name: "cat.heatLampBridge", description: "catDesc.heatLampBridge", width: 1500, depth: 300, height: 400, elevation: HEAT_LAMP_ELEVATION, widths: [600, 900, 1200, 1500, 1800], tags: ["wärmebrücke", "infrarot", "heat lamp", "wärmestrahler", "pass", "gantry"] },
    ({ width }) => electric((width / 1000) * 0.8),
  ),
  withVariants(
    { id: "heat-lamp-pendant", kind: "heatLampPendant", category: "serving", name: "cat.heatLampPendant", description: "catDesc.heatLampPendant", width: 600, depth: 200, height: 800, elevation: 1500, widths: [300, 600, 900], tags: ["wärmelampe", "pendel", "infrarot", "heat lamp", "pendant"] },
    ({ width }) => electric(lampCount(width) * 0.25),
  ),
  withVariants(
    { id: "food-counter-hot", kind: "foodCounter", category: "serving", name: "cat.foodCounterHot", description: "catDesc.foodCounterHot", width: 1500, depth: 800, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1500, 1900, 2300], tags: ["bain-marie", "wasserbad", "warmhaltetheke", "speisenausgabe", "gn", "hot well", "food counter", "spuckschutz", "sneeze guard"] },
    ({ width }) => ({ ...electric(wellCount(width) * 1.1), coldWater: true, drain: true }),
  ),
  withVariants(
    { id: "cold-counter", kind: "coldCounter", category: "serving", name: "cat.coldCounter", description: "catDesc.coldCounter", width: 1500, depth: 800, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1500, 1900], tags: ["kühlvitrine", "kalte ausgabe", "kühltheke", "salat", "dessert", "cold display", "refrigerated counter", "gn"] },
    ({ width }) => ({ ...electric(0.5 + wellCount(width) * 0.1), drain: true }),
  ),
  withVariants(
    { id: "hot-cupboard", kind: "hotCupboard", category: "serving", name: "cat.hotCupboard", description: "catDesc.hotCupboard", width: 1500, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1500, 1800, 2000], tags: ["wärmeschrank", "speisenwärmeschrank", "tellerwärmer", "schiebetüren", "hot cupboard", "plate warmer"] },
    ({ width }) => electric((width / 1500) * 2),
  ),
  withVariants(
    { id: "hatch-warmer", kind: "hatchWarmer", category: "serving", name: "cat.hatchWarmer", description: "catDesc.hatchWarmer", width: 800, depth: 400, height: 700, elevation: HATCH_ELEVATION, widths: [600, 800, 1000, 1200], tags: ["durchreiche", "wärmeschrank", "warmhalteschrank", "pass-through", "hatch", "glastüren"] },
    ({ width }) => electric((width / 800) * 1.2),
  ),
  { id: "plate-dispenser", kind: "plateDispenser", category: "serving", name: "cat.plateDispenser", description: "catDesc.plateDispenser", width: 840, depth: 470, height: WORK_HEIGHT, elevation: 0, widths: [470, 840, 1240], tags: ["tellerspender", "tellerstapler", "fahrbar", "plate dispenser", "mobile"], connections: {} },
  withVariants(
    { id: "plate-dispenser-heated", kind: "plateDispenserHeated", category: "serving", name: "cat.plateDispenserHeated", description: "catDesc.plateDispenserHeated", width: 840, depth: 470, height: WORK_HEIGHT, elevation: 0, widths: [470, 840, 1240], tags: ["tellerspender", "tellerwärmer", "beheizt", "fahrbar", "plate dispenser", "heated", "mobile"] },
    ({ width }) => electric(tubes(width) * 0.9),
  ),
  { id: "tray-dispenser", kind: "trayDispenser", category: "serving", name: "cat.trayDispenser", description: "catDesc.trayDispenser", width: 620, depth: 440, height: WORK_HEIGHT, elevation: 0, tags: ["tablettspender", "tablettwagen", "fahrbar", "tray dispenser", "mobile"], connections: {} },
  { id: "tray-slide", kind: "traySlide", category: "serving", name: "cat.traySlide", description: "catDesc.traySlide", width: 1500, depth: 300, height: 80, elevation: TRAY_SLIDE_ELEVATION, widths: [1200, 1500, 1900, 2300], tags: ["tablettrutsche", "tablettbahn", "rohre", "tray slide", "tray rail"], connections: {} },
  withVariants(
    { id: "salad-bar", kind: "saladBar", category: "serving", name: "cat.saladBar", description: "catDesc.saladBar", width: 1500, depth: 900, height: WORK_HEIGHT, elevation: 0, widths: [1100, 1500, 1900], tags: ["salatbar", "buffet", "gekühlt", "fahrbar", "spuckschutz", "salad bar", "sneeze guard", "gn 1/2"] },
    ({ width }) => ({ ...electric((width / 1500) * 0.6), drain: true }),
  ),
  { id: "cutlery-station", kind: "cutleryStation", category: "serving", name: "cat.cutleryStation", description: "catDesc.cutleryStation", width: 800, depth: 600, height: WORK_HEIGHT, elevation: 0, widths: [600, 800, 1000], tags: ["besteck", "tablett", "servietten", "besteckköcher", "cutlery", "tray", "napkins"], connections: {} },
  withVariants(
    { id: "carving-station", kind: "carvingStation", category: "serving", name: "cat.carvingStation", description: "catDesc.carvingStation", width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [800, 1200, 1600], tags: ["tranchierstation", "schneidbrett", "wärmebrücke", "braten", "carving", "heat lamp"] },
    ({ width }) => electric((width / 1200) * 1.6),
  ),
  withVariants(
    { id: "soup-station", kind: "soupStation", category: "serving", name: "cat.soupStation", description: "catDesc.soupStation", width: 800, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [400, 800, 1200], tags: ["suppe", "suppenkessel", "suppenstation", "bain-marie", "soup", "soup kettle"] },
    ({ width }) => electric(kettleXs(width).length * 0.8),
  ),
  withVariants(
    { id: "beverage-counter", kind: "beverageCounter", category: "serving", name: "cat.beverageCounter", description: "catDesc.beverageCounter", width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1600], tags: ["getränke", "getränkespender", "saft", "wasser", "beverage", "drinks", "dispenser"] },
    ({ width }) => ({ ...electric(dispenserXs(width).length * 0.4), coldWater: true, drain: true }),
  ),
  withVariants(
    { id: "cash-desk", kind: "cashDesk", category: "serving", name: "cat.cashDesk", description: "catDesc.cashDesk", width: 1000, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [800, 1000, 1200], tags: ["kasse", "kassenmodul", "kassentheke", "checkout", "till", "cash desk"] },
    () => electric(0.3),
  ),
  { id: "waiter-station", kind: "waiterStation", category: "serving", name: "cat.waiterStation", description: "catDesc.waiterStation", width: 1200, depth: 600, height: 1600, elevation: 0, widths: [800, 1000, 1200, 1600], tags: ["servicestation", "office", "kellnerstation", "besteckschubladen", "waiter station", "side station"], connections: {} },
];
