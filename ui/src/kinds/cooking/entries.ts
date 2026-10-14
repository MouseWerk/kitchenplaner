// Cooking: ranges, solid tops, induction, woks, pasta cookers, bains-marie, fryers, griddles,
// grills, salamanders, tilting pans, kettles, ovens, steamers and the neutral elements of a
// cooking line, in the usual module sizes (700 and 900 mm deep lines, 400/800/1200 mm modules,
// 900 mm working height). Connection values are typical starting points, not a manufacturer's.

import type { Connections } from "../../model/types";
import { withVariants } from "../parts/entries";
import { WORK_HEIGHT } from "../parts/sizes";
import type { CatalogEntry, Variant } from "../types";

/** Electric power above which a unit needs three-phase supply (kW at 230 V, 16 A). */
const SINGLE_PHASE_KW = 3.7;

const kw = (v: number) => Math.round(v * 10) / 10;

/**
 * Connection values of a unit whose power grows with its width: kW of the electric and the gas
 * variant at the reference width `ref`, what every variant needs (water, drains), and the power
 * a gas variant needs for its controls (230 V), if any.
 */
function byWidth(ref: number, electricKw: number, gasKw: number, extra: Connections = {}, gasControlsKw = 0) {
  return ({ width, energy }: Variant): Connections => {
    const f = width / ref;
    if (energy === "gas") return { gasKw: kw(gasKw * f), ...(gasControlsKw > 0 ? { electricKw: gasControlsKw, voltage: 230 } : {}), ...extra };
    const e = kw(electricKw * f);
    return { electricKw: e, voltage: e > SINGLE_PHASE_KW ? 400 : 230, ...extra };
  };
}

const LINE_WIDTHS = [400, 800, 1200] as const;
const ELECTRIC_GAS = ["electric", "gas"] as const;
const GAS_ELECTRIC = ["gas", "electric"] as const;
const H = WORK_HEIGHT;

export const entries: readonly CatalogEntry[] = [
  withVariants({ id: "range-4", kind: "range", category: "cooking", name: "cat.range4", description: "catDesc.range", width: 800, depth: 900, height: H, elevation: 0, energy: ELECTRIC_GAS, tags: ["herd", "kochplatten", "gasherd", "brenner", "backofen", "900er", "range", "oven", "burners"] }, byWidth(800, 15.6, 31)),
  withVariants({ id: "range-6", kind: "range", category: "cooking", name: "cat.range6", description: "catDesc.range", width: 1200, depth: 900, height: H, elevation: 0, energy: ELECTRIC_GAS, tags: ["herd", "kochplatten", "gasherd", "brenner", "backofen", "900er", "range", "oven", "burners"] }, byWidth(1200, 22.4, 43)),
  withVariants({ id: "range-700-open", kind: "rangeOpen", category: "cooking", name: "cat.range700Open", description: "catDesc.rangeOpen", width: 800, depth: 700, height: H, elevation: 0, widths: LINE_WIDTHS, energy: GAS_ELECTRIC, tags: ["herd", "kochfeld", "brenner", "kochplatten", "700er", "unterbau", "boiling top", "burners", "hotplates"] }, byWidth(800, 10.4, 20)),
  withVariants({ id: "range-900-open", kind: "rangeOpen", category: "cooking", name: "cat.range900Open", description: "catDesc.rangeOpen", width: 800, depth: 900, height: H, elevation: 0, widths: LINE_WIDTHS, energy: GAS_ELECTRIC, tags: ["herd", "kochfeld", "brenner", "kochplatten", "900er", "unterbau", "boiling top", "burners", "hotplates"] }, byWidth(800, 16, 30)),
  withVariants({ id: "solid-top", kind: "solidTop", category: "cooking", name: "cat.solidTop", description: "catDesc.solidTop", width: 800, depth: 900, height: H, elevation: 0, widths: [800, 1200], energy: GAS_ELECTRIC, tags: ["glühplatte", "gluehplatte", "herd", "backofen", "900er", "solid top", "french top"] }, byWidth(800, 15, 17)),
  withVariants({ id: "induction-4", kind: "induction", category: "cooking", name: "cat.induction4", description: "catDesc.induction", width: 800, depth: 900, height: H, elevation: 0, tags: ["induktion", "herd", "kochfeld", "backofen", "900er", "induction", "range"] }, () => ({ electricKw: 20, voltage: 400 })),
  withVariants({ id: "induction-700-open", kind: "inductionOpen", category: "cooking", name: "cat.induction700Open", description: "catDesc.induction", width: 800, depth: 700, height: H, elevation: 0, widths: [400, 800], tags: ["induktion", "kochfeld", "700er", "unterbau", "induction", "hob"] }, byWidth(800, 14, 0)),
  withVariants({ id: "wok", kind: "wok", category: "cooking", name: "cat.wok", description: "catDesc.wok", width: 400, depth: 900, height: H, elevation: 0, widths: [400, 800], energy: GAS_ELECTRIC, tags: ["wok", "wokbrenner", "induktionswok", "asiatisch", "wok range", "induction wok"] }, byWidth(400, 5, 14, { coldWater: true, drain: true })),
  withVariants({ id: "pasta-cooker", kind: "pastaCooker", category: "cooking", name: "cat.pastaCooker", description: "catDesc.pastaCooker", width: 400, depth: 900, height: H, elevation: 0, widths: [400, 800], energy: ELECTRIC_GAS, tags: ["nudelkocher", "pasta", "nudeln", "kochbecken", "pasta cooker", "pasta boiler"] }, byWidth(400, 9, 12, { coldWater: true, drain: true })),
  withVariants({ id: "bain-marie", kind: "bainMarie", category: "cooking", name: "cat.bainMarie", description: "catDesc.bainMarie", width: 400, depth: 900, height: H, elevation: 0, widths: LINE_WIDTHS, tags: ["bain-marie", "bainmarie", "wasserbad", "warmhalten", "gn", "saucen", "water bath"] }, byWidth(400, 1.5, 0, { coldWater: true, drain: true })),
  withVariants({ id: "fryer-1", kind: "fryerSingle", category: "cooking", name: "cat.fryer1", description: "catDesc.fryer", width: 400, depth: 900, height: H, elevation: 0, widths: [400, 600, 800], energy: ELECTRIC_GAS, tags: ["fritteuse", "friteuse", "fett", "pommes", "fryer", "deep fryer"] }, byWidth(400, 15, 18)),
  withVariants({ id: "fryer-2", kind: "fryer", category: "cooking", name: "cat.fryer", description: "catDesc.fryer", width: 400, depth: 900, height: H, elevation: 0, widths: [400, 800], energy: ELECTRIC_GAS, tags: ["fritteuse", "friteuse", "fett", "pommes", "fryer", "deep fryer"] }, byWidth(400, 15, 18)),
  withVariants({ id: "griddle", kind: "griddle", category: "cooking", name: "cat.griddle", description: "catDesc.griddle", width: 800, depth: 900, height: H, elevation: 0, widths: LINE_WIDTHS, energy: ELECTRIC_GAS, tags: ["grillplatte", "bratplatte", "plancha", "glatt", "griddle", "fry top"] }, byWidth(800, 10.8, 14)),
  withVariants({ id: "griddle-ribbed", kind: "griddleRibbed", category: "cooking", name: "cat.griddleRibbed", description: "catDesc.griddleRibbed", width: 800, depth: 900, height: H, elevation: 0, widths: LINE_WIDTHS, energy: ELECTRIC_GAS, tags: ["grillplatte", "gerillt", "rillen", "bratplatte", "griddle", "ribbed"] }, byWidth(800, 10.8, 14)),
  withVariants({ id: "griddle-chrome", kind: "griddleChrome", category: "cooking", name: "cat.griddleChrome", description: "catDesc.griddleChrome", width: 800, depth: 900, height: H, elevation: 0, widths: LINE_WIDTHS, energy: ELECTRIC_GAS, tags: ["grillplatte", "verchromt", "chrom", "plancha", "griddle", "chrome"] }, byWidth(800, 10.8, 14)),
  withVariants({ id: "chargrill", kind: "chargrill", category: "cooking", name: "cat.chargrill", description: "catDesc.chargrill", width: 800, depth: 900, height: H, elevation: 0, widths: [400, 800], energy: GAS_ELECTRIC, tags: ["lavasteingrill", "grill", "rost", "lavastein", "chargrill", "char broiler"] }, byWidth(800, 13, 18)),
  withVariants({ id: "salamander", kind: "salamander", category: "cooking", name: "cat.salamander", description: "catDesc.salamander", width: 600, depth: 500, height: 500, elevation: 1400, widths: [600, 800, 1000], tags: ["salamander", "oberhitze", "überbacken", "gratinieren", "wand", "grill", "overhead grill"] }, byWidth(600, 4, 0)),
  withVariants({ id: "kettle-60", kind: "kettle", category: "cooking", name: "cat.kettle60", description: "catDesc.kettle", width: 800, depth: 700, height: H, elevation: 0, energy: ELECTRIC_GAS, tags: ["kochkessel", "kessel", "suppe", "700er", "kettle", "boiling pan"] }, byWidth(800, 9, 12, { coldWater: true, hotWater: true, floorDrain: true })),
  withVariants({ id: "kettle-100", kind: "kettle", category: "cooking", name: "cat.kettle100", description: "catDesc.kettle", width: 800, depth: 900, height: H, elevation: 0, energy: ELECTRIC_GAS, tags: ["kochkessel", "kessel", "suppe", "900er", "kettle", "boiling pan"] }, byWidth(800, 15, 21, { coldWater: true, hotWater: true, floorDrain: true })),
  withVariants({ id: "kettle-150", kind: "kettle", category: "cooking", name: "cat.kettle", description: "catDesc.kettle", width: 800, depth: 900, height: H, elevation: 0, energy: ELECTRIC_GAS, tags: ["kochkessel", "kessel", "suppe", "900er", "kettle", "boiling pan"] }, byWidth(800, 18, 24, { coldWater: true, hotWater: true, floorDrain: true })),
  withVariants({ id: "kettle-100-indirect", kind: "kettleIndirect", category: "cooking", name: "cat.kettleIndirect", description: "catDesc.kettleIndirect", width: 800, depth: 900, height: H, elevation: 0, energy: ELECTRIC_GAS, tags: ["kochkessel", "kessel", "indirekt", "doppelmantel", "wasserbad", "milch", "kettle", "jacketed"] }, byWidth(800, 18, 21, { coldWater: true, hotWater: true, floorDrain: true })),
  withVariants({ id: "tilting-pan", kind: "tiltingPan", category: "cooking", name: "cat.tiltingPan", description: "catDesc.tiltingPan", width: 1200, depth: 900, height: H, elevation: 0, widths: [800, 1200], energy: ELECTRIC_GAS, tags: ["kippbratpfanne", "bratpfanne", "kippbar", "tilting pan", "bratt pan", "braising pan"] }, byWidth(1200, 15, 22, { coldWater: true, floorDrain: true })),
  withVariants({ id: "pressure-pan", kind: "pressurePan", category: "cooking", name: "cat.pressurePan", description: "catDesc.pressurePan", width: 1200, depth: 900, height: H, elevation: 0, widths: [1000, 1200], tags: ["druckbraisiere", "druckbratpfanne", "druckgaren", "kippbratpfanne", "pressure braising pan"] }, byWidth(1200, 21, 0, { coldWater: true, floorDrain: true })),
  withVariants({ id: "multifunction-pan", kind: "multiPan", category: "cooking", name: "cat.multiPan", description: "catDesc.multiPan", width: 1100, depth: 900, height: 1100, elevation: 0, widths: [1100, 1500], tags: ["multifunktionsbräter", "bräter", "brattpfanne", "multifunktion", "bratt pan", "multifunctional"] }, byWidth(1100, 14, 0, { coldWater: true, drain: true })),
  withVariants({ id: "combi-6", kind: "combiOven", category: "cooking", name: "cat.combi6", description: "catDesc.combi", width: 850, depth: 800, height: 800, elevation: 700, energy: ELECTRIC_GAS, tags: ["kombidämpfer", "kombidaempfer", "dämpfer", "konvektomat", "gn", "untergestell", "combi oven", "combi steamer"] }, byWidth(850, 10.8, 13, { coldWater: true, drain: true }, 0.5)),
  withVariants({ id: "combi-10", kind: "combiOven", category: "cooking", name: "cat.combi10", description: "catDesc.combi", width: 850, depth: 850, height: 1050, elevation: 700, energy: ELECTRIC_GAS, tags: ["kombidämpfer", "kombidaempfer", "dämpfer", "konvektomat", "gn", "untergestell", "combi oven", "combi steamer"] }, byWidth(850, 18.9, 21, { coldWater: true, drain: true }, 0.6)),
  withVariants({ id: "combi-20", kind: "combiOven", category: "cooking", name: "cat.combi20", description: "catDesc.combi", width: 900, depth: 900, height: 1800, elevation: 0, energy: ELECTRIC_GAS, tags: ["kombidämpfer", "kombidaempfer", "dämpfer", "konvektomat", "gn", "standgerät", "hordenwagen", "combi oven", "combi steamer", "roll-in"] }, byWidth(900, 37, 42, { coldWater: true, drain: true }, 1.1)),
  withVariants({ id: "convection-oven", kind: "convectionOven", category: "cooking", name: "cat.convectionOven", description: "catDesc.convectionOven", width: 800, depth: 800, height: 600, elevation: 800, tags: ["heißluftofen", "heissluftofen", "konvektionsofen", "backofen", "bäckerei", "untergestell", "convection oven"] }, byWidth(800, 6.4, 0)),
  withVariants({ id: "deck-oven-1", kind: "deckOven1", category: "cooking", name: "cat.deckOven1", description: "catDesc.deckOven", width: 1000, depth: 900, height: 420, elevation: 900, widths: [1000, 1300], tags: ["pizzaofen", "etagenofen", "steinofen", "pizza", "untergestell", "deck oven", "pizza oven"] }, byWidth(1000, 6, 0)),
  withVariants({ id: "deck-oven-2", kind: "deckOven2", category: "cooking", name: "cat.deckOven2", description: "catDesc.deckOven", width: 1000, depth: 900, height: 750, elevation: 700, widths: [1000, 1300], tags: ["pizzaofen", "etagenofen", "steinofen", "pizza", "untergestell", "deck oven", "pizza oven"] }, byWidth(1000, 12, 0)),
  withVariants({ id: "steamer", kind: "steamer", category: "cooking", name: "cat.steamer", description: "catDesc.steamer", width: 600, depth: 800, height: 1500, elevation: 0, tags: ["dampfgarer", "dämpfer", "drucklos", "reiskocher", "reis", "gn", "steamer", "rice cooker"] }, byWidth(600, 12, 0, { coldWater: true, drain: true })),
  withVariants({ id: "holding-cabinet", kind: "holdingCabinet", category: "cooking", name: "cat.holdingCabinet", description: "catDesc.holdingCabinet", width: 600, depth: 750, height: 800, elevation: 700, tags: ["warmhalteschrank", "niedertemperatur", "garen", "warmhalten", "untergestell", "holding cabinet", "cook and hold"] }, byWidth(600, 2.5, 0)),
  withVariants({ id: "neutral-700", kind: "lineNeutral", category: "cooking", name: "cat.neutral700", description: "catDesc.neutral", width: 400, depth: 700, height: H, elevation: 0, widths: [400, 600, 800, 1200], tags: ["neutralelement", "arbeitsplatte", "abstellfläche", "schublade", "700er", "neutral element", "work top"] }, () => ({})),
  withVariants({ id: "neutral-900", kind: "lineNeutral", category: "cooking", name: "cat.neutral900", description: "catDesc.neutral", width: 400, depth: 900, height: H, elevation: 0, widths: [400, 600, 800, 1200], tags: ["neutralelement", "arbeitsplatte", "abstellfläche", "schublade", "900er", "neutral element", "work top"] }, () => ({})),
  withVariants({ id: "line-cabinet-900", kind: "lineCabinet", category: "cooking", name: "cat.lineCabinet900", description: "catDesc.lineCabinet", width: 800, depth: 900, height: H, elevation: 0, widths: LINE_WIDTHS, tags: ["unterbau", "unterschrank", "neutralelement", "türen", "900er", "base cabinet"] }, () => ({})),
  withVariants({ id: "line-heated-cabinet-900", kind: "lineHeatedCabinet", category: "cooking", name: "cat.lineHeatedCabinet900", description: "catDesc.lineHeatedCabinet", width: 800, depth: 900, height: H, elevation: 0, widths: [800, 1200], tags: ["wärmeschrank", "waermeschrank", "unterbau", "tellerwärmer", "900er", "heated cabinet", "hot cupboard"] }, byWidth(800, 1.5, 0)),
];
