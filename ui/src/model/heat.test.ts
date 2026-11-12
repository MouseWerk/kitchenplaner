import { describe, expect, it } from "vitest";
import { estimateHeat, FRYING_KINDS, HEAT_SHARES, heatClassOf, itemHeat, REMOTE_COOLING_SENSIBLE, WET_KINDS } from "./heat";
import { testItem } from "./testProject";
import { KINDS } from "../kinds/registry";

describe("heat classes", () => {
  it("sort units by what they do with their load", () => {
    expect(heatClassOf("range-6")).toBe("dry");
    expect(heatClassOf("kettle-100")).toBe("wet");
    expect(heatClassOf("combi-10")).toBe("wet");
    expect(heatClassOf("fryer-2")).toBe("frying");
    expect(heatClassOf("dishwasher-hood")).toBe("dish");
    expect(heatClassOf("fridge-700")).toBe("cooling");
    expect(heatClassOf("prep-slicer")).toBe("small");
    expect(heatClassOf("sink-1")).toBe("small");
    expect(heatClassOf("hood-wall")).toBe("none");
    expect(heatClassOf("column")).toBe("none");
    // A catalog id this build does not know (a newer file) gives off nothing by estimate.
    expect(heatClassOf("no-such-entry")).toBe("none");
  });

  it("name only kinds the catalog has", () => {
    const kinds = new Set(KINDS.map((k) => k.kind));
    expect([...WET_KINDS, ...FRYING_KINDS].filter((k) => !kinds.has(k))).toEqual([]);
  });

  it("give off at most the connected load", () => {
    for (const s of Object.values(HEAT_SHARES)) expect(s.sensible + s.latent).toBeLessThanOrEqual(1);
  });
});

describe("itemHeat", () => {
  it("estimates from the connected load, electric plus gas", () => {
    const range = testItem("r", "range-6", 0, 0, 0, { connections: { electricKw: 20 } });
    expect(itemHeat(range)).toEqual({ sensibleKw: 20 * HEAT_SHARES.dry.sensible, latentKw: 20 * HEAT_SHARES.dry.latent, estimated: true });
    const combi = testItem("c", "combi-10", 0, 0, 0, { connections: { gasKw: 13, electricKw: 0.5 } });
    expect(itemHeat(combi).latentKw).toBeCloseTo(13.5 * HEAT_SHARES.wet.latent, 2);
    expect(itemHeat(testItem("t", "table", 0, 0)).sensibleKw).toBe(0);
  });

  it("lets the planner's values win, each on its own", () => {
    const range = testItem("r", "range-6", 0, 0, 0, { connections: { electricKw: 20 } });
    expect(itemHeat({ ...range, heat: { sensibleKw: 3, latentKw: 0 } })).toEqual({ sensibleKw: 3, latentKw: 0, estimated: false });
    // Only the sensible value set: the latent one stays the estimate.
    expect(itemHeat({ ...range, heat: { sensibleKw: 3 } })).toEqual({ sensibleKw: 3, latentKw: estimateHeat(range).latentKw, estimated: true });
    expect(itemHeat({ ...range, heat: {} })).toEqual({ ...estimateHeat(range), estimated: true });
  });

  it("keeps the condenser's heat out of the kitchen on a remote refrigeration system", () => {
    const fridge = testItem("f", "fridge-700", 0, 0, 0, { connections: { electricKw: 1 } });
    expect(itemHeat(fridge).sensibleKw).toBe(HEAT_SHARES.cooling.sensible);
    expect(itemHeat({ ...fridge, connections: { electricKw: 1, refrigerationKw: 2 } }).sensibleKw).toBe(REMOTE_COOLING_SENSIBLE);
  });
});
