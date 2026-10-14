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
      "griddle-ribbed", "griddle-chrome", "chargrill", "salamander", "kettle-60", "kettle-100", "kettle-150",
      "kettle-100-indirect", "tilting-pan", "pressure-pan", "multifunction-pan", "combi-6", "combi-10",
      "combi-20", "convection-oven", "deck-oven-1", "deck-oven-2", "steamer", "holding-cabinet",
      "neutral-700", "neutral-900", "line-cabinet-900", "line-heated-cabinet-900",
      // cooling
      "fridge-700", "freezer-700", "fridge-1400", "freezer-1400", "fridge-half-700", "fridge-glass-700",
      "under-counter-fridge", "under-counter-freezer", "counter-fridge-3", "counter-freezer",
      "counter-drawers", "chef-base", "saladette", "pizza-prep", "gn-cold-well", "blast-chiller-5",
      "blast-chiller-10", "blast-chiller-roll-in", "ice-cube-compact", "ice-cube-modular", "ice-flake",
      "bottle-cooler", "multideck", "cold-room", "cold-room-small", "cold-room-large", "freezer-room",
      "cold-room-door",
      // washing
      "sink-1", "sink-2", "handwash", "dishwasher-hood", "sink-1-right", "sink-2-right", "sink-3", "pot-sink",
      "handwash-knee", "handwash-sensor", "mop-sink", "pre-rinse-wall", "dish-inlet-table",
      "dish-outlet-table", "dish-corner-table", "sorting-table", "dishwasher-undercounter", "glasswasher",
      "rack-conveyor", "rack-conveyor-dryer", "flight-dishwasher", "pot-washer", "rack-trolley",
      "waste-station",
      // prep
      "table", "table-open", "table-drawer", "table-sink", "table-island", "table-corner-left",
      "table-corner-right", "table-mobile", "table-cabinet", "table-cabinet-island", "table-cabinet-sliding",
      "table-cabinet-drawers", "table-drawers", "table-heated", "prep-veg-cutter", "prep-slicer",
      "prep-mixer-10", "prep-mixer-40", "prep-mixer-60", "prep-mincer", "prep-cutter", "prep-vacuum-table",
      "prep-vacuum-floor", "prep-scale", "prep-scale-platform", "prep-dough-sheeter", "prep-peeler",
      // serving
      "pass-counter", "heat-lamp-bridge", "heat-lamp-pendant", "food-counter-hot", "cold-counter",
      "hot-cupboard", "hatch-warmer", "plate-dispenser", "plate-dispenser-heated", "tray-dispenser",
      "tray-slide", "salad-bar", "cutlery-station", "carving-station", "soup-station", "beverage-counter",
      "cash-desk", "waiter-station",
      // storage
      "shelving", "shelving-5", "shelving-perforated", "shelving-alu", "shelving-corner", "dunnage-rack",
      "rack-trolley-15", "rack-trolley-20", "wall-shelf", "wall-shelf-double", "wall-cabinet-sliding",
      "tall-cabinet", "ingredient-bin", "utensil-rail", "knife-bar",
      // ventilation
      "hood-wall", "hood-island", "condensing-hood", "vent-ceiling", "exhaust-duct", "vent-shaft",
      // building
      "column", "column-round", "shaft", "floor-drain", "drain-channel-200", "drain-channel-300",
      "grease-separator", "socket-panel", "water-connection", "duct", "platform",
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
