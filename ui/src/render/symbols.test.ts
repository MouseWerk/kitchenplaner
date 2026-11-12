import { describe, expect, it } from "vitest";
import { SYMBOL_SIZE, SYMBOLS, symbolOf, symbolParts, symbolShapes, symbolTrade, type SymbolId } from "./symbols";
import { SHEET_SCALES } from "./svg";
import { TRADES } from "../model/trades";
import type { Vec2 } from "../model/types";
import type { Shape } from "./drawing";

/** The extent of a symbol's shapes, arcs sampled by the degree (plan mm). */
function extent(shapes: Shape[]) {
  const pts: Vec2[] = [];
  for (const s of shapes) {
    if (s.t === "poly") pts.push(...s.pts);
    else if (s.t === "circle") pts.push({ x: s.c.x - s.r, y: s.c.y - s.r }, { x: s.c.x + s.r, y: s.c.y + s.r });
    else if (s.t === "arc") {
      for (let a = s.a0; a <= s.a1; a += 1) pts.push({ x: s.c.x + s.r * Math.cos((a * Math.PI) / 180), y: s.c.y + s.r * Math.sin((a * Math.PI) / 180) });
    } else throw new Error(`a symbol has no ${s.t}`);
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe("connection point symbols", () => {
  const at = { x: 1234.5, y: -678 };

  it("are centred on the point and fit their 3 mm square at every scale", () => {
    for (const ps of [40, ...SHEET_SCALES]) {
      for (const id of SYMBOLS) {
        const e = extent(symbolShapes(id, at, ps, { trade: symbolTrade(id) }));
        const half = (SYMBOL_SIZE / 2) * ps;
        expect(e.minX, `${id} 1:${ps}`).toBeGreaterThanOrEqual(at.x - half - 1e-6);
        expect(e.maxX, `${id} 1:${ps}`).toBeLessThanOrEqual(at.x + half + 1e-6);
        expect(e.minY, `${id} 1:${ps}`).toBeGreaterThanOrEqual(at.y - half - 1e-6);
        expect(e.maxY, `${id} 1:${ps}`).toBeLessThanOrEqual(at.y + half + 1e-6);
        // Centred within a hundredth of a paper millimetre.
        expect(Math.abs((e.minX + e.maxX) / 2 - at.x) / ps, `${id} 1:${ps}`).toBeLessThan(0.01);
        expect(Math.abs((e.minY + e.maxY) / 2 - at.y) / ps, `${id} 1:${ps}`).toBeLessThan(0.01);
        // At least two thirds of the square, so none of them shrinks to a dot.
        expect(Math.max(e.maxX - e.minX, e.maxY - e.minY) / ps, id).toBeGreaterThanOrEqual(SYMBOL_SIZE * (2 / 3));
      }
    }
  });

  it("are black lines told apart by shape, on the connection pen, carrying their trade", () => {
    const seen = new Map<string, SymbolId>();
    for (const id of SYMBOLS) {
      const shapes = symbolShapes(id, at, 50, { trade: symbolTrade(id) });
      for (const s of shapes) {
        expect(s.pen).toBe("connection");
        expect(s.trade).toBe(symbolTrade(id));
        expect(s.itemId).toBeUndefined();
        expect("fill" in s ? s.fill : undefined).toBeUndefined();
      }
      const key = JSON.stringify(symbolParts(id));
      expect(seen.get(key), `${id} looks like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("give every trade a symbol of that trade, electric ones by connection type", () => {
    for (const tr of TRADES) expect(symbolTrade(symbolOf(tr))).toBe(tr);
    expect(symbolOf("electric", "fixed")).toBe("E_FEST");
    expect(symbolOf("electric")).toBe("E_FEST");
    expect(symbolOf("electric", "schuko")).toBe("E_SCHUKO");
    for (const p of ["cee16", "cee32", "cee63"] as const) expect(symbolOf("electric", p)).toBe("E_CEE");
    expect(new Set(TRADES.map((tr) => symbolOf(tr))).size).toBe(TRADES.length);
  });

  it("tags the shapes of a drawn point with the point", () => {
    const point = { itemId: "c", trade: "coldWater" as const };
    for (const s of symbolShapes("KW", at, 50, { trade: "coldWater", point })) expect(s.point).toEqual(point);
  });
});
