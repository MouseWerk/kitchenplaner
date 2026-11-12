import { describe, expect, it } from "vitest";
import { itemPoints, type ConnectionPoint } from "../model/points";
import { itemFromCatalog, variantPatch } from "../model/project";
import { testItem } from "../model/testProject";
import { TRADES } from "../model/trades";
import type { Item, Trade } from "../model/types";
import { PROFILES } from "./parts/points";
import { AIR_BELOW, DN_BY_KIND, GREASY_DRAIN, LAYOUT_BY_ENTRY, LAYOUT_BY_KIND, PLUG_BY_KIND, PROFILE_BY_KIND, SOFT_WATER_KINDS } from "./parts/pointRules";
import { CATALOG, catalogEntry, KINDS, variantConnections, withConnectionRules, type CatalogEntry } from "./registry";

const byTrade = (item: Item, trade: Trade): ConnectionPoint => itemPoints(item).find((p) => p.trade === trade)!;

/** Every variant's connection values of an entry. */
function variants(e: CatalogEntry) {
  return (e.widths ?? [e.width]).flatMap((width) => (e.energy ?? [undefined]).map((energy) => variantConnections(e, { width, energy })));
}

/** Kinds whose units supply air to the kitchen. */
const SUPPLY_KINDS = ["hoodSupply", "ventCeilingSupply", "swirlDiffuser", "displacementOutlet"];

describe("the rules", () => {
  it("name only kinds and entries that exist", () => {
    const kinds = new Set(KINDS.map((k) => k.kind));
    const named = [
      ...Object.keys(PROFILE_BY_KIND),
      ...Object.keys(LAYOUT_BY_KIND),
      ...Object.keys(DN_BY_KIND),
      ...Object.keys(PLUG_BY_KIND),
      ...SOFT_WATER_KINDS,
      ...GREASY_DRAIN.kinds,
      ...GREASY_DRAIN.notKinds,
      ...AIR_BELOW,
    ];
    expect(named.filter((k) => !kinds.has(k))).toEqual([]);
    expect(Object.keys(LAYOUT_BY_ENTRY).filter((id) => !catalogEntry(id))).toEqual([]);
  });

  it("keep the exceptions of single entries few", () => {
    expect(Object.keys(LAYOUT_BY_ENTRY).length).toBeLessThan(20);
  });

  it("define every trade in every profile", () => {
    for (const p of Object.values(PROFILES)) expect(Object.keys(p).sort()).toEqual([...TRADES].sort());
  });
});

describe("connection values by rule", () => {
  it("give every soft-water kind softened and cold water in every variant", () => {
    const soft = CATALOG.filter((e) => SOFT_WATER_KINDS.has(e.kind));
    expect(soft.length).toBeGreaterThan(0);
    for (const e of soft) {
      for (const c of variants(e)) expect(c, e.id).toMatchObject({ coldWater: true, softWater: true });
      expect(itemFromCatalog(e, 0, 0).connections.softWater, e.id).toBe(true);
    }
    // No other entry asks for softened water.
    expect(CATALOG.filter((e) => !SOFT_WATER_KINDS.has(e.kind) && variants(e).some((c) => c.softWater)).map((e) => e.id)).toEqual([]);
  });

  it("leave entries without the rule untouched, and keep what a placed unit has", () => {
    const sink = catalogEntry("sink-1")!;
    expect(withConnectionRules(sink)).toBe(sink);
    // A combi oven placed before softened water existed shows no softened water point.
    const old = testItem("c", "combi-10", 0, 0, 0, { connections: { electricKw: 18.9, voltage: 400, coldWater: true, drain: true } });
    expect(itemPoints(old).map((p) => p.trade)).toEqual(["electric", "coldWater", "drain"]);
    // Resizing it to another width step brings the catalog's values (variantPatch), as for any value.
    const e = catalogEntry("combi-10")!;
    expect(variantPatch(old, e, { width: e.width, energy: "gas" }).connections?.softWater).toBe(true);
  });

  it("give the supply air units, and only them, a supply volume in every variant", () => {
    for (const e of CATALOG) {
      for (const c of variants(e)) {
        if (SUPPLY_KINDS.includes(e.kind)) expect(c.supplyM3h, e.id).toBeGreaterThan(0);
        else expect(c.supplyM3h, e.id).toBeUndefined();
      }
    }
    // A hood with a supply air curtain brings in less than it extracts.
    const hood = catalogEntry("hood-wall-supply")!.connections;
    expect(hood.supplyM3h).toBeLessThan(hood.exhaustM3h!);
  });
});

describe("profiles and places", () => {
  it("put a sink's water under its bowl, hot on the left and cold on the right", () => {
    // Bowl at the right end of a 1200 mm sink: centre 300 mm from the right.
    const sink = testItem("s", "sink-1", 0, 0);
    expect([byTrade(sink, "hotWater").fromLeft, byTrade(sink, "coldWater").fromLeft, byTrade(sink, "drain").fromLeft]).toEqual([800, 1000, 900]);
    expect(byTrade(sink, "coldWater").z).toBe(550);
    // The mirrored sink has its bowl at the left; a resized one keeps the distance from its end.
    expect(byTrade(testItem("m", "sink-1-right", 0, 0), "drain").fromLeft).toBe(300);
    expect(byTrade(testItem("w", "sink-1", 0, 0, 0, { width: 1600 }), "drain").fromLeft).toBe(1300);
  });

  it("give tilting units their water high up and the floor drain in front", () => {
    const kettle = testItem("k", "kettle-100", 0, 0);
    expect(byTrade(kettle, "coldWater")).toMatchObject({ z: 900, values: { dn: 20 } });
    const fd = byTrade(kettle, "floorDrain");
    expect(fd.z).toBe(0);
    expect(fd.fromBack).toBe(kettle.depth + 300);
    expect(fd.values).toEqual({ dn: 100, greasy: true });
  });

  it("hang wall units' connections on the wall and keep hoods' air at the top", () => {
    const basin = testItem("h", "handwash", 0, 0);
    expect(byTrade(basin, "coldWater")).toMatchObject({ fromBack: 0, z: 550 });
    expect(byTrade(basin, "drain").values).toEqual({ dn: 40, greasy: false });
    const heater = testItem("w", "water-heater", 0, 0);
    expect(byTrade(heater, "electric").z).toBe(heater.elevation + heater.height + 100);
    const hood = testItem("o", "hood-wall-supply", 0, 0);
    expect(byTrade(hood, "supply")).toMatchObject({ fromLeft: 300, z: hood.elevation + hood.height });
  });

  it("lay out a conveyor dishwasher from its inlet on the left to its outlet on the right", () => {
    const m = testItem("r", "rack-conveyor", 0, 0);
    const drain = byTrade(m, "drain");
    const water = byTrade(m, "hotWater");
    const air = byTrade(m, "exhaust");
    expect(drain.fromLeft).toBeLessThan(m.width / 2);
    expect(water.fromLeft).toBeGreaterThan(m.width / 2);
    expect(air.fromLeft).toBeGreaterThan(m.width / 2);
    expect(water.values.dn).toBe(20);
    expect(drain.values).toEqual({ dn: 50, greasy: true });
  });

  it("size by the unit where the rule says so", () => {
    expect(byTrade(testItem("f", "flight-dishwasher", 0, 0, 0, { width: 6000 }), "hotWater").values.dn).toBe(20);
    expect(byTrade(testItem("f", "flight-dishwasher", 0, 0, 0, { width: 7200 }), "hotWater").values.dn).toBe(25);
    expect(byTrade(testItem("c", "drain-channel-200", 0, 0), "drain").values.dn).toBe(100);
    expect(byTrade(testItem("c", "drain-channel-300", 0, 0), "drain").values.dn).toBe(125);
  });
});

describe("drains and plugs", () => {
  it("count the drains of cooking, dish washing and sinks as greasy, not those of basins, ice and condensate", () => {
    const greasy = (id: string) => byTrade(testItem("x", id, 0, 0), "drain").values.greasy;
    for (const id of ["combi-10", "pasta-cooker", "dishwasher-hood", "pot-washer", "pot-sink", "sink-1", "floor-drain"]) expect(greasy(id), id).toBe(true);
    for (const id of ["handwash", "ice-cube-compact", "condensing-hood", "blast-chiller-10", "grease-separator", "vegetable-washer", "espresso-machine"]) {
      expect(greasy(id), id).toBe(false);
    }
  });

  it("plug cooling, serving and preparation units in and wire the large ones", () => {
    const plug = (id: string, over: Partial<Item> = {}) => byTrade(testItem("x", id, 0, 0, 0, over), "electric").values.plug;
    expect(plug("fridge-700")).toBe("schuko");
    expect(plug("glasswasher")).toBe("schuko");
    // On three phases a Schuko request becomes a CEE socket.
    expect(plug("prep-mixer-40", { connections: { electricKw: 1.5, voltage: 400 } })).toBe("cee16");
    expect(plug("cold-room")).toBe("fixed");
    expect(plug("dishwasher-undercounter")).toBe("fixed");
    expect(plug("range-4")).toBe("fixed");
  });
});
