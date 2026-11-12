import { describe, expect, it } from "vitest";
import { fitViewport, resizedViewport, type Viewport } from "./viewport";

const box = { minX: 0, minY: 0, maxX: 10_000, maxY: 6_000 };

describe("resizedViewport", () => {
  it("re-fits a view the user has not panned or zoomed when its pane changes (layout switch, window resize)", () => {
    const before = fitViewport(box, 1600, 900);
    const after = resizedViewport(before, { w: 1600, h: 900 }, { w: 700, h: 400 }, true, box);
    expect(after).toEqual(fitViewport(box, 700, 400));
    // The whole drawing fits into the smaller pane.
    expect(box.maxX * after.k + after.ox).toBeLessThanOrEqual(700);
    // And back to the large pane: centred again, not left where the small one had it.
    expect(resizedViewport(after, { w: 700, h: 400 }, { w: 1600, h: 900 }, true, box)).toEqual(before);
  });

  it("keeps the scale of a view the user zoomed and keeps its middle in the middle", () => {
    const zoomed: Viewport = { k: 0.5, ox: 100, oy: 50 };
    expect(resizedViewport(zoomed, { w: 800, h: 600 }, { w: 1000, h: 500 }, false, box)).toEqual({ k: 0.5, ox: 200, oy: 0 });
    expect(resizedViewport(zoomed, { w: 800, h: 600 }, { w: 800, h: 600 }, false, box)).toBe(zoomed);
  });

  it("waits while the pane has no size (hidden, not laid out yet)", () => {
    const vp: Viewport = { k: 0.1, ox: 0, oy: 0 };
    expect(resizedViewport(vp, { w: 800, h: 600 }, { w: 0, h: 0 }, true, box)).toBe(vp);
    // The first size of a view that follows the pane fits it.
    expect(resizedViewport(vp, { w: 0, h: 0 }, { w: 800, h: 600 }, true, (w, h) => ({ ...box, maxX: w * 10, maxY: h * 10 }))).toEqual(fitViewport({ ...box, maxX: 8000, maxY: 6000 }, 800, 600));
  });
});
