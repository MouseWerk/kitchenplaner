import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { Item } from "../model/types";
import { testItem } from "../model/testProject";

// The picture itself needs WebGL; what is drawn is recorded instead: the items built by then.
const drawn: { pending: number; built: string[]; steps: string[] }[] = [];
const steps: string[] = [];
vi.mock("./post", () => ({
  captureSize: () => ({ width: 2, height: 1 }),
  encodePng: () => new Uint8Array([1]),
  PostChain: class {
    render() {
      drawn.push({ pending: engine.pending.size, built: [...engine.items.keys()], steps: [...steps] });
    }
    dispose() {}
  },
}));

const { Engine } = await import("./engine");
const { ItemBatches } = await import("./batch");

interface Fake {
  capture: (widthPx?: number) => Promise<Uint8Array>;
  pending: Map<string, Item>;
  items: Map<string, unknown>;
  batches: InstanceType<typeof ItemBatches>;
  shadowTimer: number;
}

let engine: Fake;

/**
 * An engine without a WebGL context: its fields as the constructor leaves them, the renderer a
 * stub, and the shadow and framing steps recorded.
 */
function fakeEngine(pending: Item[], shadowTimer = 0): Fake {
  const e = Object.create(Engine.prototype) as Fake;
  Object.assign(e, {
    lost: false,
    pending: new Map(pending.map((i) => [i.id, i])),
    items: new Map(),
    itemsRoot: new THREE.Group(),
    batches: new ItemBatches(),
    overlayRoot: new THREE.Group(),
    buildFrame: 1,
    shadowTimer,
    roomObject: null,
    camera: new THREE.PerspectiveCamera(),
    scene: new THREE.Scene(),
    background: new THREE.Color(),
    quality: "standard",
    renderer: {
      getContext: () => ({ getParameter: () => 4096, MAX_RENDERBUFFER_SIZE: 0x84e8 }),
      capabilities: { maxTextureSize: 4096 },
      getPixelRatio: () => 1,
      readRenderTargetPixels: () => {},
      setRenderTarget: () => {},
    },
    size: () => ({ width: 200, height: 100 }),
    requestRender: () => {},
    refreshShadows: () => steps.push("shadows"),
    afterBuild: () => steps.push("frame"),
  });
  return e;
}

describe("3D capture", () => {
  it("builds the models still pending before it draws, with their shadows and the fit", async () => {
    drawn.length = 0;
    steps.length = 0;
    engine = fakeEngine([testItem("a", "table", 1000, 1000), testItem("b", "table", 3000, 1000), testItem("c", "table", 5000, 1000)]);
    await engine.capture(400);
    expect(drawn).toEqual([{ pending: 0, built: ["a", "b", "c"], steps: ["shadows", "frame"] }]);
    // Three tables of one model: every part an instance, each geometry once.
    const { instances, geometries } = engine.batches.stats;
    expect(instances).toBe(3 * geometries);
    expect(geometries).toBeGreaterThan(0);
  });

  it("draws shadows that wait for their interval before the picture", async () => {
    drawn.length = 0;
    steps.length = 0;
    engine = fakeEngine([], 5);
    await engine.capture(400);
    expect(drawn).toEqual([{ pending: 0, built: [], steps: ["shadows"] }]);
  });

  it("draws the selected item by its own meshes (with the highlight) and the others from the batches", async () => {
    drawn.length = 0;
    engine = fakeEngine([testItem("a", "table", 1000, 1000), testItem("b", "table", 3000, 1000)]);
    await engine.capture(400);
    const e = engine as unknown as Record<string, unknown> & { updateOverlays(): void; items: Map<string, { object: THREE.Group }> };
    Object.assign(e, {
      hover: null,
      outlineBox: new THREE.BufferGeometry(),
      selectedLine: new THREE.LineBasicMaterial(),
      selectedHidden: new THREE.LineBasicMaterial(),
      hoverLine: new THREE.LineBasicMaterial(),
    });
    const shown = (id: string) => e.items.get(id)!.object.children.filter((c) => c.visible).length;
    const parts = e.items.get("a")!.object.children.length;
    expect(shown("a")).toBe(0);
    e.selection = ["a"];
    e.updateOverlays();
    expect(shown("a")).toBe(parts);
    expect(shown("b")).toBe(0);
    e.selection = [];
    e.updateOverlays();
    expect(shown("a")).toBe(0);
  });
});

