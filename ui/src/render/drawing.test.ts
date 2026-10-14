import { describe, expect, it } from "vitest";
import { expandDim, type DimShape } from "./drawing";

const dim = (a: { x: number; y: number }, b: { x: number; y: number }, offset = 10): DimShape => ({ t: "dim", pen: "dim", a, b, offset, text: "1000" });

describe("dimension text direction", () => {
  it("reads every vertical dimension from the right (bottom to top), whichever way it was drawn", () => {
    expect(expandDim(dim({ x: 0, y: 0 }, { x: 0, y: 1000 }), 50).text.angle).toBe(-90);
    expect(expandDim(dim({ x: 0, y: 1000 }, { x: 0, y: 0 }), 50).text.angle).toBe(-90);
  });

  it("keeps horizontal dimensions upright in both directions", () => {
    expect(expandDim(dim({ x: 0, y: 0 }, { x: 1000, y: 0 }), 50).text.angle).toBeCloseTo(0);
    expect(Math.abs(expandDim(dim({ x: 1000, y: 0 }, { x: 0, y: 0 }), 50).text.angle ?? 0)).toBeCloseTo(0);
  });

  it("never turns slanted text upside down", () => {
    for (const deg of [-170, -120, -60, 30, 100, 150]) {
      const r = (deg * Math.PI) / 180;
      const a = expandDim(dim({ x: 0, y: 0 }, { x: Math.cos(r) * 1000, y: Math.sin(r) * 1000 }), 50).text.angle ?? 0;
      expect(a).toBeGreaterThanOrEqual(-90);
      expect(a).toBeLessThan(90);
    }
  });
});
