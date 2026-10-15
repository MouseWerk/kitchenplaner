// Refrigeration: Gastronorm-based fridges and freezers, refrigerated counters and prep counters,
// blast chillers, ice machines, beverage and display coolers, cold rooms and their doors. Sizes
// and connection values are typical starting points of the trade, not a manufacturer's data.

import type { Connections } from "../../model/types";
import type { CatalogEntry } from "../types";

/** Scaled connection values are rounded to 1/20 kW (0.05 kW). */
const KW_STEPS = 20;

/**
 * Connection values of an entry offered in several widths: the compressor and fans grow with the
 * width, but not in proportion (half the power is the base load of the machine).
 */
function byWidth(c: Connections, width: number): Pick<CatalogEntry, "connections" | "variantConnections"> {
  return {
    connections: c,
    variantConnections: ({ width: w }) => ({ ...c, electricKw: Math.round((c.electricKw ?? 0) * (0.5 + (0.5 * w) / width) * KW_STEPS) / KW_STEPS }),
  };
}

/** Counter widths with 2, 3 and 4 GN 1/1 sections beside the machine compartment (mm). */
const COUNTER_WIDTHS = [1360, 1800, 2230] as const;

export const entries: readonly CatalogEntry[] = [
  // Upright cabinets GN 2/1
  { id: "fridge-700", kind: "fridge", category: "cooling", name: "cat.fridge", description: "catDesc.fridge", tags: ["kühlschrank", "gn 2/1", "umluft", "refrigerator", "reach-in", "upright"], width: 700, depth: 830, height: 2050, elevation: 0, connections: { electricKw: 0.4, voltage: 230 } },
  { id: "freezer-700", kind: "freezer", category: "cooling", name: "cat.freezer", description: "catDesc.freezer", tags: ["tiefkühlschrank", "gefrierschrank", "gn 2/1", "freezer", "reach-in", "upright"], width: 700, depth: 830, height: 2050, elevation: 0, connections: { electricKw: 0.7, voltage: 230 } },
  { id: "fridge-1400", kind: "fridge", category: "cooling", name: "cat.fridge2", description: "catDesc.fridge2", tags: ["kühlschrank", "zweitürig", "gn 2/1", "refrigerator", "reach-in", "two door"], width: 1400, depth: 830, height: 2050, elevation: 0, connections: { electricKw: 0.6, voltage: 230 } },
  { id: "freezer-1400", kind: "freezer", category: "cooling", name: "cat.freezer2", description: "catDesc.freezer2", tags: ["tiefkühlschrank", "gefrierschrank", "zweitürig", "gn 2/1", "freezer", "reach-in", "two door"], width: 1400, depth: 830, height: 2050, elevation: 0, connections: { electricKw: 1.1, voltage: 230 } },
  { id: "fridge-half-700", kind: "fridgeHalf", category: "cooling", name: "cat.fridgeHalf", description: "catDesc.fridgeHalf", tags: ["kühlschrank", "halbtüren", "gn 2/1", "refrigerator", "half doors"], width: 700, depth: 830, height: 2050, elevation: 0, widths: [700, 1400], ...byWidth({ electricKw: 0.4, voltage: 230 }, 700) },
  { id: "fridge-glass-700", kind: "fridgeGlass", category: "cooling", name: "cat.fridgeGlass", description: "catDesc.fridgeGlass", tags: ["kühlschrank", "glastür", "gn 2/1", "refrigerator", "glass door"], width: 700, depth: 830, height: 2050, elevation: 0, widths: [700, 1400], ...byWidth({ electricKw: 0.45, voltage: 230 }, 700) },
  // Under-counter and counters
  { id: "under-counter-fridge", kind: "underCounterFridge", category: "cooling", name: "cat.underCounterFridge", description: "catDesc.underCounterFridge", tags: ["unterbau", "unterbaukühlschrank", "kühlschrank", "under-counter", "undercounter", "refrigerator"], width: 600, depth: 600, height: 850, elevation: 0, connections: { electricKw: 0.25, voltage: 230 } },
  { id: "under-counter-freezer", kind: "underCounterFreezer", category: "cooling", name: "cat.underCounterFreezer", description: "catDesc.underCounterFreezer", tags: ["unterbau", "tiefkühlschrank", "gefrierschrank", "under-counter", "undercounter", "freezer"], width: 600, depth: 600, height: 850, elevation: 0, connections: { electricKw: 0.4, voltage: 230 } },
  { id: "counter-fridge-3", kind: "counterFridge", category: "cooling", name: "cat.counterFridge", description: "catDesc.counterFridge", tags: ["kühltisch", "kühlunterbau", "gn 1/1", "refrigerated counter", "prep table"], width: 1800, depth: 700, height: 850, elevation: 0, widths: COUNTER_WIDTHS, ...byWidth({ electricKw: 0.5, voltage: 230 }, 1800) },
  { id: "counter-freezer", kind: "counterFreezer", category: "cooling", name: "cat.counterFreezer", description: "catDesc.counterFreezer", tags: ["tiefkühltisch", "gefriertisch", "gn 1/1", "freezer counter"], width: 1800, depth: 700, height: 850, elevation: 0, widths: COUNTER_WIDTHS, ...byWidth({ electricKw: 0.9, voltage: 230 }, 1800) },
  { id: "counter-drawers", kind: "counterDrawers", category: "cooling", name: "cat.counterDrawers", description: "catDesc.counterDrawers", tags: ["kühltisch", "schubladen", "gn 1/1", "refrigerated counter", "drawers"], width: 1800, depth: 700, height: 850, elevation: 0, widths: COUNTER_WIDTHS, ...byWidth({ electricKw: 0.55, voltage: 230 }, 1800) },
  { id: "chef-base", kind: "chefBase", category: "cooling", name: "cat.chefBase", description: "catDesc.chefBase", tags: ["kühlunterbau", "kühlschubladen", "unterbau", "chef base", "refrigerated drawers"], width: 1600, depth: 800, height: 650, elevation: 0, widths: [1200, 1600, 2000], ...byWidth({ electricKw: 0.45, voltage: 230 }, 1600) },
  { id: "saladette", kind: "saladette", category: "cooling", name: "cat.saladette", description: "catDesc.saladette", tags: ["saladette", "zubereitungstisch", "belegstation", "gn 1/3", "prep counter", "sandwich"], width: 1365, depth: 700, height: 1100, elevation: 0, widths: [900, 1365, 1795], ...byWidth({ electricKw: 0.35, voltage: 230 }, 1365) },
  { id: "pizza-prep", kind: "pizzaPrep", category: "cooling", name: "cat.pizzaPrep", description: "catDesc.pizzaPrep", tags: ["pizza", "pizzakühltisch", "granit", "belegstation", "pizza prep", "topping rail"], width: 1500, depth: 800, height: 1400, elevation: 0, widths: [1500, 2000], ...byWidth({ electricKw: 0.45, voltage: 230 }, 1500) },
  { id: "gn-cold-well", kind: "gnColdWell", category: "cooling", name: "cat.gnColdWell", description: "catDesc.gnColdWell", tags: ["kühlwanne", "kühlbuffet", "salatbar", "gn 1/1", "cold well", "salad bar"], width: 1200, depth: 700, height: 900, elevation: 0, widths: [800, 1200, 1600], ...byWidth({ electricKw: 0.4, voltage: 230, drain: true }, 1200) },
  // Blast chillers
  { id: "blast-chiller-5", kind: "blastChiller", category: "cooling", name: "cat.blastChiller5", description: "catDesc.blastChiller", tags: ["schockkühler", "schockfroster", "schnellkühler", "blast chiller", "shock freezer"], width: 750, depth: 740, height: 880, elevation: 0, connections: { electricKw: 1.2, voltage: 230, drain: true } },
  { id: "blast-chiller-10", kind: "blastChiller", category: "cooling", name: "cat.blastChiller10", description: "catDesc.blastChiller", tags: ["schockkühler", "schockfroster", "schnellkühler", "blast chiller", "shock freezer"], width: 800, depth: 800, height: 1750, elevation: 0, connections: { electricKw: 2.6, voltage: 400, drain: true } },
  { id: "blast-chiller-roll-in", kind: "blastChillerRollIn", category: "cooling", name: "cat.blastChillerRollIn", description: "catDesc.blastChillerRollIn", tags: ["schockkühler", "einfahr", "hordenwagen", "roll-in", "blast chiller", "trolley"], width: 1200, depth: 1250, height: 2300, elevation: 0, connections: { electricKw: 6.5, voltage: 400, drain: true } },
  // Ice
  { id: "ice-cube-compact", kind: "iceMachine", category: "cooling", name: "cat.iceCubeCompact", description: "catDesc.iceCubeCompact", tags: ["eiswürfel", "eismaschine", "eiswürfelbereiter", "ice", "ice maker", "cube"], width: 500, depth: 600, height: 850, elevation: 0, connections: { electricKw: 0.4, voltage: 230, coldWater: true, drain: true } },
  { id: "ice-cube-modular", kind: "iceMachine", category: "cooling", name: "cat.iceCubeModular", description: "catDesc.iceCubeModular", tags: ["eiswürfel", "eismaschine", "vorratsbehälter", "ice", "ice maker", "bin", "cube"], width: 760, depth: 830, height: 1750, elevation: 0, connections: { electricKw: 1.1, voltage: 230, coldWater: true, drain: true } },
  { id: "ice-flake", kind: "iceMachine", category: "cooling", name: "cat.iceFlake", description: "catDesc.iceFlake", tags: ["scherbeneis", "flockeneis", "eismaschine", "ice", "flake ice", "ice maker"], width: 600, depth: 650, height: 1000, elevation: 0, connections: { electricKw: 0.5, voltage: 230, coldWater: true, drain: true } },
  // Beverage and display
  { id: "bottle-cooler", kind: "bottleCooler", category: "cooling", name: "cat.bottleCooler", description: "catDesc.bottleCooler", tags: ["getränkekühlschrank", "flaschenkühlschrank", "glastür", "beverage cooler", "bottle cooler", "drinks"], width: 600, depth: 600, height: 1850, elevation: 0, widths: [600, 1200], ...byWidth({ electricKw: 0.3, voltage: 230 }, 600) },
  { id: "multideck", kind: "multideck", category: "cooling", name: "cat.multideck", description: "catDesc.multideck", tags: ["kühlregal", "wandkühlregal", "selbstbedienung", "display cooler", "multideck", "open chiller"], width: 1250, depth: 800, height: 2000, elevation: 0, widths: [1250, 1875, 2500], ...byWidth({ electricKw: 1.5, voltage: 230 }, 1250) },
  // Walk-ins
  { id: "cold-room", kind: "coldRoom", category: "cooling", name: "cat.coldRoom", description: "catDesc.coldRoom", tags: ["kühlzelle", "kühlraum", "begehbar", "cold room", "walk-in"], width: 2400, depth: 2100, height: 2200, elevation: 0, connections: { electricKw: 1.5, voltage: 400 } },
  { id: "cold-room-small", kind: "coldRoom", category: "cooling", name: "cat.coldRoomSmall", description: "catDesc.coldRoom", tags: ["kühlzelle", "kühlraum", "begehbar", "cold room", "walk-in"], width: 1800, depth: 1500, height: 2200, elevation: 0, connections: { electricKw: 1, voltage: 230 } },
  { id: "cold-room-large", kind: "coldRoom", category: "cooling", name: "cat.coldRoomLarge", description: "catDesc.coldRoom", tags: ["kühlzelle", "kühlraum", "begehbar", "cold room", "walk-in"], width: 3000, depth: 2400, height: 2200, elevation: 0, connections: { electricKw: 2.2, voltage: 400 } },
  { id: "freezer-room", kind: "freezerRoom", category: "cooling", name: "cat.freezerRoom", description: "catDesc.freezerRoom", tags: ["tiefkühlzelle", "tk-zelle", "gefrierraum", "begehbar", "freezer room", "walk-in freezer"], width: 2400, depth: 2100, height: 2200, elevation: 0, connections: { electricKw: 3, voltage: 400 } },
  { id: "cold-room-door", kind: "coldRoomDoor", category: "cooling", name: "cat.coldRoomDoor", description: "catDesc.coldRoomDoor", tags: ["kühlzellentür", "kühlraumtür", "tür", "cold room door", "walk-in door"], width: 1200, depth: 170, height: 2200, elevation: 0, connections: {} },
];
