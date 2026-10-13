import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { CATALOG } from "../model/catalog";
import { itemFromCatalog } from "../model/project";
import { buildItemObject } from "./meshes";
import { fitOrthoCamera, PRIORITY, ThumbnailQueue, viewDirection, type RendererFactory } from "./thumbnails";

const entry = (id: string) => CATALOG.find((e) => e.id === id)!;

/** A renderer that records what it drew and returns a fake URL. */
function fakeFactory() {
  const drawn: string[] = [];
  const disposed = vi.fn();
  const factory: RendererFactory = () => ({
    render: (e, w, h) => {
      drawn.push(e.id);
      return `data:${e.id}-${w}x${h}`;
    },
    dispose: disposed,
  });
  return { factory, drawn, disposed };
}

const drain = (q: ThumbnailQueue) => {
  while (q.step());
};

describe("framing", () => {
  it("fits every catalog model inside the image with a margin, centred", () => {
    const cam = new THREE.OrthographicCamera();
    for (const e of CATALOG) {
      const box = new THREE.Box3().setFromObject(buildItemObject(itemFromCatalog(e, 0, 0)));
      fitOrthoCamera(cam, box, 56 / 44);
      expect((cam.right - cam.left) / (cam.top - cam.bottom)).toBeCloseTo(56 / 44, 6);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      const p = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        // In front of the camera and inside the frustum depth.
        expect(p.z, e.id).toBeGreaterThan(-1);
        expect(p.z, e.id).toBeLessThan(1);
      }
      // Inside the image, touching the margin on the tighter axis.
      expect(minX, e.id).toBeGreaterThanOrEqual(-1);
      expect(maxX, e.id).toBeLessThanOrEqual(1);
      expect(minY, e.id).toBeGreaterThanOrEqual(-1);
      expect(maxY, e.id).toBeLessThanOrEqual(1);
      expect(Math.max(maxX - minX, maxY - minY), e.id).toBeGreaterThan(1.6);
      expect(minX + maxX, e.id).toBeCloseTo(0, 6);
      expect(minY + maxY, e.id).toBeCloseTo(0, 6);
    }
  });

  it("looks from the front right and above", () => {
    const d = viewDirection();
    expect(d.length()).toBeCloseTo(1, 6);
    expect(d.x).toBeGreaterThan(0);
    expect(d.y).toBeGreaterThan(0);
    expect(d.z).toBeGreaterThan(d.x);
  });
});

describe("queue", () => {
  afterEach(() => vi.useRealTimers());

  it("creates the renderer in a slice of its own, then draws one job per slice", () => {
    const { factory, drawn } = fakeFactory();
    const q = new ThumbnailQueue(factory);
    q.request(entry("fryer-2"), 56, 44, 1, PRIORITY.prefetch);
    q.request(entry("table"), 56, 44, 1, PRIORITY.prefetch);
    expect(q.step()).toBe(true);
    expect(q.hasRenderer).toBe(true);
    expect(drawn).toEqual([]);
    q.step();
    expect(drawn).toEqual(["fryer-2"]);
    q.step();
    expect(drawn).toEqual(["fryer-2", "table"]);
    expect(q.step()).toBe(false);
    q.reset();
  });

  it("draws the preview first, then visible rows, then the prefetch, and caches by size and pixel ratio", () => {
    const { factory, drawn } = fakeFactory();
    const q = new ThumbnailQueue(factory);
    q.request(entry("fryer-2"), 56, 44, 1, PRIORITY.prefetch);
    q.request(entry("table"), 56, 44, 1, PRIORITY.prefetch);
    q.request(entry("sink-1"), 56, 44, 1, PRIORITY.visible);
    const big = q.request(entry("column"), 240, 180, 2, PRIORITY.preview);
    q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    drain(q);
    expect(drawn).toEqual(["column", "sink-1", "table", "fryer-2"]);
    expect(q.get(big)).toEqual({ status: "ready", url: "data:column-480x360" });
    // Cached: asking again draws nothing.
    q.request(entry("column"), 240, 180, 2, PRIORITY.preview);
    drain(q);
    expect(drawn).toHaveLength(4);
    q.reset();
  });

  it("drops a preview that closed before it was drawn and sends rows that left the view back to prefetch", () => {
    const { factory, drawn } = fakeFactory();
    const q = new ThumbnailQueue(factory);
    q.request(entry("fryer-2"), 56, 44, 1, PRIORITY.prefetch);
    const row = q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    const big = q.request(entry("column"), 240, 180, 1, PRIORITY.preview);
    q.demote(big);
    q.demote(row);
    drain(q);
    expect(drawn).toEqual(["fryer-2", "table"]);
    expect(q.get(big).status).toBe("loading");
    q.reset();
  });

  it("reports unavailable for every thumbnail when WebGL cannot start", () => {
    const q = new ThumbnailQueue(() => {
      throw new Error("no WebGL");
    });
    const key = q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    drain(q);
    expect(q.get(key).status).toBe("unavailable");
    expect(q.get("anything").status).toBe("unavailable");
    expect(q.pending).toBe(0);
  });

  it("runs in idle slices, tells subscribers, and disposes the renderer after the queue ran dry", async () => {
    vi.useFakeTimers();
    const { factory, disposed } = fakeFactory();
    const log = vi.fn();
    const q = new ThumbnailQueue(factory, log);
    const seen = vi.fn();
    q.subscribe(seen);
    const keys = ["table", "fryer-2", "sink-1"].map((id) => q.request(entry(id), 56, 44, 1, PRIORITY.visible));
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(50);
    for (const k of keys) expect(q.get(k).status).toBe("ready");
    expect(seen).toHaveBeenCalledTimes(3);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/3 rendered/);
    expect(disposed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6000);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(q.hasRenderer).toBe(false);
    q.reset();
  });

  it("the real WebGL factory fails cleanly without WebGL (happy-dom)", async () => {
    const { webglFactory } = await import("./thumbnails");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const q = new ThumbnailQueue(webglFactory);
    const key = q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    drain(q);
    expect(q.get(key).status).toBe("unavailable");
    err.mockRestore();
  });
});
