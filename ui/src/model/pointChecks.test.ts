import { describe, expect, it } from "vitest";
import { checkProject } from "./checks";
import {
  AIRFLOW_STEP,
  FLOOR_DRAIN_KINDS,
  FLOOR_DRAIN_REACH,
  GAS_SHUTOFF_KIND,
  HOOD_AIR_PER_KW,
  ISLAND_SUPPLY_KINDS,
  NO_HOOD_KINDS,
  WALL_REACH,
} from "./checkRules";
import { itemHeat } from "./heat";
import { itemPoints } from "./points";
import { testItem, testProject } from "./testProject";
import { catalogEntry, kindOf, KINDS, variantConnections } from "../kinds/registry";
import type { Item, Project } from "./types";

/** The findings with one of `keys`. */
const only = (p: Project, ...keys: string[]) => checkProject(p).filter((i) => keys.includes(i.key));

/** A unit of an entry in its gas variant. */
function gasItem(id: string, catalogId: string, x: number, y: number, rotation = 0): Item {
  const e = catalogEntry(catalogId);
  if (!e) throw new Error(catalogId);
  return testItem(id, catalogId, x, y, rotation, { energy: "gas", connections: variantConnections(e, { width: e.width, energy: "gas" }) });
}

/** Where a unit's point of a trade lies on the plan (wherever the catalog puts it). */
function pointAt(it: Item, trade: string) {
  const p = itemPoints(it).find((q) => q.trade === trade);
  if (!p) throw new Error(`${it.id} has no ${trade} point`);
  return p.at;
}

describe("the point rules", () => {
  it("name only kinds the catalog has", () => {
    const kinds = new Set(KINDS.map((k) => k.kind));
    expect([...ISLAND_SUPPLY_KINDS, ...FLOOR_DRAIN_KINDS, GAS_SHUTOFF_KIND].filter((k) => !kinds.has(k))).toEqual([]);
  });
});

describe("gas units and hoods", () => {
  it("reports a gas unit without a canopy once, instead of the general hood finding", () => {
    const p = testProject([gasItem("r", "range-6", 4000, 450)]);
    expect(only(p, "check.gasNoHood", "check.hoodMissing")).toEqual([{ key: "check.gasNoHood", vars: { pos: 1 }, itemIds: ["r"] }]);
    p.items.push(testItem("h", "hood-wall", 4000, 550));
    expect(only(p, "check.gasNoHood", "check.hoodMissing")).toEqual([]);
  });

  it("does not count a condensing hood for a gas combi oven", () => {
    const gas = testProject([gasItem("c", "combi-10", 4000, 425), testItem("k", "condensing-hood", 4000, 550)]);
    expect(only(gas, "check.gasNoHood", "check.hoodMissing")).toEqual([{ key: "check.gasNoHood", vars: { pos: 1 }, itemIds: ["c"] }]);
    // The electric one is served by it.
    const electric = testProject([testItem("c", "combi-10", 4000, 425), testItem("k", "condensing-hood", 4000, 550)]);
    expect(only(electric, "check.gasNoHood", "check.hoodMissing")).toEqual([]);
  });

  it("does not exempt a kind that otherwise needs no hood when it burns gas", () => {
    const oven = gasItem("o", "pizza-oven-dome", 4000, 800);
    expect(NO_HOOD_KINDS.has(kindOf(oven.catalogId))).toBe(true);
    expect(only(testProject([oven]), "check.gasNoHood", "check.hoodMissing")).toEqual([{ key: "check.gasNoHood", vars: { pos: 1 }, itemIds: ["o"] }]);
    const electric = testItem("o", "pizza-oven-dome", 4000, 800, 0, { energy: "electric", connections: { electricKw: 10, voltage: 400 } });
    expect(only(testProject([electric]), "check.gasNoHood", "check.hoodMissing")).toEqual([]);
  });

  it("asks for a gas emergency shut-off in a plan with gas units, naming them", () => {
    const p = testProject([gasItem("r", "range-6", 4000, 450), testItem("h", "hood-wall", 4000, 550)]);
    expect(only(p, "check.gasShutoffMissing")).toEqual([{ key: "check.gasShutoffMissing", vars: {}, itemIds: ["r"] }]);
    p.items.push(testItem("g", "gas-shutoff", 1500, 60));
    expect(only(p, "check.gasShutoffMissing")).toEqual([]);
    expect(only(testProject([testItem("r", "range-6", 4000, 450)]), "check.gasShutoffMissing")).toEqual([]);
  });
});

describe("points away from the walls", () => {
  it("reports a sink in the middle of the room once, with its pipe points and distance", () => {
    const p = testProject([testItem("s", "sink-1", 4000, 3000)]);
    const found = only(p, "check.islandSupply");
    expect(found.map((i) => [i.key, i.itemIds])).toEqual([["check.islandSupply", ["s"]]]);
    const vars = found[0].vars;
    expect(String(vars.point).split(", ")).toEqual(["1.KW", "1.WW", "1.AW"]);
    expect(Number(vars.measured)).toBeGreaterThan(WALL_REACH);
    // Against the wall it is supplied along it.
    p.items[0] = { ...p.items[0], y: 350 };
    expect(only(p, "check.islandSupply")).toEqual([]);
  });

  it("accepts a floor box, media column, shaft or column within reach", () => {
    for (const supply of ["floor-box", "media-column", "shaft", "column"]) {
      const p = testProject([testItem("s", "sink-1", 4000, 3000), testItem("f", supply, 4000, 3600)]);
      expect(only(p, "check.islandSupply"), supply).toEqual([]);
      // Too far away, it supplies nothing.
      p.items[1] = { ...p.items[1], x: 6500 };
      expect(only(p, "check.islandSupply"), supply).toHaveLength(1);
    }
  });

  it("lets a drain run to a floor drain nearby, but not the water", () => {
    const p = testProject([testItem("s", "sink-1", 4000, 3000), testItem("d", "floor-gully", 4000, 3600)]);
    expect(only(p, "check.islandSupply").map((i) => i.vars.point)).toEqual(["1.KW, 1.WW"]);
  });

  it("counts a point at height 0 as coming from the floor", () => {
    const sink = testItem("s", "sink-1", 4000, 3000, 0, { points: { coldWater: { z: 0 }, hotWater: { z: 0 } } });
    expect(only(testProject([sink]), "check.islandSupply").map((i) => i.vars.point)).toEqual(["1.AW"]);
    const all = { ...sink, points: { ...sink.points, drain: { z: 0 } } };
    expect(only(testProject([all]), "check.islandSupply")).toEqual([]);
  });

  it("measures from a partition as from a wall", () => {
    const p = testProject([testItem("s", "sink-1", 4000, 3000 + 75 + 350)]);
    expect(only(p, "check.islandSupply")).toHaveLength(1);
    p.room.partitions.push({ id: "w", a: { x: 0, y: 3000 }, b: { x: 8000, y: 3000 }, thickness: 150, height: 3000 });
    expect(only(p, "check.islandSupply")).toEqual([]);
  });
});

describe("floor drain points", () => {
  it("need a floor drain or channel within reach", () => {
    const pan = testItem("t", "tilting-pan", 4000, 450);
    const p = testProject([pan]);
    expect(only(p, "check.floorDrainMissing")).toEqual([{ key: "check.floorDrainMissing", vars: { point: "1.BA", required: FLOOR_DRAIN_REACH }, itemIds: ["t"] }]);
    const at = pointAt(pan, "floorDrain");
    p.items.push(testItem("d", "floor-drain", at.x, at.y));
    expect(only(p, "check.floorDrainMissing")).toEqual([]);
    // Beyond reach of its outline (300 × 300).
    p.items[1] = { ...p.items[1], x: at.x + 150 + FLOOR_DRAIN_REACH + 10 };
    expect(only(p, "check.floorDrainMissing")).toHaveLength(1);
    // A channel 1500 long, its end just within reach.
    p.items[1] = testItem("d", "drain-channel-300", at.x + FLOOR_DRAIN_REACH - 10 + 750, at.y);
    expect(only(p, "check.floorDrainMissing")).toEqual([]);
  });
});

describe("hood airflow", () => {
  /** The airflow the heat of `items` asks for (m³/h), at the project's simultaneity. */
  const needed = (kw: number, factor = 1) => Math.ceil((kw * factor * HOOD_AIR_PER_KW) / AIRFLOW_STEP - 1e-6) * AIRFLOW_STEP;
  const heatOf = (it: Item) => itemHeat(it).sensibleKw + itemHeat(it).latentKw;

  it("compares the hood's airflow with the heat under it", () => {
    const range = testItem("r", "range-6", 4000, 450);
    const hood = testItem("h", "hood-wall", 4000, 550);
    const p = testProject([range, hood]);
    expect(only(p, "check.hoodAirflow")).toEqual([]);
    p.items[1] = { ...p.items[1], connections: { ...hood.connections, exhaustM3h: 1000 } };
    const required = needed(heatOf(range));
    expect(required).toBeGreaterThan(1000);
    expect(only(p, "check.hoodAirflow")).toEqual([{ key: "check.hoodAirflow", vars: { hood: 2, measured: 1000, required }, itemIds: ["h", "r"] }]);
    // With the simultaneity applied, less is needed.
    p.settings = { simultaneity: 0.5 };
    expect(needed(heatOf(range), 0.5)).toBeLessThanOrEqual(1000);
    expect(only(p, "check.hoodAirflow")).toEqual([]);
  });

  it("shares a unit under two hoods side by side by the area each covers", () => {
    const range = testItem("r", "range-6", 4000, 450);
    const left = testItem("a", "hood-wall", 3400, 550, 0, { width: 1200, connections: { exhaustM3h: 100 } });
    const right = testItem("b", "hood-wall", 4600, 550, 0, { width: 1200, connections: { exhaustM3h: 100 } });
    const half = needed(heatOf(range) / 2);
    expect(only(testProject([range, left, right]), "check.hoodAirflow")).toEqual([
      { key: "check.hoodAirflow", vars: { hood: 2, measured: 100, required: half }, itemIds: ["a", "r"] },
      { key: "check.hoodAirflow", vars: { hood: 3, measured: 100, required: half }, itemIds: ["b", "r"] },
    ]);
  });

  it("follows the planner's heat values", () => {
    const range = testItem("r", "range-6", 4000, 450, 0, { heat: { sensibleKw: 1, latentKw: 0 } });
    const hood = testItem("h", "hood-wall", 4000, 550, 0, { connections: { exhaustM3h: HOOD_AIR_PER_KW } });
    expect(only(testProject([range, hood]), "check.hoodAirflow")).toEqual([]);
    const more = { ...range, heat: { sensibleKw: 2, latentKw: 0 } };
    expect(only(testProject([more, hood]), "check.hoodAirflow")).toHaveLength(1);
  });
});

describe("points outside the room", () => {
  it("reports a point moved behind the wall", () => {
    const sink = testItem("s", "sink-1", 4000, 350, 0, { points: { coldWater: { y: -200 } } });
    expect(only(testProject([sink]), "check.pointOutside")).toEqual([{ key: "check.pointOutside", vars: { point: "1.KW" }, itemIds: ["s"] }]);
    expect(only(testProject([{ ...sink, points: undefined }]), "check.pointOutside")).toEqual([]);
  });

  it("reports a point inside a partition below its top, not one on its face or above it", () => {
    const wall = { id: "w", a: { x: 0, y: 3000 }, b: { x: 8000, y: 3000 }, thickness: 150, height: 3000 };
    // Its back against the partition's south face.
    const sink = testItem("s", "sink-1", 4000, 3000 + 75 + 350, 0, { points: { coldWater: { y: -50, z: 1000 } } });
    const p = testProject([sink]);
    p.room.partitions.push(wall);
    expect(only(p, "check.pointOutside")).toEqual([{ key: "check.pointOutside", vars: { point: "1.KW" }, itemIds: ["s"] }]);
    p.room.partitions[0] = { ...wall, height: 900 };
    expect(only(p, "check.pointOutside")).toEqual([]);
    p.room.partitions[0] = wall;
    p.items[0] = { ...sink, points: { coldWater: { y: 0, z: 1000 } } };
    expect(only(p, "check.pointOutside")).toEqual([]);
  });

  it("leaves the points of a unit already reported outside the room alone", () => {
    const p = testProject([testItem("s", "sink-1", 4000, -1000)]);
    expect(only(p, "check.outside", "check.pointOutside").map((i) => i.key)).toEqual(["check.outside"]);
  });
});
