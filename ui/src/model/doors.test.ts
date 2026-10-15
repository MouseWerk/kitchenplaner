import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { checkProject, doorClearances } from "./checks";
import { doorHand, doorLeaves, doorSetup, flipHinge, flipSwing, openingFrame } from "./doors";
import { elevationDrawing } from "./elevation";
import { bounds } from "./geometry";
import { planDrawing } from "./plan";
import { testItem, testProject } from "./testProject";
import type { DoorHinge, DoorSwing, Opening, Partition, Project } from "./types";
import type { ArcShape, PolyShape, Shape } from "../render/drawing";
import { buildRoomObject } from "../three/room";

const NONE = { showNames: false, showDims: false };
const arcsOf = (s: Shape[]) => s.filter((x): x is ArcShape => x.t === "arc" && x.pen === "swing");
const polys = (s: Shape[]) => s.filter((x): x is PolyShape => x.t === "poly");

/** North-south partition at x 3000 from the north wall, 100 mm thick; left of a→b (south) is east. */
const N: Partition = { id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 4000 }, thickness: 100, height: 3000 };

/** The test room with its south wall door (x 1705 start to 695 end, wall face y 6000, outer face 6240) set up as given. */
function withWallDoor(patch: Partial<Opening>, items = [] as ReturnType<typeof testItem>[]): Project {
  const p = testProject(items);
  p.room.openings = [{ ...p.room.openings[0], ...patch }];
  return p;
}

/** The test room with a door in N spanning y 1550 (start) to 2450 (end), set up as given. */
function withPartitionDoor(patch: Partial<Opening>, items = [] as ReturnType<typeof testItem>[]): Project {
  const p = testProject(items);
  p.room.partitions = [N];
  p.room.openings = [{ id: "pd", kind: "door", wall: 0, partition: "n", offset: 2000, width: 900, height: 2100, sill: 0, ...patch }];
  return p;
}

/** The middle of an arc (plan point). */
function arcMid(a: ArcShape) {
  const m = ((a.a0 + a.a1) / 2) * (Math.PI / 180);
  return { x: a.c.x + a.r * Math.cos(m), y: a.c.y + a.r * Math.sin(m) };
}

describe("doorSetup and flips", () => {
  it("defaults to hinged at the start, opening in, one leaf, and flips each setting", () => {
    const o: Opening = { id: "d", kind: "door", wall: 0, offset: 500, width: 900, height: 2100, sill: 0 };
    expect(doorSetup(o)).toEqual({ hinge: "start", swing: "in", leaves: 1 });
    expect(doorSetup(flipHinge(o))).toEqual({ hinge: "end", swing: "in", leaves: 1 });
    expect(doorSetup(flipSwing(o))).toEqual({ hinge: "start", swing: "out", leaves: 1 });
    expect(doorSetup(flipHinge(flipHinge(o))).hinge).toBe("start");
  });
});

describe("plan: door swing for every hinge side, opening direction and host", () => {
  // [host, hinge, swing, hinge point, test of the arc's middle]
  const cases: [string, DoorHinge, DoorSwing, { x: number; y: number }, (m: { x: number; y: number }) => boolean][] = [
    // Outer wall: in is north of the inner face (y 6000), out south of the outer face (y 6240).
    ["wall", "start", "in", { x: 1705, y: 6000 }, (m) => m.y < 6000 && m.x < 1705],
    ["wall", "start", "out", { x: 1705, y: 6240 }, (m) => m.y > 6240 && m.x < 1705],
    ["wall", "end", "in", { x: 695, y: 6000 }, (m) => m.y < 6000 && m.x > 695],
    ["wall", "end", "out", { x: 695, y: 6240 }, (m) => m.y > 6240 && m.x > 695],
    // Partition: in is east of its east face (x 3050), out west of its west face (x 2950).
    ["partition", "start", "in", { x: 3050, y: 1550 }, (m) => m.x > 3050 && m.y > 1550],
    ["partition", "start", "out", { x: 2950, y: 1550 }, (m) => m.x < 2950 && m.y > 1550],
    ["partition", "end", "in", { x: 3050, y: 2450 }, (m) => m.x > 3050 && m.y < 2450],
    ["partition", "end", "out", { x: 2950, y: 2450 }, (m) => m.x < 2950 && m.y < 2450],
  ];
  for (const [host, hinge, swing, at, side] of cases) {
    it(`${host}, hinge ${hinge}, opening ${swing}`, () => {
      const p = host === "wall" ? withWallDoor({ hinge, swing }) : withPartitionDoor({ hinge, swing });
      const shapes = planDrawing(p, NONE).shapes;
      const arcs = arcsOf(shapes);
      expect(arcs).toHaveLength(1);
      expect(arcs[0].c.x).toBeCloseTo(at.x);
      expect(arcs[0].c.y).toBeCloseTo(at.y);
      expect(arcs[0].a1 - arcs[0].a0).toBe(90);
      expect(side(arcMid(arcs[0]))).toBe(true);
      // The open leaf starts at the hinge and stands square to the wall, on the same side.
      const leaf = polys(shapes).find((s) => s.pen === "opening" && Math.hypot(s.pts[0].x - at.x, s.pts[0].y - at.y) < 1)!;
      const end = leaf.pts[1];
      expect(Math.hypot(end.x - at.x, end.y - at.y)).toBeCloseTo(arcs[0].r);
      const m = arcMid(arcs[0]);
      expect(Math.sign(Math.round(host === "wall" ? end.y - at.y : end.x - at.x))).toBe(Math.sign(Math.round(host === "wall" ? m.y - at.y : m.x - at.x)));
    });
  }

  it("draws two leaves with an arc each, hinged at both jambs, half the width", () => {
    const arcs = arcsOf(planDrawing(withWallDoor({ leaves: 2, swing: "out" }), NONE).shapes);
    expect(arcs.map((a) => Math.round(a.c.x)).sort()).toEqual([1705, 695].sort());
    for (const a of arcs) {
      expect(a.r).toBeCloseTo(505);
      expect(a.c.y).toBeCloseTo(6240);
      expect(arcMid(a).y).toBeGreaterThan(6240);
    }
  });

  it("draws a sliding door without an arc: leaf on its face, dashed where it parks, an arrow that way", () => {
    const shapes = planDrawing(withWallDoor({ kind: "slidingDoor", hinge: "start" }), NONE).shapes;
    expect(arcsOf(shapes)).toHaveLength(0);
    const leaf = polys(shapes).find((s) => s.pen === "opening" && s.closed)!;
    const b = bounds(leaf.pts);
    // On the room side of the inner face, overlapping both jambs.
    expect(b.maxY).toBeCloseTo(5990);
    expect(b.minY).toBeCloseTo(5950);
    expect(b.minX).toBeCloseTo(645);
    expect(b.maxX).toBeCloseTo(1755);
    // Parked towards the start jamb (east).
    const parked = bounds(polys(shapes).find((s) => s.pen === "hidden" && s.closed)!.pts);
    expect(parked.minX).toBeGreaterThan(1600);
    expect(parked.maxX).toBeCloseTo(2765);
    const arrow = polys(shapes).filter((s) => s.pen === "swing");
    expect(arrow).toHaveLength(2);
    expect(arrow[0].pts[1].x).toBeGreaterThan(arrow[0].pts[0].x);
    // Running on the outer face instead and sliding west.
    const out = planDrawing(withWallDoor({ kind: "slidingDoor", hinge: "end", swing: "out" }), NONE).shapes;
    const ob = bounds(polys(out).find((s) => s.pen === "opening" && s.closed)!.pts);
    expect(ob.minY).toBeCloseTo(6250);
    expect(bounds(polys(out).find((s) => s.pen === "hidden" && s.closed)!.pts).maxX).toBeLessThan(800);
  });
});

describe("doorHand", () => {
  it("names the hand by DIN: hinges left or right seen from the side the door opens to", () => {
    const p = withWallDoor({});
    const f = openingFrame(p.room, p.room.openings[0])!.frame;
    // Seen from inside looking south, the start jamb (east) is on the left.
    expect(doorHand(f, { hinge: "start", swing: "in" })).toBe("left");
    expect(doorHand(f, { hinge: "end", swing: "in" })).toBe("right");
    // Seen from outside looking north, east is on the right.
    expect(doorHand(f, { hinge: "start", swing: "out" })).toBe("right");
    expect(doorHand(f, { hinge: "end", swing: "out" })).toBe("left");
  });

  it("orders the leaves active leaf first", () => {
    const p = withWallDoor({ leaves: 2, hinge: "end" });
    const { frame, opening } = openingFrame(p.room, p.room.openings[0])!;
    const leaves = doorLeaves(frame, opening);
    expect(leaves.map((l) => Math.round(l.hinge.x))).toEqual([695, 1705]);
  });
});

describe("plan check: door clearances follow the door", () => {
  // A table 700 deep with its back 50 mm off the door's wall face, or off the partition.
  const southTable = (y = 5600) => testItem("t", "table", 1200, y);

  it("checks the side a door opens to and leaves an outer door opening out alone", () => {
    expect(checkProject(withWallDoor({}, [southTable()])).map((i) => i.key)).toEqual(["check.doorBlocked"]);
    expect(checkProject(withWallDoor({ swing: "out" }, [southTable()]))).toEqual([]);
    expect(doorClearances(withWallDoor({ swing: "out" }))).toEqual([]);
  });

  it("checks a partition door on the side it opens to, in or out", () => {
    const east = testItem("e", "table", 3700, 2000, 90);
    const west = testItem("w", "table", 2300, 2000, 90);
    expect(checkProject(withPartitionDoor({}, [east, west])).flatMap((i) => i.itemIds)).toEqual(["e"]);
    expect(checkProject(withPartitionDoor({ swing: "out" }, [east, west])).flatMap((i) => i.itemIds)).toEqual(["w"]);
  });

  it("needs only half the depth in front of a door with two leaves", () => {
    // 700 deep, its back at y 5350: 650 mm from the wall face, beyond the 505 mm leaves.
    const t = southTable(5000);
    expect(checkProject(withWallDoor({}, [t])).map((i) => i.key)).toEqual(["check.doorBlocked"]);
    expect(checkProject(withWallDoor({ leaves: 2 }, [t]))).toEqual([]);
  });

  it("keeps a sliding door's track and parking place free, but not a swing square", () => {
    expect(checkProject(withWallDoor({ kind: "slidingDoor" }, [southTable(5000)]))).toEqual([]);
    // A table against the wall beside the opening, where the leaf parks (east of x 1705).
    const parked = testItem("p", "table", 2400, 5650, 180);
    expect(checkProject(withWallDoor({ kind: "slidingDoor", hinge: "start" }, [parked])).map((i) => i.key)).toEqual(["check.doorBlocked"]);
    expect(checkProject(withWallDoor({ kind: "slidingDoor", hinge: "end" }, [parked]))).toEqual([]);
    // Running outside: the room side of the opening stays to keep free.
    expect(checkProject(withWallDoor({ kind: "slidingDoor", swing: "out" }, [testItem("s", "table", 1200, 5600)])).map((i) => i.key)).toEqual(["check.doorBlocked"]);
  });
});

describe("elevation: door leaves", () => {
  // Looking south, u runs west: the start jamb (x 1705) is at -1705, the end at -695.
  it("points the opening triangle to the hinge, solid when it opens towards the viewer", () => {
    const tri = (p: Project) => polys(elevationDrawing(p, "south", { showDims: false }).shapes).filter((s) => (s.pen === "swing" || s.pen === "hidden") && s.pts.length === 3);
    const inStart = tri(withWallDoor({}));
    expect(inStart).toHaveLength(1);
    expect(inStart[0].pen).toBe("swing");
    // The apex in the middle lies at the start jamb inside the frame.
    expect(inStart[0].pts[1].x).toBeCloseTo(-1705 + 60);
    const outEnd = tri(withWallDoor({ hinge: "end", swing: "out" }));
    expect(outEnd[0].pen).toBe("hidden");
    expect(outEnd[0].pts[1].x).toBeCloseTo(-695 - 60);
    expect(tri(withWallDoor({ leaves: 2 }))).toHaveLength(2);
  });

  it("puts the handle at the lock edge, at 1050 mm", () => {
    const handle = polys(elevationDrawing(withWallDoor({}), "south", { showDims: false }).shapes).find((s) => s.pen === "detail" && s.pts.length === 2 && s.pts[0].y === -1050)!;
    // Hinge at -1645, lock edge at -755: the handle near the lock edge, pointing towards the hinge.
    expect(handle.pts[0].x).toBeGreaterThan(-900);
    expect(handle.pts[1].x).toBeLessThan(handle.pts[0].x);
  });

  it("draws a sliding door's leaf over the opening and its track over the parking place", () => {
    const shapes = polys(elevationDrawing(withWallDoor({ kind: "slidingDoor", hinge: "start" }), "south", { showDims: false }).shapes);
    const leaf = bounds(shapes.find((s) => s.pen === "opening" && s.closed && bounds(s.pts).minX < -1705)!.pts);
    expect(leaf.minX).toBeCloseTo(-1755);
    expect(leaf.maxX).toBeCloseTo(-645);
    const track = bounds(shapes.find((s) => s.pen === "detail" && s.closed)!.pts);
    // Parks towards the start jamb: west on the sheet, further than the leaf.
    expect(track.minX).toBeCloseTo(-2765);
    expect(track.maxX).toBeCloseTo(-645);
  });

  it("draws a partition door dashed from the side it opens away from", () => {
    // N's door opens east ("in"): seen from the west looking east it opens away from the viewer.
    const p = withPartitionDoor({});
    const fromWest = polys(elevationDrawing(p, "east", { showDims: false, cut: "room" }).shapes).filter((s) => s.pts.length === 3 && (s.pen === "swing" || s.pen === "hidden"));
    const fromEast = polys(elevationDrawing(p, "west", { showDims: false, cut: "room" }).shapes).filter((s) => s.pts.length === 3 && (s.pen === "swing" || s.pen === "hidden"));
    expect(fromWest.map((s) => s.pen)).toContain("hidden");
    expect(fromEast.map((s) => s.pen)).toContain("swing");
  });
});

describe("3D: door leaves", () => {
  const named = (g: THREE.Object3D, name: string) => {
    const out: THREE.Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.name === name) out.push(o);
    });
    return out;
  };
  const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

  it("puts a closed leaf flush with the face it opens to, hinges at the hinge jamb, handles at the lock edge", () => {
    const inward = buildRoomObject(withWallDoor({}).room);
    const leaves = named(inward, "leaf");
    expect(leaves).toHaveLength(1);
    const lb = boxOf(leaves[0]);
    expect(lb.min.z).toBeCloseTo(6.0, 4);
    expect(lb.max.z).toBeCloseTo(6.04, 4);
    expect(named(inward, "frame")).toHaveLength(3);
    for (const h of named(inward, "hinge")) {
      const b = boxOf(h);
      expect(b.getCenter(new THREE.Vector3()).x).toBeCloseTo(1.645, 3);
      // On the room side of the leaf.
      expect(b.max.z).toBeLessThanOrEqual(6.0 + 1e-6);
    }
    const handles = named(inward, "handle");
    expect(handles).toHaveLength(2);
    for (const h of handles) {
      const c = boxOf(h).getCenter(new THREE.Vector3());
      expect(c.x).toBeGreaterThan(0.75);
      expect(c.x).toBeLessThan(1.0);
      expect(c.y).toBeCloseTo(1.05, 3);
    }
    const outward = buildRoomObject(withWallDoor({ swing: "out", hinge: "end" }).room);
    const ob = boxOf(named(outward, "leaf")[0]);
    expect(ob.min.z).toBeCloseTo(6.2, 4);
    expect(ob.max.z).toBeCloseTo(6.24, 4);
    for (const h of named(outward, "hinge")) expect(boxOf(h).getCenter(new THREE.Vector3()).x).toBeCloseTo(0.755, 3);
  });

  it("builds two leaves, the handle on the active one at the middle", () => {
    const g = buildRoomObject(withWallDoor({ leaves: 2 }).room);
    expect(named(g, "leaf")).toHaveLength(2);
    expect(named(g, "hinge")).toHaveLength(4);
    const c = boxOf(named(g, "handle")[0]).getCenter(new THREE.Vector3());
    // Active leaf from the start jamb (x 1.705) to the middle (x 1.2).
    expect(c.x).toBeGreaterThan(1.2);
    expect(c.x).toBeLessThan(1.45);
  });

  it("hangs a sliding leaf on the face it runs on with a track over its parking place", () => {
    const g = buildRoomObject(withWallDoor({ kind: "slidingDoor", hinge: "start" }).room);
    expect(named(g, "frame")).toHaveLength(0);
    const lb = boxOf(named(g, "leaf")[0]);
    expect(lb.min.z).toBeCloseTo(5.95, 4);
    expect(lb.max.z).toBeCloseTo(5.99, 4);
    expect(lb.min.x).toBeCloseTo(0.645, 4);
    expect(lb.max.x).toBeCloseTo(1.755, 4);
    const tb = boxOf(named(g, "track")[0]);
    expect(tb.max.x).toBeCloseTo(2.765, 4);
    expect(tb.min.y).toBeCloseTo(lb.max.y, 4);
  });

  it("puts the leaf of a partition door on the side it opens to", () => {
    const east = boxOf(named(buildRoomObject(withPartitionDoor({}).room), "leaf")[0]);
    expect(east.max.x).toBeCloseTo(3.05, 4);
    const west = boxOf(named(buildRoomObject(withPartitionDoor({ swing: "out" }).room), "leaf")[0]);
    expect(west.min.x).toBeCloseTo(2.95, 4);
  });
});
