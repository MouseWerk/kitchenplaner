// Serving: food distribution and pass counters, buffet islands and table-top warmers, the coffee
// bar, the bar and self-service (sidebar group "serving"). Sizes and connection values are
// typical starting points of the trade, not a manufacturer's data.

import type { Connections } from "../../model/types";
import { withVariants } from "../parts/entries";
import { WORK_HEIGHT } from "../parts/sizes";
import type { CatalogEntry } from "../types";
import { juiceBowls } from "./bar";
import { dispenserXs } from "./beverageCounter";
import { groupCount } from "./coffee";
import { wellCount } from "./common";
import { lampCount } from "./heatLampPendant";
import { tubes } from "./plateDispenser";
import { kettleXs } from "./soupStation";
import { chafingCount } from "./warmers";

/** Usual lower edge of a heat lamp over a pass (mm): about 550 mm over the counter top. */
const HEAT_LAMP_ELEVATION = 1450;
/** Lower edge of a pass-through cabinet in a hatch (mm): the counter height under the hatch. */
const HATCH_ELEVATION = 900;
/** Height of a tray slide's tubes: just under the counter top it is fixed to (mm). */
const TRAY_SLIDE_ELEVATION = 820;

/** Lower edge of units standing on a counter (mm): the counter's top. */
const ON_COUNTER = WORK_HEIGHT;

/** Power rounded to tens of watts (kW). */
const kw = (v: number) => Math.round(v * 100) / 100;
/** Electric connection on 230 V up to 3.6 kW (16 A), above that on 400 V. */
const electric = (v: number): Connections => ({ electricKw: kw(v), voltage: v > 3.6 ? 400 : 230 });

export const entries: readonly CatalogEntry[] = [
  withVariants(
    { id: "pass-counter", kind: "passCounter", category: "serving", group: "serveCounters", name: "cat.passCounter", description: "catDesc.passCounter", width: 1600, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1600, 2000], tags: ["pass", "ausgabe", "wärmeplatte", "glaskeramik", "heated pass", "durchgabe"] },
    ({ width }) => electric((width / 1600) * 2),
  ),
  withVariants(
    { id: "heat-lamp-bridge", kind: "heatLamp", category: "serving", group: "serveCounters", name: "cat.heatLampBridge", description: "catDesc.heatLampBridge", width: 1500, depth: 300, height: 400, elevation: HEAT_LAMP_ELEVATION, widths: [600, 900, 1200, 1500, 1800], tags: ["wärmebrücke", "infrarot", "heat lamp", "wärmestrahler", "pass", "gantry"] },
    ({ width }) => electric((width / 1000) * 0.8),
  ),
  withVariants(
    { id: "heat-lamp-pendant", kind: "heatLampPendant", category: "serving", group: "serveCounters", name: "cat.heatLampPendant", description: "catDesc.heatLampPendant", width: 600, depth: 200, height: 800, elevation: 1500, widths: [300, 600, 900], tags: ["wärmelampe", "pendel", "infrarot", "heat lamp", "pendant"] },
    ({ width }) => electric(lampCount(width) * 0.25),
  ),
  withVariants(
    { id: "food-counter-hot", kind: "foodCounter", category: "serving", group: "serveCounters", name: "cat.foodCounterHot", description: "catDesc.foodCounterHot", width: 1500, depth: 800, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1500, 1900, 2300], tags: ["bain-marie", "wasserbad", "warmhaltetheke", "speisenausgabe", "gn", "hot well", "food counter", "spuckschutz", "sneeze guard"] },
    ({ width }) => ({ ...electric(wellCount(width) * 1.1), coldWater: true, drain: true }),
  ),
  withVariants(
    { id: "cold-counter", kind: "coldCounter", category: "serving", group: "serveCounters", name: "cat.coldCounter", description: "catDesc.coldCounter", width: 1500, depth: 800, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1500, 1900], tags: ["kühlvitrine", "kalte ausgabe", "kühltheke", "salat", "dessert", "cold display", "refrigerated counter", "gn"] },
    ({ width }) => ({ ...electric(0.5 + wellCount(width) * 0.1), drain: true }),
  ),
  withVariants(
    { id: "hot-cupboard", kind: "hotCupboard", category: "serving", group: "serveCounters", name: "cat.hotCupboard", description: "catDesc.hotCupboard", width: 1500, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1500, 1800, 2000], tags: ["wärmeschrank", "speisenwärmeschrank", "tellerwärmer", "schiebetüren", "hot cupboard", "plate warmer"] },
    ({ width }) => electric((width / 1500) * 2),
  ),
  withVariants(
    { id: "hatch-warmer", kind: "hatchWarmer", category: "serving", group: "serveCounters", name: "cat.hatchWarmer", description: "catDesc.hatchWarmer", width: 800, depth: 400, height: 700, elevation: HATCH_ELEVATION, widths: [600, 800, 1000, 1200], tags: ["durchreiche", "wärmeschrank", "warmhalteschrank", "pass-through", "hatch", "glastüren"] },
    ({ width }) => electric((width / 800) * 1.2),
  ),
  { id: "plate-dispenser", kind: "plateDispenser", category: "serving", group: "selfService", name: "cat.plateDispenser", description: "catDesc.plateDispenser", width: 840, depth: 470, height: WORK_HEIGHT, elevation: 0, widths: [470, 840, 1240], tags: ["tellerspender", "tellerstapler", "fahrbar", "plate dispenser", "mobile"], connections: {} },
  withVariants(
    { id: "plate-dispenser-heated", kind: "plateDispenserHeated", category: "serving", group: "selfService", name: "cat.plateDispenserHeated", description: "catDesc.plateDispenserHeated", width: 840, depth: 470, height: WORK_HEIGHT, elevation: 0, widths: [470, 840, 1240], tags: ["tellerspender", "tellerwärmer", "beheizt", "fahrbar", "plate dispenser", "heated", "mobile"] },
    ({ width }) => electric(tubes(width) * 0.9),
  ),
  { id: "tray-dispenser", kind: "trayDispenser", category: "serving", group: "selfService", name: "cat.trayDispenser", description: "catDesc.trayDispenser", width: 620, depth: 440, height: WORK_HEIGHT, elevation: 0, tags: ["tablettspender", "tablettwagen", "fahrbar", "tray dispenser", "mobile"], connections: {} },
  { id: "tray-slide", kind: "traySlide", category: "serving", group: "selfService", name: "cat.traySlide", description: "catDesc.traySlide", width: 1500, depth: 300, height: 80, elevation: TRAY_SLIDE_ELEVATION, widths: [1200, 1500, 1900, 2300], tags: ["tablettrutsche", "tablettbahn", "rohre", "tray slide", "tray rail"], connections: {} },
  withVariants(
    { id: "salad-bar", kind: "saladBar", category: "serving", group: "selfService", name: "cat.saladBar", description: "catDesc.saladBar", width: 1500, depth: 900, height: WORK_HEIGHT, elevation: 0, widths: [1100, 1500, 1900], tags: ["salatbar", "buffet", "gekühlt", "fahrbar", "spuckschutz", "salad bar", "sneeze guard", "gn 1/2"] },
    ({ width }) => ({ ...electric((width / 1500) * 0.6), drain: true }),
  ),
  { id: "cutlery-station", kind: "cutleryStation", category: "serving", group: "selfService", name: "cat.cutleryStation", description: "catDesc.cutleryStation", width: 800, depth: 600, height: WORK_HEIGHT, elevation: 0, widths: [600, 800, 1000], tags: ["besteck", "tablett", "servietten", "besteckköcher", "cutlery", "tray", "napkins"], connections: {} },
  withVariants(
    { id: "carving-station", kind: "carvingStation", category: "serving", group: "serveCounters", name: "cat.carvingStation", description: "catDesc.carvingStation", width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [800, 1200, 1600], tags: ["tranchierstation", "schneidbrett", "wärmebrücke", "braten", "carving", "heat lamp"] },
    ({ width }) => electric((width / 1200) * 1.6),
  ),
  withVariants(
    { id: "soup-station", kind: "soupStation", category: "serving", group: "serveCounters", name: "cat.soupStation", description: "catDesc.soupStation", width: 800, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [400, 800, 1200], tags: ["suppe", "suppenkessel", "suppenstation", "bain-marie", "soup", "soup kettle"] },
    ({ width }) => electric(kettleXs(width).length * 0.8),
  ),
  withVariants(
    { id: "beverage-counter", kind: "beverageCounter", category: "serving", group: "serveCounters", name: "cat.beverageCounter", description: "catDesc.beverageCounter", width: 1200, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1600], tags: ["getränke", "getränkespender", "saft", "wasser", "beverage", "drinks", "dispenser"] },
    ({ width }) => ({ ...electric(dispenserXs(width).length * 0.4), coldWater: true, drain: true }),
  ),
  withVariants(
    { id: "cash-desk", kind: "cashDesk", category: "serving", group: "serveCounters", name: "cat.cashDesk", description: "catDesc.cashDesk", width: 1000, depth: 700, height: WORK_HEIGHT, elevation: 0, widths: [800, 1000, 1200], tags: ["kasse", "kassenmodul", "kassentheke", "checkout", "till", "cash desk"] },
    () => electric(0.3),
  ),
  { id: "waiter-station", kind: "waiterStation", category: "serving", group: "serveCounters", name: "cat.waiterStation", description: "catDesc.waiterStation", width: 1200, depth: 600, height: 1600, elevation: 0, widths: [800, 1000, 1200, 1600], tags: ["servicestation", "office", "kellnerstation", "besteckschubladen", "waiter station", "side station"], connections: {} },
  // Buffet islands and table-top warmers
  withVariants(
    { id: "buffet-hot", kind: "buffetHot", category: "serving", group: "selfService", name: "cat.buffetHot", description: "catDesc.buffetHot", width: 1500, depth: 900, height: WORK_HEIGHT, elevation: 0, widths: [1100, 1500, 1900, 2300], tags: ["buffet", "buffetinsel", "warm", "bain-marie", "wärmebrücke", "glasdach", "hot buffet", "island", "sneeze guard"] },
    ({ width }) => ({ ...electric(wellCount(width) * 1.1 + 0.3), drain: true }),
  ),
  withVariants(
    { id: "buffet-cold", kind: "buffetCold", category: "serving", group: "selfService", name: "cat.buffetCold", description: "catDesc.buffetCold", width: 1500, depth: 900, height: WORK_HEIGHT, elevation: 0, widths: [1100, 1500, 1900, 2300], tags: ["buffet", "buffetinsel", "kalt", "gekühlt", "salat", "dessert", "glasdach", "cold buffet", "island", "refrigerated"] },
    ({ width }) => ({ ...electric(0.6 + wellCount(width) * 0.1), drain: true }),
  ),
  withVariants(
    { id: "buffet-neutral", kind: "buffetNeutral", category: "serving", group: "selfService", name: "cat.buffetNeutral", description: "catDesc.buffetNeutral", width: 1500, depth: 900, height: WORK_HEIGHT, elevation: 0, widths: [1100, 1500, 1900], tags: ["buffet", "buffetinsel", "neutral", "granit", "beleuchtung", "neutral buffet", "island"] },
    () => electric(0.05),
  ),
  { id: "soup-kettle", kind: "soupKettle", category: "serving", group: "selfService", name: "cat.soupKettle", description: "catDesc.soupKettle", width: 380, depth: 380, height: 420, elevation: ON_COUNTER, tags: ["suppenkessel", "suppentopf", "suppe", "buffet", "tischgerät", "soup kettle", "soup warmer"], connections: electric(0.4) },
  withVariants(
    { id: "chafing-dish", kind: "chafingDish", category: "serving", group: "selfService", name: "cat.chafingDish", description: "catDesc.chafingDish", width: 600, depth: 400, height: 330, elevation: ON_COUNTER, widths: [600, 1200, 1800], tags: ["chafing dish", "chafing", "rolltop", "speisenwärmer", "buffet", "gn 1/1", "food warmer"] },
    ({ width }) => electric(chafingCount(width) * 0.5),
  ),
  { id: "carving-lamp", kind: "carvingLamp", category: "serving", group: "selfService", name: "cat.carvingLamp", description: "catDesc.carvingLamp", width: 600, depth: 500, height: 800, elevation: ON_COUNTER, tags: ["tranchierlampe", "wärmelampe", "tranchierbrett", "infrarot", "buffet", "carving lamp", "heat lamp"], connections: electric(0.55) },
  withVariants(
    { id: "display-warmer", kind: "displayWarmer", category: "serving", group: "selfService", name: "cat.displayWarmer", description: "catDesc.displayWarmer", width: 900, depth: 550, height: 650, elevation: ON_COUNTER, widths: [600, 900, 1200], tags: ["warmhaltevitrine", "wärmevitrine", "pizza", "snack", "heißtheke", "heated display", "food display", "hot display"] },
    ({ width }) => electric((width / 900) * 1.5),
  ),
  { id: "holding-drawers", kind: "holdingDrawers", category: "serving", group: "serveCounters", name: "cat.holdingDrawers", description: "catDesc.holdingDrawers", width: 750, depth: 650, height: 900, elevation: 0, tags: ["wärmeschubladen", "warmhalteschubladen", "schubladenwärmer", "warmhalten", "holding drawers", "drawer warmer"], connections: electric(1.4) },
  // Coffee bar
  withVariants(
    { id: "espresso-machine", kind: "espressoMachine", category: "serving", group: "coffee", name: "cat.espressoMachine", description: "catDesc.espressoMachine", width: 750, depth: 560, height: 520, elevation: ON_COUNTER, widths: [550, 750, 1000], tags: ["siebträger", "espressomaschine", "kaffeemaschine", "barista", "gruppen", "espresso machine", "coffee", "portafilter"] },
    ({ width }) => ({ ...electric([3.0, 4.5, 6.3][groupCount(width) - 1]), coldWater: true, drain: true }),
  ),
  { id: "coffee-grinder", kind: "coffeeGrinder", category: "serving", group: "coffee", name: "cat.coffeeGrinder", description: "catDesc.coffeeGrinder", width: 200, depth: 380, height: 600, elevation: ON_COUNTER, tags: ["kaffeemühle", "mühle", "espressomühle", "bohnen", "coffee grinder", "grinder"], connections: electric(0.4) },
  { id: "filter-coffee", kind: "filterCoffee", category: "serving", group: "coffee", name: "cat.filterCoffee", description: "catDesc.filterCoffee", width: 420, depth: 400, height: 580, elevation: ON_COUNTER, tags: ["filterkaffee", "kaffeemaschine", "brühmaschine", "kanne", "warmhalteplatte", "filter coffee", "coffee brewer"], connections: { ...electric(2.2), coldWater: true } },
  { id: "hot-water-dispenser", kind: "hotWaterDispenser", category: "serving", group: "coffee", name: "cat.hotWaterDispenser", description: "catDesc.hotWaterDispenser", width: 300, depth: 420, height: 550, elevation: ON_COUNTER, tags: ["heißwasserspender", "heißwasser", "tee", "wasserkocher", "hot water dispenser", "tea"], connections: { ...electric(3.0), coldWater: true } },
  { id: "milk-cooler", kind: "milkCooler", category: "serving", group: "coffee", name: "cat.milkCooler", description: "catDesc.milkCooler", width: 250, depth: 420, height: 420, elevation: ON_COUNTER, tags: ["milchkühler", "milch", "kühlschrank", "kaffee", "milk cooler", "milk fridge"], connections: electric(0.1) },
  { id: "cup-warmer", kind: "cupWarmer", category: "serving", group: "coffee", name: "cat.cupWarmer", description: "catDesc.cupWarmer", width: 400, depth: 480, height: 520, elevation: ON_COUNTER, tags: ["tassenwärmer", "tassen", "vorwärmer", "kaffee", "cup warmer"], connections: electric(0.2) },
  { id: "knock-box-module", kind: "knockBoxModule", category: "serving", group: "coffee", name: "cat.knockBoxModule", description: "catDesc.knockBoxModule", width: 400, depth: 600, height: WORK_HEIGHT, elevation: 0, widths: [400, 600], tags: ["abschlagschublade", "abschlagbehälter", "kaffeesatz", "knock box", "coffee grounds", "barista"], connections: {} },
  // Bar
  { id: "bar-counter", kind: "barCounter", category: "serving", group: "bar", name: "cat.barCounter", description: "catDesc.barCounter", width: 1500, depth: 700, height: 1100, elevation: 0, widths: [1000, 1500, 2000], tags: ["theke", "bartheke", "thekenmodul", "tresen", "fußleiste", "bar counter", "bar"], connections: {} },
  { id: "draught-column", kind: "draughtColumn", category: "serving", group: "bar", name: "cat.draughtColumn", description: "catDesc.draughtColumn", width: 300, depth: 250, height: 550, elevation: ON_COUNTER, widths: [150, 300, 450, 600], tags: ["zapfsäule", "zapfanlage", "bier", "zapfhahn", "schanksäule", "draught column", "beer tap", "bar"], connections: {} },
  { id: "beer-cooler", kind: "beerCooler", category: "serving", group: "bar", name: "cat.beerCooler", description: "catDesc.beerCooler", width: 400, depth: 550, height: 600, elevation: 0, tags: ["durchlaufkühler", "bierkühler", "zapfanlage", "schankanlage", "beer cooler", "flow cooler", "python"], connections: electric(0.5) },
  withVariants(
    { id: "glass-froster", kind: "glassFroster", category: "serving", group: "bar", name: "cat.glassFroster", description: "catDesc.glassFroster", width: 700, depth: 600, height: WORK_HEIGHT, elevation: 0, widths: [700, 1000], tags: ["gläserfroster", "gläserkühler", "eisgläser", "tiefkühl", "glass froster", "glass chiller", "bar"] },
    ({ width }) => electric((width / 700) * 0.4),
  ),
  { id: "ice-well", kind: "iceWell", category: "serving", group: "bar", name: "cat.iceWell", description: "catDesc.iceWell", width: 900, depth: 600, height: WORK_HEIGHT, elevation: 0, widths: [600, 900, 1200], tags: ["eiswanne", "eisbehälter", "speedrail", "flaschenschiene", "bar", "ice well", "ice bin", "speed rail"], connections: { drain: true } },
  { id: "cocktail-station", kind: "cocktailStation", category: "serving", group: "bar", name: "cat.cocktailStation", description: "catDesc.cocktailStation", width: 1200, depth: 600, height: WORK_HEIGHT, elevation: 0, widths: [1200, 1500], tags: ["cocktailstation", "barstation", "eiswanne", "spüle", "garnitur", "speedrail", "cocktail station", "bar"], connections: { coldWater: true, hotWater: true, drain: true } },
  withVariants(
    { id: "back-bar", kind: "backBar", category: "serving", group: "bar", name: "cat.backBar", description: "catDesc.backBar", width: 1500, depth: 450, height: 2100, elevation: 0, widths: [1000, 1500, 2000], tags: ["barrückbuffet", "rückbuffet", "flaschenregal", "spiegel", "back bar", "bottle shelf", "bar"] },
    ({ width }) => electric((width / 1500) * 0.06),
  ),
  withVariants(
    { id: "juice-dispenser", kind: "juiceDispenser", category: "serving", group: "selfService", name: "cat.juiceDispenser", description: "catDesc.juiceDispenser", width: 450, depth: 450, height: 650, elevation: ON_COUNTER, widths: [220, 450, 650], tags: ["saftspender", "getränkespender", "saft", "frühstück", "juice dispenser", "drink dispenser", "breakfast"] },
    ({ width }) => electric(juiceBowls(width) * 0.3),
  ),
  // Self-service
  { id: "cutlery-dispenser", kind: "cutleryDispenser", category: "serving", group: "selfService", name: "cat.cutleryDispenser", description: "catDesc.cutleryDispenser", width: 600, depth: 250, height: 330, elevation: ON_COUNTER, widths: [400, 600, 800], tags: ["besteckspender", "besteckköcher", "serviettenspender", "selbstbedienung", "cutlery dispenser", "napkins", "self-service"], connections: {} },
  { id: "tray-stand", kind: "trayStand", category: "serving", group: "selfService", name: "cat.trayStand", description: "catDesc.trayStand", width: 400, depth: 550, height: 1400, elevation: 0, tags: ["tablettständer", "tablettregal", "tablettwagen", "selbstbedienung", "tray stand", "tray rack", "self-service"], connections: {} },
  { id: "soft-serve", kind: "softServe", category: "serving", group: "coffee", name: "cat.softServe", description: "catDesc.softServe", width: 550, depth: 800, height: 1500, elevation: 0, tags: ["softeis", "softeismaschine", "speiseeis", "twist", "soft serve", "ice cream machine"], connections: electric(3.8) },
  { id: "frozen-yoghurt", kind: "frozenYoghurt", category: "serving", group: "coffee", name: "cat.frozenYoghurt", description: "catDesc.frozenYoghurt", width: 500, depth: 700, height: 800, elevation: ON_COUNTER, tags: ["frozen yoghurt", "joghurteis", "softeis", "tischgerät", "frozen yogurt", "froyo", "ice cream machine"], connections: electric(2.0) },
];
