import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lRoom, rectRoom } from "../model/geometry";
import type { Opening, Partition, Room } from "../model/types";
import { applyCutaway, buildRoomObject, disposeRoomObject, insideRuns, wallPieces } from "./room";

const door: Opening = { id: "d", kind: "door", wall: 2, offset: 6800, width: 1010, height: 2135, sill: 0 };
const windowN: Opening = { id: "w", kind: "window", wall: 0, offset: 4000, width: 1500, height: 1200, sill: 1000 };

function room(openings: Opening[] = [door, windowN], points = rectRoom(8000, 6000)): Room {
  return { points, height: 3000, wallThickness: 240, openings, partitions: [] };
}

function wallMeshes(g: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh && typeof o.userData.wall === "number" && o.name !== "pane") out.push(o);
  });
  return out;
}

const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

describe("buildRoomObject", () => {
  it("extrudes the walls outwards by their thickness to the room height", () => {
    const g = buildRoomObject(room([]));
    const b = new THREE.Box3();
    for (const m of wallMeshes(g)) b.union(boxOf(m));
    expect(b.min.x).toBeCloseTo(-0.24, 4);
    expect(b.max.x).toBeCloseTo(8.24, 4);
    expect(b.min.z).toBeCloseTo(-0.24, 4);
    expect(b.max.z).toBeCloseTo(6.24, 4);
    expect(b.min.y).toBeCloseTo(0, 4);
    expect(b.max.y).toBeCloseTo(3, 4);
  });

  it("cuts a door out of its wall and keeps the wall above it", () => {
    const g = buildRoomObject(room());
    // Wall 2 runs from (8000, 6000) west to (0, 6000): the door spans x 695 to 1705 mm.
    const hole = new THREE.Box3(new THREE.Vector3(0.7, 0.01, 5.95), new THREE.Vector3(1.7, 2.12, 6.23));
    const above = new THREE.Box3(new THREE.Vector3(0.7, 2.2, 5.95), new THREE.Vector3(1.7, 2.9, 6.23));
    const meshes = wallMeshes(g);
    expect(meshes.some((m) => boxOf(m).intersectsBox(hole))).toBe(false);
    expect(meshes.some((m) => boxOf(m).intersectsBox(above))).toBe(true);
  });

  it("cuts a window and puts a transparent pane in it", () => {
    const g = buildRoomObject(room());
    const hole = new THREE.Box3(new THREE.Vector3(3.3, 1.01, -0.23), new THREE.Vector3(4.7, 2.19, -0.01));
    const sill = new THREE.Box3(new THREE.Vector3(3.3, 0.1, -0.23), new THREE.Vector3(4.7, 0.9, -0.01));
    const meshes = wallMeshes(g);
    expect(meshes.some((m) => boxOf(m).intersectsBox(hole))).toBe(false);
    expect(meshes.some((m) => boxOf(m).intersectsBox(sill))).toBe(true);
    const panes: THREE.Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.name === "pane") panes.push(o);
    });
    expect(panes).toHaveLength(1);
    expect((panes[0].material as THREE.Material).transparent).toBe(true);
    const pb = boxOf(panes[0]);
    expect(pb.min.y).toBeCloseTo(1, 4);
    expect(pb.max.y).toBeCloseTo(2.2, 4);
  });

  it("marks walls with their index and inward normal", () => {
    const g = buildRoomObject(room());
    const groups = g.children.filter((c) => typeof c.userData.wall === "number");
    expect(groups.map((c) => c.userData.wall)).toEqual([0, 1, 2, 3]);
    // Wall 2 is the south wall: into the room is north, -z.
    const south = groups[2].userData.inward as THREE.Vector3;
    expect(south.x).toBeCloseTo(0);
    expect(south.z).toBeCloseTo(-1);
  });

  it("hides the walls between the camera and the room in cutaway", () => {
    const g = buildRoomObject(room());
    const groups = g.children.filter((c) => typeof c.userData.wall === "number");
    // Camera south-east of the room, outside: the south and east walls are in the way.
    applyCutaway(g, new THREE.Vector3(12, 5, 12), true);
    expect(groups.map((c) => c.visible)).toEqual([true, false, false, true]);
    applyCutaway(g, new THREE.Vector3(12, 5, 12), false);
    expect(groups.every((c) => c.visible)).toBe(true);
  });

  it("closes reflex corners without walls reaching into the room", () => {
    const g = buildRoomObject(room([], lRoom(8000, 6000, 3000, 2000)));
    // Inside the room, just next to the inner corner at (5000, 4000).
    const inside = new THREE.Vector3(4.95, 1, 4.05);
    expect(wallMeshes(g).some((m) => boxOf(m).containsPoint(inside))).toBe(false);
    // The outer corner there is filled: the point diagonally outside belongs to a wall.
    const corner = new THREE.Vector3(5.2, 1, 4.2);
    expect(wallMeshes(g).some((m) => boxOf(m).containsPoint(corner))).toBe(true);
  });

  it("has a floor and disposes what it owns", () => {
    const g = buildRoomObject(room());
    const floor = g.children.find((c) => c.name === "floor") as THREE.Mesh;
    const fb = boxOf(floor);
    expect(fb.max.x).toBeCloseTo(8, 4);
    expect(fb.max.z).toBeCloseTo(6, 4);
    let disposed = 0;
    floor.geometry.addEventListener("dispose", () => disposed++);
    disposeRoomObject(g);
    expect(disposed).toBe(1);
  });
});

describe("wallPieces", () => {
  it("splits around an opening: left, below sill, above head, right", () => {
    const pieces = wallPieces(4000, 3000, [{ ...windowN, wall: 0, offset: 2000, width: 1000 }]);
    expect(pieces).toEqual([
      { s0: 0, s1: 1500, y0: 0, y1: 3000 },
      { s0: 1500, s1: 2500, y0: 0, y1: 1000 },
      { s0: 1500, s1: 2500, y0: 2200, y1: 3000 },
      { s0: 2500, s1: 4000, y0: 0, y1: 3000 },
    ]);
  });

  it("leaves no piece where a full-height passage is", () => {
    const pieces = wallPieces(4000, 3000, [{ id: "p", kind: "passage", wall: 0, offset: 2000, width: 1000, height: 3000, sill: 0 }]);
    expect(pieces).toEqual([
      { s0: 0, s1: 1500, y0: 0, y1: 3000 },
      { s0: 2500, s1: 4000, y0: 0, y1: 3000 },
    ]);
  });
});

describe("insideRuns", () => {
  it("clips grid lines to an L-shaped outline", () => {
    const pts = lRoom(8000, 6000, 3000, 2000);
    expect(insideRuns(pts, 6000, "x")).toEqual([[0, 4000]]);
    expect(insideRuns(pts, 5000, "y")).toEqual([[0, 5000]]);
  });
});

describe("buildRoomObject partitions", () => {
  /** North-south at x 3000 from the north wall's face, 100 mm thick, 2.4 m high. */
  const N: Partition = { id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 4000 }, thickness: 100, height: 2400 };

  function withPartition(openings: Opening[] = []): Room {
    return { ...room([door]), partitions: [N], openings: [door, ...openings] };
  }
  const partitionGroup = (g: THREE.Object3D) => g.children.find((c) => c.userData.partition === "n")!;
  const meshesOf = (g: THREE.Object3D, name?: string) => {
    const out: THREE.Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && (name === undefined ? o.name === "" : o.name === name)) out.push(o);
    });
    return out;
  };

  it("builds a partition as a wall box to its height, flush with the wall it starts at, marked with its id", () => {
    const g = buildRoomObject(withPartition());
    const group = partitionGroup(g);
    expect(group.name).toBe("partition-n");
    const b = boxOf(group);
    expect(b.min.x).toBeCloseTo(2.95, 4);
    expect(b.max.x).toBeCloseTo(3.05, 4);
    expect(b.min.z).toBeCloseTo(0, 4);
    expect(b.max.z).toBeCloseTo(4, 4);
    expect(b.max.y).toBeCloseTo(2.4, 4);
    group.traverse((o) => expect(o.userData.partition).toBe("n"));
    // Not an outer wall: the cutaway leaves it alone.
    expect(group.userData.wall).toBeUndefined();
  });

  it("cuts a door out of a partition and keeps the wall above it", () => {
    const g = buildRoomObject(withPartition([{ id: "pd", kind: "door", wall: 0, partition: "n", offset: 2000, width: 900, height: 2100, sill: 0 }]));
    const meshes = meshesOf(partitionGroup(g));
    const hole = new THREE.Box3(new THREE.Vector3(2.96, 0.01, 1.56), new THREE.Vector3(3.04, 2.09, 2.44));
    const above = new THREE.Box3(new THREE.Vector3(2.96, 2.15, 1.56), new THREE.Vector3(3.04, 2.35, 2.44));
    expect(meshes.some((m) => boxOf(m).intersectsBox(hole))).toBe(false);
    expect(meshes.some((m) => boxOf(m).intersectsBox(above))).toBe(true);
    // The outer walls are not cut by an opening that only names wall 0.
    const north = g.children.find((c) => c.userData.wall === 0)!;
    expect(meshesOf(north)).toHaveLength(1);
  });

  it("gives a window in a partition a pane and a hatch a stainless shelf on both sides", () => {
    const g = buildRoomObject(
      withPartition([
        { id: "pw", kind: "window", wall: 0, partition: "n", offset: 1000, width: 1000, height: 1000, sill: 1000 },
        { id: "ph", kind: "hatch", wall: 0, partition: "n", offset: 3000, width: 1200, height: 800, sill: 900 },
      ]),
    );
    const group = partitionGroup(g);
    const panes = meshesOf(group, "pane");
    expect(panes).toHaveLength(1);
    expect(boxOf(panes[0]).getCenter(new THREE.Vector3()).x).toBeCloseTo(3, 4);
    const shelves = meshesOf(group, "shelf");
    expect(shelves).toHaveLength(1);
    const sb = boxOf(shelves[0]);
    // 100 mm wall plus 250 mm on each side; top at the sill, 30 mm thick, 1200 mm wide.
    expect(sb.min.x).toBeCloseTo(2.7, 4);
    expect(sb.max.x).toBeCloseTo(3.3, 4);
    expect(sb.max.y).toBeCloseTo(0.9, 4);
    expect(sb.min.y).toBeCloseTo(0.87, 4);
    expect(sb.max.z - sb.min.z).toBeCloseTo(1.2, 4);
    const steel = shelves[0].material as THREE.MeshStandardMaterial;
    expect(steel.metalness).toBeGreaterThan(0.5);
    // The hatch is cut out above its sill.
    const hole = new THREE.Box3(new THREE.Vector3(2.96, 0.91, 2.41), new THREE.Vector3(3.04, 1.69, 3.59));
    expect(meshesOf(group).some((m) => boxOf(m).intersectsBox(hole))).toBe(false);
  });

  it("puts a hatch shelf through an outer wall too, reaching outside", () => {
    const g = buildRoomObject(room([{ id: "h", kind: "hatch", wall: 1, offset: 3000, width: 1200, height: 800, sill: 900 }]));
    const east = g.children.find((c) => c.userData.wall === 1)!;
    const shelves = meshesOf(east, "shelf");
    expect(shelves).toHaveLength(1);
    const sb = boxOf(shelves[0]);
    expect(sb.min.x).toBeCloseTo(7.75, 4);
    expect(sb.max.x).toBeCloseTo(8.49, 4);
  });

  it("keeps partitions visible in cutaway and disposes their geometry and materials", () => {
    const g = buildRoomObject(withPartition([{ id: "ph", kind: "hatch", wall: 0, partition: "n", offset: 3000, width: 1200, height: 800, sill: 900 }]));
    applyCutaway(g, new THREE.Vector3(12, 5, 12), true);
    expect(partitionGroup(g).visible).toBe(true);
    let geos = 0;
    let mats = 0;
    const counted = new Set<THREE.Material>();
    partitionGroup(g).traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.addEventListener("dispose", () => geos++);
      const m = o.material as THREE.Material;
      if (!counted.has(m)) {
        counted.add(m);
        m.addEventListener("dispose", () => mats++);
      }
    });
    disposeRoomObject(g);
    expect(geos).toBe(meshesOf(partitionGroup(g)).length + 1);
    // Wall and steel material.
    expect(mats).toBe(2);
  });
});
