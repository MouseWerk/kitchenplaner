import { describe, expect, it } from "vitest";
import {
  bandPiece,
  clampPartitionOpening,
  distToPartition,
  openingHost,
  openingSpanOnPartition,
  partitionAngle,
  partitionAt,
  partitionBand,
  partitionFaces,
  partitionLength,
  partitionOf,
  partitionOutline,
  pointInPartition,
  wallHosts,
} from "./partitions";
import { area, rectRoom } from "./geometry";
import type { Opening, Partition, Room, Vec2 } from "./types";

const P: Partition = { id: "p", a: { x: 1000, y: 2000 }, b: { x: 4000, y: 2000 }, thickness: 100, height: 3000 };

function room(partitions: Partition[]): Room {
  return { points: rectRoom(8000, 6000), height: 3000, wallThickness: 240, openings: [], partitions };
}

const r = (v: Vec2) => ({ x: Math.round(v.x * 1000) / 1000 + 0, y: Math.round(v.y * 1000) / 1000 + 0 });

describe("partition frame", () => {
  it("measures length and angle of a→b", () => {
    expect(partitionLength(P)).toBe(3000);
    expect(partitionAngle(P)).toBe(0);
    expect(partitionAngle({ a: { x: 0, y: 0 }, b: { x: 0, y: 10 } })).toBe(90);
  });

  it("outlines the band as a rectangle, the left face first (north for a partition running east)", () => {
    expect(partitionOutline(P).map(r)).toEqual([
      { x: 1000, y: 1950 },
      { x: 4000, y: 1950 },
      { x: 4000, y: 2050 },
      { x: 1000, y: 2050 },
    ]);
  });

  it("gives both long faces with normals pointing away from the partition", () => {
    const [left, right] = partitionFaces(P);
    expect(left).toMatchObject({ partition: "p", side: "left", length: 3000 });
    expect(r(left.a)).toEqual({ x: 1000, y: 1950 });
    expect(r(left.normal)).toEqual({ x: 0, y: -1 });
    expect(r(right.b)).toEqual({ x: 4000, y: 2050 });
    expect(r(right.normal)).toEqual({ x: 0, y: 1 });
  });
});

describe("openings in partitions", () => {
  const o: Opening = { id: "d", kind: "door", wall: 0, partition: "p", offset: 1000, width: 900, height: 2100, sill: 0 };

  it("spans the opening along a→b from a", () => {
    expect(openingSpanOnPartition(P, o).map(r)).toEqual([
      { x: 1550, y: 2000 },
      { x: 2450, y: 2000 },
    ]);
  });

  it("clamps an opening into its partition", () => {
    expect(clampPartitionOpening(P, { ...o, offset: 2900 })).toMatchObject({ offset: 2550, width: 900 });
    expect(clampPartitionOpening(P, { ...o, offset: 0, width: 5000 })).toMatchObject({ offset: 1500, width: 3000 });
  });

  it("finds the host of an opening: its partition or its outer wall", () => {
    const rm = room([P]);
    expect(partitionOf(rm, o)).toBe(P);
    expect(partitionOf(rm, { partition: undefined })).toBeUndefined();
    expect(openingHost(rm, o)).toMatchObject({ kind: "partition", id: "p", length: 3000, thickness: 100 });
    expect(openingHost(rm, { wall: 2 })).toMatchObject({ kind: "wall", index: 2, length: 8000, thickness: 240 });
    expect(openingHost(rm, { wall: 0, partition: "gone" })).toBeNull();
    expect(openingHost(rm, { wall: 9 })).toBeNull();
  });

  it("lists outer walls then partitions as hosts, with the swing side as normal", () => {
    const hosts = wallHosts(room([P]));
    expect(hosts.map((h) => (h.kind === "wall" ? h.index : h.id))).toEqual([0, 1, 2, 3, "p"]);
    // North wall: into the room is south. The partition: left of east is north.
    expect(r(hosts[0].normal)).toEqual({ x: 0, y: 1 });
    expect(r(hosts[4].normal)).toEqual({ x: 0, y: -1 });
  });
});

describe("hit testing", () => {
  it("measures the distance to the rectangle, 0 inside and on its edge", () => {
    expect(distToPartition({ x: 2000, y: 2000 }, P)).toBe(0);
    expect(distToPartition({ x: 2000, y: 1950 }, P)).toBe(0);
    expect(distToPartition({ x: 2000, y: 1900 }, P)).toBe(50);
    // Past the end, square: diagonal distance to the corner.
    expect(distToPartition({ x: 4030, y: 2090 }, P)).toBeCloseTo(50);
    expect(pointInPartition({ x: 3999, y: 2049 }, P)).toBe(true);
    expect(pointInPartition({ x: 4001, y: 2000 }, P)).toBe(false);
  });

  it("finds the partition at a point, the last one on top, within a tolerance", () => {
    const Q: Partition = { ...P, id: "q", a: { x: 2000, y: 1000 }, b: { x: 2000, y: 3000 } };
    const rm = room([P, Q]);
    expect(partitionAt(rm, { x: 2000, y: 2000 })?.id).toBe("q");
    expect(partitionAt(rm, { x: 3000, y: 2000 })?.id).toBe("p");
    expect(partitionAt(rm, { x: 3000, y: 2080 })).toBeNull();
    expect(partitionAt(rm, { x: 3000, y: 2080 }, 40)?.id).toBe("p");
  });
});

describe("partitionBand", () => {
  it("leaves free ends square", () => {
    const band = partitionBand(room([P]), P);
    expect(bandPiece(band, 0, band.length).map(r)).toEqual(partitionOutline(P).map(r));
  });

  it("cuts an end flush with the inner face of an outer wall, also when it reaches into the wall", () => {
    // From the north wall's inner face, and one from the middle of the west wall.
    const N: Partition = { id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 2000 }, thickness: 100, height: 3000 };
    const W: Partition = { id: "w", a: { x: -120, y: 4000 }, b: { x: 2000, y: 4000 }, thickness: 100, height: 3000 };
    const rm = room([N, W]);
    expect(partitionBand(rm, N).start.map(r)).toEqual([
      { x: 3050, y: 0 },
      { x: 2950, y: 0 },
    ]);
    expect(partitionBand(rm, W).start.map(r)).toEqual([
      { x: 0, y: 3950 },
      { x: 0, y: 4050 },
    ]);
    // The far ends are free.
    expect(partitionBand(rm, N).end.map(r)).toEqual([
      { x: 3050, y: 2000 },
      { x: 2950, y: 2000 },
    ]);
  });

  it("cuts a slanted end along the wall face", () => {
    const S: Partition = { id: "s", a: { x: 3000, y: 0 }, b: { x: 5000, y: 2000 }, thickness: 100, height: 3000 };
    const [l, rr] = partitionBand(room([S]), S).start;
    expect(l.y).toBeCloseTo(0);
    expect(rr.y).toBeCloseTo(0);
    expect(Math.abs(l.x - rr.x)).toBeCloseTo(100 * Math.SQRT2);
  });

  it("does not join an end that stops short of a wall", () => {
    const S: Partition = { id: "s", a: { x: 3000, y: 50 }, b: { x: 3000, y: 2000 }, thickness: 100, height: 3000 };
    expect(partitionBand(room([S]), S).start.map(r)).toEqual([
      { x: 3050, y: 50 },
      { x: 2950, y: 50 },
    ]);
  });

  it("butts a T against the face of the partition it meets", () => {
    const T: Partition = { id: "t", a: { x: 2500, y: 2000 }, b: { x: 2500, y: 4000 }, thickness: 100, height: 3000 };
    const band = partitionBand(room([P, T]), T);
    // T runs south from P's centre line: it starts at P's south face, y 2050.
    expect(band.start.map(r)).toEqual([
      { x: 2550, y: 2050 },
      { x: 2450, y: 2050 },
    ]);
    // P itself is not cut.
    expect(bandPiece(partitionBand(room([P, T]), P), 0, 3000).map(r)).toEqual(partitionOutline(P).map(r));
  });

  it("miters an L corner so both bands meet without overlap or gap", () => {
    const L: Partition = { id: "l", a: { x: 4000, y: 2000 }, b: { x: 4000, y: 4000 }, thickness: 100, height: 3000 };
    const rm = room([P, L]);
    const pPiece = bandPiece(partitionBand(rm, P), 0, 3000);
    const lPiece = bandPiece(partitionBand(rm, L), 0, 2000);
    // The outer corner (4050, 1950) and the inner one (3950, 2050) are shared.
    expect(pPiece.map(r)).toContainEqual({ x: 4050, y: 1950 });
    expect(pPiece.map(r)).toContainEqual({ x: 3950, y: 2050 });
    expect(lPiece.map(r)).toContainEqual({ x: 4050, y: 1950 });
    expect(lPiece.map(r)).toContainEqual({ x: 3950, y: 2050 });
    // Together they cover the L exactly: 3000 + 2000 long, 100 thick, the corner square once.
    expect(area(pPiece) + area(lPiece)).toBeCloseTo(3050 * 100 + 1950 * 100, 3);
  });

  it("cuts a piece between two positions straight across", () => {
    const band = partitionBand(room([P]), P);
    expect(bandPiece(band, 500, 1500).map(r)).toEqual([
      { x: 1500, y: 1950 },
      { x: 2500, y: 1950 },
      { x: 2500, y: 2050 },
      { x: 1500, y: 2050 },
    ]);
  });
});
