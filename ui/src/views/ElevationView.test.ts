import { describe, expect, it } from "vitest";
import { annotationScale, elevationFitBox } from "./ElevationView";
import { exampleKitchen } from "../examples/exampleKitchen";
import { elevationDrawing } from "../model/elevation";
import { fitViewport } from "../lib/viewport";
import { drawingBounds, TEXT } from "../render/drawing";

describe("annotationScale", () => {
  it("keeps the screen's 1:40 while text reads, and grows in quarter octaves below that", () => {
    expect(annotationScale(0.1)).toBe(40);
    expect(annotationScale(1)).toBe(40);
    // 10 px of 2.5 mm text at 0.05 px/mm wants 1:80.
    expect(annotationScale(0.05)).toBeCloseTo(80);
    expect(annotationScale(0.045)).toBeCloseTo(40 * 2 ** (5 / 4));
    expect(annotationScale(0.0001)).toBe(100);
  });
});

describe("elevationFitBox", () => {
  // The north elevation of the example kitchen (13.2 m long) in a quarter pane.
  const p = exampleKitchen("de");
  const at = (paperScale: number) => elevationDrawing(p, "north", { showDims: true, paperScale });

  it("fits a long wall in a small pane with text of at least 10 px, the drawing inside the pane", () => {
    const [w, h] = [775, 500];
    const box = elevationFitBox(at, w, h);
    const vp = fitViewport(box, w, h);
    const ps = annotationScale(vp.k);
    expect(ps).toBeGreaterThan(40);
    expect(TEXT.normal * ps * vp.k).toBeGreaterThanOrEqual(10);
    // The drawing laid out at that scale lies inside the pane.
    const b = drawingBounds(at(ps), ps);
    expect(vp.ox + b.minX * vp.k).toBeGreaterThanOrEqual(0);
    expect(vp.ox + b.maxX * vp.k).toBeLessThanOrEqual(w);
    expect(vp.oy + b.minY * vp.k).toBeGreaterThanOrEqual(0);
    expect(vp.oy + b.maxY * vp.k).toBeLessThanOrEqual(h);
  });

  it("keeps 1:40 in a large pane", () => {
    const box = elevationFitBox(at, 4000, 2000);
    expect(annotationScale(fitViewport(box, 4000, 2000).k)).toBe(40);
  });
});
