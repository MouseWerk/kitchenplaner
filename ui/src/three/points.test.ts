import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { exampleKitchen } from "../examples/exampleKitchen";
import { itemPoints } from "../model/points";
import { testItem, testProject } from "../model/testProject";
import { inFilter, TRADE_GROUPS, TRADES } from "../model/trades";
import type { Item, Project, Trade } from "../model/types";
import { MM_PER_UNIT } from "./shared";

// The picture needs WebGL: the capture's chain records what the scene holds when it draws.
const drawn: { visible: boolean; stubs: number }[] = [];
vi.mock("./post", () => ({
  captureSize: () => ({ width: 2, height: 1 }),
  encodePng: () => new Uint8Array([1]),
  PostChain: class {
    constructor(
      _r: unknown,
      private readonly scene: THREE.Scene,
    ) {}
    render() {
      const root = this.scene.getObjectByName("points")!;
      let stubs = 0;
      root.traverseVisible((o) => {
        if (o instanceof THREE.InstancedMesh && (o.material as THREE.Material).depthWrite) stubs += o.count;
      });
      drawn.push({ visible: root.visible, stubs });
    }
    dispose() {}
  },
}));

const { PointStubs, stubShape } = await import("./points");
const { Engine } = await import("./engine");

/** Where the stubs of a trade stand (plan mm and height mm), in instance order. */
function stubPlaces(stubs: InstanceType<typeof PointStubs>, trade: Trade): { x: number; y: number; z: number; turn: number }[] {
  const m = stubs.meshesOf(trade);
  if (!m || !m.solid.visible) return [];
  const out = [];
  const mat = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < m.solid.count; i++) {
    m.solid.getMatrixAt(i, mat);
    mat.decompose(p, q, s);
    const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
    out.push({ x: Math.round(p.x * MM_PER_UNIT), y: Math.round(p.z * MM_PER_UNIT), z: Math.round(p.y * MM_PER_UNIT), turn: Math.round(THREE.MathUtils.radToDeg(e.y)) + 0 });
  }
  return out;
}

const combi = (over: Partial<Item> = {}) => testItem("c", "combi-10", 2000, 2000, 0, { pos: 1, ...over });

describe("connection point stubs", () => {
  const example = exampleKitchen("de");
  const all = example.items.flatMap(itemPoints);

  it("has one stub per point of the filtered group, in the trade's own mesh", () => {
    const stubs = new PointStubs();
    stubs.setItems(example.items);
    for (const group of TRADE_GROUPS) {
      expect(stubs.setFilter(group)).toBe(true);
      const want = all.filter((p) => inFilter(p.trade, group));
      expect(stubs.count()).toBe(want.length);
      for (const trade of TRADES) expect(stubs.count(trade)).toBe(want.filter((p) => p.trade === trade).length);
    }
    stubs.setFilter("all");
    expect(all.length).toBeGreaterThan(20);
    expect(stubs.count()).toBe(all.length);
    // Two draws per trade at most (in sight and hidden), however many points.
    const meshes = stubs.root.children.filter((o) => o instanceof THREE.InstancedMesh);
    expect(meshes.length).toBeLessThanOrEqual(2 * TRADES.length);
    stubs.dispose();
  });

  it("gives every trade group its own shape, and the floor drain a disc", () => {
    const shapes = TRADE_GROUPS.map((g) => stubShape(TRADES.find((t) => t !== "floorDrain" && inFilter(t, g))!));
    expect(new Set(shapes).size).toBe(TRADE_GROUPS.length);
    expect(stubShape("floorDrain")).toBe("disc");
    expect(stubShape("exhaust")).toBe("duct");
  });

  it("stands each stub at its point, after the unit's rotation, turned with the unit", () => {
    const stubs = new PointStubs();
    stubs.setFilter("all");
    for (const rotation of [0, 90, 270]) {
      const item = combi({ rotation });
      stubs.setItems([item]);
      for (const p of itemPoints(item)) {
        expect(stubPlaces(stubs, p.trade)).toEqual([{ x: Math.round(p.at.x), y: Math.round(p.at.y), z: Math.round(p.z), turn: (rotation > 180 ? 360 - rotation : -rotation) + 0 }]);
      }
    }
    // A turn of 90° puts the electric point (right, at the back) on the other side of the unit
    // than at 0°: the plan positions, not the unit's own frame.
    const at0 = itemPoints(combi()).find((p) => p.trade === "electric")!.at;
    const at90 = itemPoints(combi({ rotation: 90 })).find((p) => p.trade === "electric")!.at;
    expect(at0).not.toEqual(at90);
    stubs.dispose();
  });

  it("shows nothing while the filter is off, and derives nothing", () => {
    const stubs = new PointStubs();
    expect(stubs.setItems(example.items)).toBe(false);
    expect(stubs.count()).toBe(0);
    expect(stubs.root.visible).toBe(false);
    expect(stubs.root.children).toHaveLength(0);
    stubs.setFilter("electric");
    expect(stubs.count()).toBeGreaterThan(0);
    expect(stubs.setFilter("off")).toBe(true);
    expect(stubs.root.visible).toBe(false);
    expect(stubs.count()).toBe(0);
    stubs.dispose();
  });

  it("is not picked and casts no shadow", () => {
    const stubs = new PointStubs();
    stubs.setFilter("all");
    stubs.setItems([combi()]);
    const ray = new THREE.Raycaster(new THREE.Vector3(2, 5, 2), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(stubs.root, true)).toEqual([]);
    stubs.root.traverse((o) => {
      expect(o.castShadow).toBe(false);
      expect(o.receiveShadow).toBe(false);
    });
    stubs.dispose();
  });

  it("frees its geometry, materials and instance buffers on dispose", () => {
    const stubs = new PointStubs();
    stubs.setFilter("all");
    stubs.setItems(example.items);
    const disposed = new Set<unknown>();
    const watched = new Set<THREE.EventDispatcher<{ dispose: object }>>();
    stubs.root.traverse((o) => {
      if (!(o instanceof THREE.InstancedMesh)) return;
      watched.add(o).add(o.geometry).add(o.material as THREE.Material);
    });
    for (const w of watched) w.addEventListener("dispose", () => disposed.add(w));
    stubs.dispose();
    expect(disposed.size).toBe(watched.size);
    expect(stubs.root.children).toHaveLength(0);
  });
});

/** An engine without WebGL, with one combi already built: what `setProject` needs and no more. */
function fakeEngine(project: Project) {
  const e = Object.create(Engine.prototype) as Record<string, unknown> & {
    setProject(p: Project): void;
    setPoints(f: string): void;
    capture(w?: number): Promise<Uint8Array>;
    points: InstanceType<typeof PointStubs>;
    pending: Map<string, Item>;
  };
  const object = new THREE.Group();
  Object.assign(e, {
    project,
    room: project.room,
    items: new Map(project.items.map((i) => [i.id, { item: i, object }])),
    pending: new Map(),
    batches: { place: () => {} },
    points: new PointStubs(),
    contact: {},
    walkSpace: null,
    lost: false,
    roomObject: null,
    overlayRoot: new THREE.Group(),
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
    buildSlice: vi.fn(),
    followShadows: () => {},
    refreshShadows: () => {},
    finishBuild: () => {},
    afterBuild: () => {},
    requestRender: vi.fn(),
  });
  (e.scene as THREE.Scene).add(e.points.root);
  return e;
}

describe("connection point stubs in the 3D view", () => {
  it("moves the stubs with a moved or turned unit, without building anything again", () => {
    const item = combi();
    const e = fakeEngine(testProject([item]));
    e.setProject(e.project as Project);
    e.setPoints("all");
    const meshes = e.points.meshesOf("electric")!;
    const moved = { ...item, x: item.x + 1500, rotation: 90 };
    e.setProject({ ...testProject([moved]), room: (e.project as Project).room });
    expect(e.buildSlice).not.toHaveBeenCalled();
    expect(e.pending.size).toBe(0);
    // The same instanced mesh, its matrices rewritten.
    expect(e.points.meshesOf("electric")).toBe(meshes);
    const want = itemPoints(moved).find((p) => p.trade === "electric")!;
    expect(stubPlaces(e.points, "electric")).toEqual([{ x: Math.round(want.at.x), y: Math.round(want.at.y), z: want.z, turn: -90 }]);
  });

  it("follows the filter and draws only on a change", () => {
    const e = fakeEngine(testProject([combi()]));
    e.setProject(e.project as Project);
    e.setPoints("electric");
    expect(e.points.count()).toBe(1);
    expect(e.requestRender).toHaveBeenCalledTimes(1);
    e.setPoints("electric");
    expect(e.requestRender).toHaveBeenCalledTimes(1);
    e.setPoints("off");
    expect(e.points.count()).toBe(0);
    expect(e.requestRender).toHaveBeenCalledTimes(2);
  });

  it("puts the stubs into the exported picture while the filter is on, and none while off", async () => {
    const item = combi();
    const e = fakeEngine(testProject([item]));
    e.setProject(e.project as Project);
    drawn.length = 0;
    e.setPoints("all");
    await e.capture(400);
    e.setPoints("off");
    await e.capture(400);
    expect(drawn).toEqual([
      { visible: true, stubs: itemPoints(item).length },
      { visible: false, stubs: 0 },
    ]);
  });
});
