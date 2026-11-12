import { describe, expect, it } from "vitest";
import { catalogEntry, variantConnections } from "../kinds/registry";
import { defaultPoints, PROFILES, registerPointRule } from "../kinds/parts/points";
import { rectRoom } from "./geometry";
import { cleanPoints, currentOf, ductSize, fitPlug, fuseFor, gasDn, itemPoints, pointLabel, projectPoints, setPoint, wallRefs, type ConnectionPoint } from "./points";
import { testItem } from "./testProject";
import { activeTrades, TRADES } from "./trades";
import type { Item, Room, Trade } from "./types";

const byTrade = (points: ConnectionPoint[], trade: Trade) => points.find((p) => p.trade === trade)!;

function room(points: Room["points"], partitions: Room["partitions"] = []): Room {
  return { points, height: 3000, wallThickness: 240, openings: [], partitions };
}

describe("electric values", () => {
  it("computes the current on one and three phases, and the fuse", () => {
    expect(currentOf(15.9, 400)).toBe(22.9);
    expect(currentOf(3, 230)).toBe(13);
    expect(currentOf(0, 400)).toBe(0);
    expect(fuseFor(22.9)).toBe(25);
    expect(fuseFor(16)).toBe(16);
    expect(fuseFor(0)).toBe(10);
    expect(fuseFor(130)).toBe(150);
  });

  it("grows a socket with the load and falls back to a fixed connection", () => {
    expect(fitPlug("schuko", 1, 16)).toBe("schuko");
    expect(fitPlug("schuko", 3, 16)).toBe("cee16");
    expect(fitPlug("schuko", 3, 25)).toBe("cee32");
    expect(fitPlug("schuko", 3, 40)).toBe("fixed");
    expect(fitPlug("cee63", 3, 50)).toBe("cee63");
    expect(fitPlug("fixed", 1, 10)).toBe("fixed");
  });
});

describe("pipe and duct sizes", () => {
  it("sizes gas pipes by load and ducts by air volume", () => {
    expect([gasDn(10), gasDn(25), gasDn(31), gasDn(50), gasDn(60)]).toEqual([15, 15, 20, 20, 25]);
    // 2600 m³/h at 6 m/s needs 392 mm; 500 m³/h at 3 m/s needs 243 mm.
    expect(ductSize(2600, 6)).toBe(400);
    expect(ductSize(500, 3)).toBe(250);
  });
});

describe("itemPoints", () => {
  const combi = (over: Partial<Item> = {}) => testItem("c", "combi-10", 2000, 2000, 0, { pos: 12, ...over });

  it("has one point per active trade, with the derived values", () => {
    const pts = itemPoints(combi());
    expect(pts.map((p) => p.trade)).toEqual(activeTrades(combi().connections));
    const e = byTrade(pts, "electric");
    expect(e.values).toEqual({ kw: 18.9, voltage: 400, phases: 3, currentA: 27.3, fuseA: 32, plug: "fixed" });
    // Right 150, back 50, 300 above the floor (the placement profile of a floor unit).
    expect([e.fromLeft, e.fromBack, e.z]).toEqual([700, 50, 300]);
    expect(e.at).toEqual({ x: 2000 + 275, y: 2000 - 375 });
    expect(e.set.size).toBe(0);
    expect(byTrade(pts, "coldWater").values.dn).toBe(15);
    // A cooking unit's drain is greasy (kinds/parts/pointRules.ts).
    expect(byTrade(pts, "drain").values).toEqual({ dn: 50, greasy: true });
  });

  it("gives a gas variant a sized gas point and an electric one none", () => {
    const entry = catalogEntry("combi-10")!;
    const gas = itemPoints(combi({ energy: "gas", connections: variantConnections(entry, { width: 850, energy: "gas" }) }));
    const g = byTrade(gas, "gas");
    expect(g.values.dn).toBe(15);
    expect(g.values.kw).toBeGreaterThan(0);
    expect(itemPoints(combi()).some((p) => p.trade === "gas")).toBe(false);
  });

  it("turns override positions with the unit", () => {
    const points = { coldWater: { x: 100, y: 50 } };
    expect(byTrade(itemPoints(combi({ points })), "coldWater").at).toEqual({ x: 1675, y: 1625 });
    const turned = byTrade(itemPoints(combi({ points, rotation: 90 })), "coldWater");
    expect(turned.at.x).toBeCloseTo(2375);
    expect(turned.at.y).toBeCloseTo(1675);
    expect([turned.fromLeft, turned.fromBack]).toEqual([100, 50]);
  });

  it("keeps an override's distance when the unit is resized; derived points keep theirs from their edge", () => {
    const wide = itemPoints(combi({ width: 1200, points: { coldWater: { x: 100 } } }));
    expect(byTrade(wide, "coldWater").fromLeft).toBe(100);
    expect(byTrade(wide, "electric").fromLeft).toBe(1050);
  });

  it("takes overridden values and derives the rest from them", () => {
    const pts = itemPoints(combi({ points: { electric: { currentA: 30, plug: "cee32", note: "eigener Kreis" }, drain: { greasy: true, dn: 70 } } }));
    const e = byTrade(pts, "electric");
    expect(e.values).toMatchObject({ currentA: 30, fuseA: 32, plug: "cee32", note: "eigener Kreis" });
    expect([...e.set]).toEqual(["currentA", "plug", "note"]);
    expect(byTrade(pts, "drain").values).toEqual({ dn: 70, greasy: true });
  });

  it("puts a table-top unit's socket above its lower edge and grows the socket with the load", () => {
    const steamer = byTrade(itemPoints(testItem("s", "steamer-tabletop", 1000, 1000)), "electric");
    expect(steamer.z).toBe(900 + 250);
    expect(steamer.values).toMatchObject({ currentA: 13, fuseA: 13, plug: "cee16" });
    expect(byTrade(itemPoints(testItem("m", "microwave", 1000, 1000)), "electric").values.plug).toBe("schuko");
  });

  it("puts flat points at the floor and air at the top of a hood", () => {
    const drain = byTrade(itemPoints(testItem("d", "floor-drain", 1000, 1000)), "drain");
    expect([drain.z, drain.at.x, drain.at.y]).toEqual([0, 1000, 1000]);
    const hood = testItem("h", "hood-wall", 2000, 600);
    const air = byTrade(itemPoints(hood), "exhaust");
    expect(air.z).toBe(hood.elevation + hood.height);
    expect(air.values).toEqual({ m3h: 2600, dn: 400 });
  });

  it("has no points without connections", () => {
    expect(itemPoints(testItem("t", "table", 1000, 1000, 0, { connections: {} }))).toEqual([]);
  });
});

describe("defaults", () => {
  it("define every trade in every profile", () => {
    for (const p of Object.values(PROFILES)) expect(Object.keys(p).sort()).toEqual([...TRADES].sort());
  });

  it("let a registered rule replace the profile and refine it", () => {
    registerPointRule(({ item }) => (item.id === "rule-test" ? { profile: "tilt", layout: { drain: { dn: 70, greasy: true } } } : undefined));
    const d = defaultPoints(testItem("rule-test", "combi-10", 0, 0));
    expect(d.coldWater.z).toEqual({ from: "floor", mm: 900 });
    expect(d.drain).toMatchObject({ dn: 70, greasy: true });
    // Other units are left alone.
    expect(defaultPoints(testItem("other", "combi-10", 0, 0)).coldWater.z).toEqual({ from: "floor", mm: 400 });
  });
});

describe("projectPoints and labels", () => {
  it("lists the points by position number and filters by group", () => {
    const items = [testItem("b", "microwave", 0, 0, 0, { pos: 7 }), testItem("a", "combi-10", 0, 0, 0, { pos: 3 })];
    expect(projectPoints(items).map((p) => pointLabel(p, "de"))).toEqual(["3.E", "3.KW", "3.EW", "3.AW", "7.E"]);
    expect(projectPoints(items, "sanitary").map((p) => pointLabel(p, "en"))).toEqual(["3.CW", "3.SW", "3.WD"]);
    expect(projectPoints(items, "gas")).toEqual([]);
  });
});

describe("setPoint and cleanPoints", () => {
  const item: Pick<Item, "points" | "connections"> = { connections: { electricKw: 10, voltage: 400, coldWater: true }, points: undefined };

  it("sets, clears and resets fields; an empty override goes", () => {
    let p = setPoint(item, "electric", { x: 100, fuseA: 32 });
    expect(p.points).toEqual({ electric: { x: 100, fuseA: 32 } });
    p = setPoint(p, "coldWater", { z: 600 });
    p = setPoint(p, "electric", { fuseA: undefined, note: "" });
    expect(p.points).toEqual({ electric: { x: 100 }, coldWater: { z: 600 } });
    p = setPoint(p, "electric", null);
    expect(p.points).toEqual({ coldWater: { z: 600 } });
    p = setPoint(p, "coldWater", { z: undefined });
    expect(p.points).toBeUndefined();
  });

  it("keeps the overrides of active trades only, in file order", () => {
    const points = { gas: { dn: 20 }, coldWater: { note: "Eckventil", z: 500 }, electric: {}, drain: { greasy: true } };
    const clean = cleanPoints({ ...item, points });
    expect(clean).toEqual({ coldWater: { z: 500, note: "Eckventil" } });
    expect(Object.keys(clean!.coldWater!)).toEqual(["z", "note"]);
    expect(cleanPoints({ ...item, points: { gas: { dn: 20 } } })).toBeUndefined();
    expect(cleanPoints(item)).toBeUndefined();
  });
});

describe("wallRefs", () => {
  it("measures from the nearest wall and the nearest one across it in a rectangle", () => {
    const refs = wallRefs(room(rectRoom(8000, 6000)), { x: 1000, y: 2000 });
    expect(refs).toEqual([
      { kind: "wall", index: 3, distance: 1000, foot: { x: 0, y: 2000 } },
      { kind: "wall", index: 0, distance: 2000, foot: { x: 1000, y: 0 } },
    ]);
  });

  it("takes a 45° wall as the second face when the parallel one is nearer", () => {
    // The south-east corner is cut at 45° (wall 2).
    const r = room([
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 5000, y: 4000 },
      { x: 0, y: 4000 },
    ]);
    const refs = wallRefs(r, { x: 4800, y: 3700 });
    expect(refs.map((w) => w.index)).toEqual([3, 2]);
    expect(refs[0].distance).toBeCloseTo(300);
    expect(refs[1].distance).toBeCloseTo(500 / Math.SQRT2);
    expect(refs[1].foot.x + refs[1].foot.y).toBeCloseTo(9000);
  });

  it("measures from a full-height partition, not from a parapet", () => {
    const full = { id: "p1", a: { x: 2000, y: 0 }, b: { x: 2000, y: 3000 }, thickness: 100, height: 3000 };
    const refs = wallRefs(room(rectRoom(8000, 6000), [full]), { x: 2350, y: 1000 });
    expect(refs).toEqual([
      { kind: "partition", index: 0, id: "p1", distance: 300, foot: { x: 2050, y: 1000 } },
      { kind: "wall", index: 0, distance: 1000, foot: { x: 2350, y: 0 } },
    ]);
    const low = { ...full, height: 1100 };
    expect(wallRefs(room(rectRoom(8000, 6000), [low]), { x: 2350, y: 1000 })[0]).toMatchObject({ kind: "wall", index: 0 });
  });
});
