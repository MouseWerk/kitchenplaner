import { describe, expect, it } from "vitest";
import { itemFromCatalog, variantPatch } from "../model/project";
import { catalogEntry, CATALOG, FALLBACK_KIND, kindDef, kindOf, placementOf, type CatalogEntry } from "./registry";

/** A unit offered electric and gas in three widths, with connection values per variant. */
const fryer: CatalogEntry = {
  id: "test-fryer",
  kind: "fryer",
  category: "cooking",
  name: "cat.fryer",
  width: 400,
  depth: 900,
  height: 900,
  elevation: 0,
  connections: { electricKw: 15, voltage: 400 },
  widths: [400, 600, 800],
  energy: ["electric", "gas"],
  variantConnections: ({ width, energy }) => (energy === "gas" ? { gasKw: width / 20, electricKw: 0.1, voltage: 230 } : { electricKw: (width / 400) * 15, voltage: 400 }),
};

describe("lookup", () => {
  it("finds entries and kinds, and draws unknown ones as a table", () => {
    expect(catalogEntry("sink-1")?.kind).toBe("sink");
    expect(catalogEntry("from-a-newer-version")).toBeUndefined();
    expect(kindOf("from-a-newer-version")).toBe("worktable");
    expect(kindDef("from-a-newer-version")).toBe(FALLBACK_KIND);
    expect(placementOf("hood")).toBe("overhead");
    expect(placementOf("handwash")).toBe("overhead");
    expect(placementOf("range")).toBe("floor");
    expect(placementOf("slicer")).toBe("tableTop");
    expect(placementOf("floorDrain")).toBe("flat");
    expect(placementOf("platform")).toBe("flat");
    expect(placementOf("from-a-newer-version")).toBe("floor");
  });

  it("keeps the catalog ids and their order that saved files and the sidebar rely on", () => {
    // Written out so that a removed, renamed or reordered entry fails here. New entries are added
    // to this list; the ids of earlier versions keep their relative order.
    expect(CATALOG.map((e) => e.id)).toEqual([
      // cooking
      "range-4", "range-6", "range-700-open", "range-900-open", "solid-top", "induction-4",
      "induction-700-open", "wok", "pasta-cooker", "bain-marie", "fryer-1", "fryer-2", "griddle",
      "griddle-ribbed", "griddle-chrome", "chargrill", "salamander", "kettle-60", "kettle-100",
      "kettle-150", "kettle-100-indirect", "tilting-pan", "pressure-pan", "multifunction-pan", "combi-6",
      "combi-10", "combi-20", "convection-oven", "deck-oven-1", "deck-oven-2", "steamer",
      "holding-cabinet", "neutral-700", "neutral-900", "line-cabinet-900", "line-heated-cabinet-900",
      "range-700-oven", "fryer-700", "griddle-700", "pasta-cooker-700", "bain-marie-700", "chargrill-700",
      "line-cabinet-700", "bratt-pan-700", "tilting-pan-700", "wok-3", "bratt-pan-900", "teppanyaki",
      "charbroiler", "kettle-mixer", "multicooker", "steamer-tabletop", "microwave", "microwave-combi",
      "cook-hold-oven-2", "holding-cabinet-floor", "smoker", "salamander-lift", "pizza-conveyor",
      "pizza-oven-dome", "pizza-oven-rotating", "rotisserie", "doner-grill", "tandoor",
      "griddle-tabletop", "induction-griddle", "induction-wok-tabletop", "crepe-maker", "waffle-iron",
      "contact-grill", "conveyor-toaster", "egg-boiler", "rice-cooker", "sous-vide", "line-bridge",
      "line-overshelf", "hob-cover",
      // cooling
      "fridge-700", "freezer-700", "fridge-1400", "freezer-1400", "fridge-half-700", "fridge-glass-700",
      "under-counter-fridge", "under-counter-freezer", "counter-fridge-3", "counter-freezer",
      "counter-drawers", "chef-base", "saladette", "pizza-prep", "gn-cold-well", "blast-chiller-5",
      "blast-chiller-10", "blast-chiller-roll-in", "ice-cube-compact", "ice-cube-modular", "ice-flake",
      "bottle-cooler", "multideck", "cold-room", "cold-room-small", "cold-room-large", "freezer-room",
      "cold-room-door", "fridge-roll-in", "freezer-roll-in", "fridge-pass-through", "fridge-fish",
      "meat-aging-cabinet", "dough-retarder", "bakery-freezer", "wine-cabinet", "beverage-cooler-sliding",
      "back-bar-cooler", "ice-cream-display", "chest-freezer", "ice-cream-conservator",
      "chilled-display-top", "cold-pass", "counter-drawers-600", "chef-base-heavy", "ice-dispenser",
      "ice-bin", "water-cooler", "blast-chiller-roll-in-2", "condensing-unit", "cold-room-glass",
      "freezer-room-door", "gn-cold-well-drop-in", "blast-chiller-3",
      // washing
      "sink-1", "sink-2", "handwash", "dishwasher-hood", "sink-1-right", "sink-2-right", "sink-3",
      "pot-sink", "handwash-knee", "handwash-sensor", "mop-sink", "pre-rinse-wall", "dish-inlet-table",
      "dish-outlet-table", "dish-corner-table", "sorting-table", "dishwasher-undercounter", "glasswasher",
      "rack-conveyor", "rack-conveyor-dryer", "flight-dishwasher", "pot-washer", "rack-trolley",
      "waste-station", "glasswasher-pump", "dishwasher-hood-double", "dishwasher-front-cabinet",
      "sink-1-centre", "sink-2-centre", "sink-corner-left", "sink-corner-right", "dish-inlet-table-left",
      "dish-outlet-table-right", "sorting-table-left", "pot-washer-granulate", "tray-washer",
      "cutlery-soak-trolley", "cutlery-polisher", "ultrasonic-tank", "dish-return-belt",
      "tray-return-trolley", "rack-dispenser", "handwash-pedal", "disinfection-wall",
      "disinfection-stand", "eye-wash-station", "cleaning-station", "dosing-station", "cleaning-trolley",
      "water-softener", "boot-washer", "vegetable-washer", "waste-disposer",
      // prep
      "table", "table-open", "table-drawer", "table-sink", "table-island", "table-corner-left",
      "table-corner-right", "table-mobile", "table-cabinet", "table-cabinet-island",
      "table-cabinet-sliding", "table-cabinet-drawers", "table-drawers", "table-heated", "table-stone",
      "table-pastry", "table-butcher-block", "table-cutting", "table-gn", "table-handwash",
      "table-mobile-gn", "table-trolley", "table-machine-stand", "table-board-rack", "prep-veg-cutter",
      "prep-slicer", "prep-mixer-10", "prep-mixer-40", "prep-mixer-60", "prep-mincer", "prep-cutter",
      "prep-vacuum-table", "prep-vacuum-floor", "prep-scale", "prep-scale-platform", "prep-dough-sheeter",
      "prep-peeler", "prep-stick-blender", "prep-bowl-cutter", "prep-spiral-mixer-25",
      "prep-spiral-mixer-50", "prep-divider-rounder", "prep-bread-slicer", "prep-proofer",
      "prep-tenderiser", "prep-bone-saw", "prep-burger-press", "prep-tumbler", "prep-sauce-dispenser",
      "prep-cooking-blender", "prep-juicer", "prep-ice-shaver", "prep-tempering", "prep-pasta-machine",
      "prep-label-scale", "prep-label-printer",
      // serving
      "pass-counter", "heat-lamp-bridge", "heat-lamp-pendant", "food-counter-hot", "cold-counter",
      "hot-cupboard", "hatch-warmer", "plate-dispenser", "plate-dispenser-heated", "tray-dispenser",
      "tray-slide", "salad-bar", "cutlery-station", "carving-station", "soup-station", "beverage-counter",
      "cash-desk", "waiter-station", "buffet-hot", "buffet-cold", "buffet-neutral", "soup-kettle",
      "chafing-dish", "carving-lamp", "display-warmer", "holding-drawers", "espresso-machine",
      "coffee-grinder", "filter-coffee", "hot-water-dispenser", "milk-cooler", "cup-warmer",
      "knock-box-module", "bar-counter", "draught-column", "beer-cooler", "glass-froster", "ice-well",
      "cocktail-station", "back-bar", "juice-dispenser", "cutlery-dispenser", "tray-stand", "soft-serve",
      "frozen-yoghurt",
      // storage
      "shelving", "shelving-5", "shelving-perforated", "shelving-alu", "shelving-corner", "dunnage-rack",
      "rack-trolley-15", "rack-trolley-20", "wall-shelf", "wall-shelf-double", "wall-cabinet-sliding",
      "tall-cabinet", "ingredient-bin", "utensil-rail", "knife-bar", "mobile-shelving",
      "cold-room-shelving", "gn-shelving", "wine-rack", "bread-rack", "tray-rack", "plate-trolley",
      "plate-rack-wall", "pot-rack-wall", "cutlery-cabinet", "cleaning-cabinet", "locker",
      "linen-cabinet", "euro-pallet", "crates", "crate-dolly", "sack-truck",
      // ventilation
      "hood-wall", "hood-island", "condensing-hood", "vent-ceiling", "exhaust-duct", "vent-shaft",
      "hood-wall-uv", "hood-wall-supply", "vent-ceiling-supply", "dish-hood", "downdraft",
      "swirl-diffuser", "displacement-outlet", "fire-suppression", "fan-box",
      // building
      "column", "column-round", "shaft", "floor-drain", "drain-channel-200", "drain-channel-300",
      "grease-separator", "socket-panel", "water-connection", "duct", "platform", "floor-gully",
      "floor-gully-bucket", "grease-trap-compact", "lifting-station", "distribution-board", "gas-shutoff",
      "fire-extinguisher", "fire-blanket", "exit-sign", "wall-guard-rail", "corner-guard", "column-clad",
      "media-column", "floor-box", "radiator", "water-heater",
    ]);
  });

  it("keeps the ids of the first catalog, in their order", () => {
    const first = [
      "range-4", "range-6", "induction-4", "fryer-2", "griddle", "kettle-150", "tilting-pan", "combi-10", "combi-20",
      "fridge-700", "freezer-700", "counter-fridge-3", "cold-room",
      "sink-1", "sink-2", "handwash", "dishwasher-hood",
      "table", "table-island", "table-cabinet", "table-drawers",
      "shelving", "wall-shelf",
      "hood-wall", "hood-island",
      "column",
    ];
    const ids = CATALOG.map((e) => e.id);
    expect(ids.filter((id) => first.includes(id))).toEqual(first);
  });
});

describe("variants", () => {
  it("makes a new item as the default variant: first energy, its connection values", () => {
    const it0 = itemFromCatalog(fryer, 0, 0);
    expect(it0.energy).toBe("electric");
    expect(it0.connections).toEqual({ electricKw: 15, voltage: 400 });
    // Units without energy variants get no energy field.
    expect("energy" in itemFromCatalog(catalogEntry("table")!, 0, 0)).toBe(false);
  });

  it("switches energy and width with the connection values of the variant", () => {
    const it0 = itemFromCatalog(fryer, 0, 0);
    const gas = { ...it0, ...variantPatch(it0, fryer, { energy: "gas" }) };
    expect(gas).toMatchObject({ energy: "gas", width: 400, connections: { gasKw: 20, electricKw: 0.1, voltage: 230 } });
    const wide = { ...gas, ...variantPatch(gas, fryer, { width: 800 }) };
    expect(wide).toMatchObject({ energy: "gas", width: 800, connections: { gasKw: 40 } });
  });

  it("keeps edited connection values when only the width of a unit without per-variant values changes", () => {
    const sink = catalogEntry("sink-1")!;
    const it0 = { ...itemFromCatalog(sink, 0, 0), connections: { coldWater: true } };
    expect(variantPatch(it0, sink, { width: 1600 })).toEqual({ width: 1600 });
  });
});
