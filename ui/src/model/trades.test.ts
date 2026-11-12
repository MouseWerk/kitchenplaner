import { describe, expect, it } from "vitest";
import { activeTrades, DN_SERIES, FUSE_SERIES, inFilter, PLUG_RATING, PLUGS, plugName, TRADE_GROUP, TRADE_GROUPS, TRADES, tradeCode, tradeGroupName, tradeName } from "./trades";

describe("trades", () => {
  it("lists every trade once, each in one group, and every group has trades", () => {
    expect(new Set(TRADES).size).toBe(11);
    expect(Object.keys(TRADE_GROUP).sort()).toEqual([...TRADES].sort());
    for (const g of TRADE_GROUPS) expect(TRADES.some((tr) => TRADE_GROUP[tr] === g)).toBe(true);
    expect(TRADES.filter((tr) => TRADE_GROUP[tr] === "sanitary")).toEqual(["coldWater", "hotWater", "softWater", "drain", "floorDrain"]);
    expect(TRADES.filter((tr) => TRADE_GROUP[tr] === "ventilation")).toEqual(["exhaust", "supply"]);
    expect(TRADES.filter((tr) => TRADE_GROUP[tr] === "special")).toEqual(["steam", "refrigeration"]);
  });

  it("switches a trade on by its value or flag, in TRADES order", () => {
    expect(activeTrades({})).toEqual([]);
    expect(activeTrades({ electricKw: 0, gasKw: 0, exhaustM3h: 0, coldWater: false, voltage: 400 })).toEqual([]);
    expect(
      activeTrades({ refrigerationKw: 2, steamKgH: 10, supplyM3h: 500, exhaustM3h: 600, floorDrain: true, drain: true, softWater: true, hotWater: true, coldWater: true, gasKw: 20, electricKw: 1 }),
    ).toEqual(TRADES);
    expect(activeTrades({ electricKw: 18.9, voltage: 400, coldWater: true, drain: true })).toEqual(["electric", "coldWater", "drain"]);
  });

  it("filters by group", () => {
    expect(inFilter("drain", "all")).toBe(true);
    expect(inFilter("drain", "sanitary")).toBe(true);
    expect(inFilter("drain", "electric")).toBe(false);
    expect(inFilter("steam", "special")).toBe(true);
  });

  it("has ascending size and fuse series", () => {
    for (const s of [...Object.values(DN_SERIES), FUSE_SERIES]) expect([...s].sort((a, b) => a - b)).toEqual(s);
    expect(DN_SERIES.coldWater).toEqual([15, 20, 25, 32, 40, 50]);
    expect(DN_SERIES.drain).toEqual([40, 50, 70, 100, 125]);
    expect(DN_SERIES.floorDrain).toEqual([100, 125, 150]);
    expect(DN_SERIES.exhaust?.[0]).toBe(100);
    expect(DN_SERIES.exhaust?.at(-1)).toBe(630);
    expect(DN_SERIES.electric).toBeUndefined();
    expect(FUSE_SERIES[0]).toBe(10);
    expect(FUSE_SERIES.at(-1)).toBe(125);
  });

  it("rates every plug; a fixed connection has no limit", () => {
    expect(PLUGS[0]).toBe("fixed");
    for (const p of PLUGS) expect(PLUG_RATING[p]).toBeGreaterThan(0);
    expect(PLUG_RATING.fixed).toBe(Infinity);
    expect(PLUG_RATING.cee32).toBe(32);
  });

  it("names trades, codes, groups and plugs in both languages, codes unique", () => {
    expect(tradeName("softWater", "de")).toBe("Enthärtetes Wasser");
    expect(tradeCode("coldWater", "de")).toBe("KW");
    expect(tradeCode("coldWater", "en")).toBe("CW");
    expect(tradeCode("steam", "en")).toBe("ST");
    for (const lang of ["de", "en"] as const) expect(new Set(TRADES.map((tr) => tradeCode(tr, lang))).size).toBe(TRADES.length);
    expect(tradeGroupName("sanitary", "de")).toBe("Sanitär");
    expect(tradeGroupName("special", "en")).toBe("Refrigeration and steam");
    expect(plugName("fixed", "de")).toBe("Festanschluss");
    expect(plugName("cee16", "en")).toBe("CEE 16 A");
  });
});
