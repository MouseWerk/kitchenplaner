import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { TOP_RADIUS } from "../kinds/parts/mesh";
import { CATALOG } from "../kinds/registry";
import { itemFromCatalog } from "../model/project";
import { buildItemObject } from "./meshes";
import { disposeMerged } from "./merge";
import { fitOrthoCamera, PRIORITY, thumbnailModel, ThumbnailQueue, viewDirection, type RendererFactory } from "./thumbnails";
import { buildId, decodeDataUrl, indexedDbStore, isPng, type ThumbStore } from "./thumbStore";

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

  // A lost context used to leave every later thumbnail of the session on the fallback.
  it("starts a new renderer after a failed render and tries that entry once more", () => {
    const drawn: string[] = [];
    const disposed = vi.fn();
    let renderers = 0;
    const failing = new Map([["table", 1], ["sink-1", 5]]);
    const q = new ThumbnailQueue(() => {
      renderers++;
      return {
        render: (e) => {
          const left = failing.get(e.id) ?? 0;
          if (left > 0) {
            failing.set(e.id, left - 1);
            throw new Error("context lost");
          }
          drawn.push(e.id);
          return `data:${e.id}`;
        },
        dispose: disposed,
      };
    });
    const table = q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    const sink = q.request(entry("sink-1"), 56, 44, 1, PRIORITY.visible);
    const fryer = q.request(entry("fryer-2"), 56, 44, 1, PRIORITY.visible);
    drain(q);
    // The table failed once and drew on the retry; the sink failed twice and keeps the fallback.
    expect(q.get(table)).toEqual({ status: "ready", url: "data:table" });
    expect(q.get(sink).status).toBe("unavailable");
    expect(q.get(fryer)).toEqual({ status: "ready", url: "data:fryer-2" });
    // Each of the three failures dropped its renderer; the next job started a fresh one.
    expect(disposed).toHaveBeenCalledTimes(3);
    expect(renderers).toBe(4);
    // Other entries still render after that.
    const range = q.request(entry("range-6"), 56, 44, 1, PRIORITY.visible);
    drain(q);
    expect(q.get(range).status).toBe("ready");
    q.reset();
  });

  // The previews show the units as the 3D view does: one look, defined in look.ts.
  it("render with the look of the 3D view", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(__dirname, "thumbnails.ts"), "utf8");
    expect(src).toMatch(/LOOK\.toneMapping/);
    expect(src).toMatch(/LOOK\.exposure/);
    expect(src).toMatch(/LOOK\.environmentIntensity/);
    expect(src).not.toMatch(/THREE\.\w+ToneMapping/);
    // The model is the merged one of the 3D view (metric UVs), not the raw parts.
    expect(src).toMatch(/const model = thumbnailModel\(entry\)/);
  });

  it("draw the model merged as the 3D view does: one mesh per material, the steel grain in metres", () => {
    const e = entry("table");
    const model = thumbnailModel(e);
    const names = model.children.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    const steel = model.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === "steel")!;
    const uv = steel.geometry.getAttribute("uv");
    const pos = steel.geometry.getAttribute("position");
    const nor = steel.geometry.getAttribute("normal");
    // The worktop's flat top (facing up at the item's height, centred, so its UVs are its plan
    // position in metres): 1.2 m wide less its rounded edges, so its grain runs that many UV
    // units (a raw part stretches it over 0..1).
    const top = e.height / 1000;
    const us: number[] = [];
    for (let i = 0; i < uv.count; i++) {
      const flat = nor.getY(i) > 0.999 && Math.abs(pos.getY(i) - top) < 1e-6;
      if (flat && Math.abs(uv.getX(i) - pos.getX(i)) < 1e-6 && Math.abs(uv.getY(i) - pos.getZ(i)) < 1e-6) us.push(uv.getX(i));
    }
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(e.width / 1000 - 2 * TOP_RADIUS, 3);
    disposeMerged(model);
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

  it("shows the images kept by an earlier session without a renderer, and keeps what it renders", async () => {
    const { factory, drawn } = fakeFactory();
    let created = 0;
    const counting: RendererFactory = () => {
      created++;
      return factory();
    };
    const kept = ThumbnailQueue.key("table", 56, 44, 1);
    const saved: string[] = [];
    let release!: () => void;
    const store: ThumbStore = {
      load: () => new Promise((ok) => (release = () => ok(new Map([[kept, new Blob([new Uint8Array([1])], { type: "image/png" })]])))),
      save: (key) => void saved.push(key),
    };
    const q = new ThumbnailQueue(counting, null, store);
    const table = q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    const sink = q.request(entry("sink-1"), 56, 44, 1, PRIORITY.visible);
    // Nothing is rendered while the store may still have it.
    expect(q.step()).toBe(false);
    expect(created).toBe(0);
    release();
    await new Promise((ok) => setTimeout(ok, 0));
    expect(q.get(table).status).toBe("ready");
    expect(q.get(table).url).toMatch(/^blob:/);
    expect(q.pending).toBe(1);
    drain(q);
    expect(drawn).toEqual(["sink-1"]);
    expect(saved).toEqual([sink]);
    q.reset();
  });

  it("draws a kept image the page cannot show once more, and forgets it in the store", async () => {
    const { factory, drawn } = fakeFactory();
    const key = ThumbnailQueue.key("table", 56, 44, 1);
    const dropped: string[] = [];
    const q = new ThumbnailQueue(factory, null, {
      load: async () => new Map([[key, new Blob([new Uint8Array([1])], { type: "image/png" })]]),
      save: () => {},
      drop: (k) => void dropped.push(k),
    });
    const seen: string[] = [];
    q.subscribe(() => seen.push(q.get(key).status));
    q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    await new Promise((ok) => setTimeout(ok, 0));
    expect(q.get(key).url).toMatch(/^blob:/);
    // The <img> reports an error: the kept image goes, a new one is drawn.
    q.failed(entry("table"), 56, 44, 1, PRIORITY.visible);
    expect(dropped).toEqual([key]);
    expect(q.get(key).status).toBe("loading");
    drain(q);
    expect(drawn).toEqual(["table"]);
    expect(q.get(key)).toEqual({ status: "ready", url: "data:table-56x44" });
    // Failing again, it keeps the fallback instead of drawing for ever.
    q.failed(entry("table"), 56, 44, 1, PRIORITY.visible);
    drain(q);
    expect(drawn).toEqual(["table"]);
    expect(q.get(key).status).toBe("unavailable");
    expect(seen.at(-1)).toBe("unavailable");
    q.reset();
  });

  it("with every image kept, creates no renderer at all", async () => {
    const { factory } = fakeFactory();
    let created = 0;
    const images = new Map(["table", "sink-1"].map((id) => [ThumbnailQueue.key(id, 56, 44, 1), new Blob([new Uint8Array([1])])]));
    const q = new ThumbnailQueue(
      () => {
        created++;
        return factory();
      },
      null,
      { load: async () => images, save: () => {} },
    );
    const keys = ["table", "sink-1"].map((id) => q.request(entry(id), 56, 44, 1, PRIORITY.visible));
    await new Promise((ok) => setTimeout(ok, 0));
    drain(q);
    for (const k of keys) expect(q.get(k).status).toBe("ready");
    expect(created).toBe(0);
    expect(q.hasRenderer).toBe(false);
    q.reset();
  });

  it("renders without the kept images when the store does not answer", async () => {
    vi.useFakeTimers();
    const { factory, drawn } = fakeFactory();
    const q = new ThumbnailQueue(factory, null, { load: () => new Promise(() => {}), save: () => {} });
    const key = q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    drain(q);
    expect(drawn).toEqual([]);
    await vi.advanceTimersByTimeAsync(2000);
    drain(q);
    expect(q.get(key).status).toBe("ready");
    q.reset();
  });

  it("draws nothing until the new renderer has its shaders ready", async () => {
    const drawn: string[] = [];
    let ready!: () => void;
    const q = new ThumbnailQueue(() => ({
      prepare: () => new Promise<void>((ok) => (ready = ok)),
      render: (e) => {
        drawn.push(e.id);
        return `data:${e.id}`;
      },
      dispose: () => {},
    }));
    q.request(entry("table"), 56, 44, 1, PRIORITY.visible);
    expect(q.step()).toBe(true);
    await Promise.resolve();
    expect(q.step()).toBe(false);
    expect(drawn).toEqual([]);
    ready();
    await new Promise((ok) => setTimeout(ok, 0));
    drain(q);
    expect(drawn).toEqual(["table"]);
    q.reset();
  });

  it("draws several images in an idle slice while its budget lasts; rows out of view wait for true idle", () => {
    const calls: { f: IdleRequestCallback; opts?: IdleRequestOptions }[] = [];
    vi.stubGlobal("requestIdleCallback", (f: IdleRequestCallback, opts?: IdleRequestOptions) => calls.push({ f, opts }));
    vi.stubGlobal("cancelIdleCallback", () => {});
    try {
      const { factory, drawn } = fakeFactory();
      const q = new ThumbnailQueue(factory);
      const ids = ["table", "sink-1", "fryer-2", "column"];
      for (const id of ids) q.request(entry(id), 56, 44, 1, PRIORITY.visible);
      const run = (left: number, didTimeout = false) => calls.shift()!.f({ didTimeout, timeRemaining: () => left });
      // Rows on screen: an idle callback with a deadline.
      expect(calls[0].opts?.timeout).toBeGreaterThan(0);
      run(50); // the renderer, a slice of its own
      expect(drawn).toEqual([]);
      run(50); // a long idle period: every image fits the budget
      expect(drawn).toEqual(ids);
      // A slice called because its deadline passed draws one image only.
      q.request(entry("range-6"), 56, 44, 1, PRIORITY.visible);
      q.request(entry("table"), 240, 180, 1, PRIORITY.visible);
      run(0, true);
      expect(drawn).toHaveLength(5);
      run(0, true);
      expect(drawn).toHaveLength(6);
      q.reset();
      // Only rows that left the view: no deadline, they wait for a truly idle main thread.
      calls.length = 0;
      const later = new ThumbnailQueue(factory);
      later.request(entry("fryer-2"), 240, 180, 1, PRIORITY.prefetch);
      expect(calls).toHaveLength(1);
      expect(calls[0].opts?.timeout).toBeUndefined();
      later.reset();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("thumbnail store", () => {
  it("decodes the PNG data URL of a render to its bytes", () => {
    const img = decodeDataUrl("data:image/png;base64,iVBORw0KGgo=")!;
    expect(img.type).toBe("image/png");
    expect([...new Uint8Array(img.bytes)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(decodeDataUrl("blob:abc")).toBeNull();
  });

  it("knows a PNG by its signature and a little more", () => {
    const png = decodeDataUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")!;
    expect(isPng(png.bytes)).toBe(true);
    // Only the signature, cut off inside it, or something else.
    expect(isPng(decodeDataUrl("data:image/png;base64,iVBORw0KGgo=")!.bytes)).toBe(false);
    expect(isPng(new Uint8Array([0x89, 0x50, 0x4e]).buffer)).toBe(false);
    expect(isPng(new Uint8Array(32).buffer)).toBe(false);
  });

  it("drops kept records that are no complete PNG, and keeps the others", async () => {
    // A minimal stand-in for IndexedDB: one database with one store, requests that succeed.
    const rows = new Map<string, unknown>();
    const req = <T,>(result: T) => {
      const r: { result: T; onsuccess?: () => void; onerror?: () => void } = { result };
      queueMicrotask(() => r.onsuccess?.());
      return r;
    };
    const store = {
      getAllKeys: () => req([...rows.keys()]),
      getAll: () => req([...rows.values()]),
      delete: (k: string) => rows.delete(k),
      put: (v: unknown, k: string) => rows.set(k, v),
    };
    const db = { transaction: () => ({ objectStore: () => store }), createObjectStore: () => store };
    vi.stubGlobal("indexedDB", { open: () => req(db) });
    try {
      const png = decodeDataUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")!;
      rows.set("good", { build: "b", type: "image/png", bytes: png.bytes });
      rows.set("cut", { build: "b", type: "image/png", bytes: png.bytes.slice(0, 5) });
      rows.set("garbled", { build: "b", type: "image/png", bytes: new Uint8Array(40).buffer });
      const images = await indexedDbStore("b")!.load();
      expect([...images.keys()]).toEqual(["good"]);
      expect([...rows.keys()]).toEqual(["good"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keys images by the hashed chunk of a production build, and keeps none in development", () => {
    expect(buildId(false, "http://tauri.localhost/assets/index-Ab12Cd34.js")).toBe("/assets/index-Ab12Cd34.js");
    expect(buildId(true, "http://127.0.0.1:1430/src/three/thumbnails.ts")).toBeNull();
  });
});

