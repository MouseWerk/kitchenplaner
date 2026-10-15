// Doors: hinge side, opening direction, leaves and sliding doors, shared by the plan, the
// elevations, the 3D room and the plan check. Pure functions over the model.
//
// An opening's frame (`OpeningFrame`) lies on its host's reference line: the inner face of an
// outer wall, the centre line of a partition. `dir` runs along the host from its start (a
// partition's `a`), `normal` points into the room (outer wall) or to the left of a→b
// (partition), and the band reaches from `near` to `far` along `normal`.
//
// A hinged door opens to its swing side: the host's `normal` side for "in", the other side for
// "out". `swingFrame` turns the frame so its `normal` points to that side and `near` is that
// face. Hinges sit on the swing side face, so the leaf in its frame is flush with that face and
// the swing arc starts there. A sliding door runs on its swing side face (`swing` says which
// face) and slides open towards its `hinge` side.

import { add, clampOpening, dot, scale } from "./geometry";
import { openingHost } from "./partitions";
import type { DoorHinge, DoorSwing, Opening, OpeningKind, Room, Vec2 } from "./types";

/** The kinds that are doors: shown with leaves, checked for their clearance, flipped with H. */
export const DOOR_KINDS: readonly OpeningKind[] = ["door", "slidingDoor"];

export const isDoor = (o: Pick<Opening, "kind">): boolean => DOOR_KINDS.includes(o.kind);

/** Thickness of a door leaf (mm): a 40 mm commercial door, also a sliding leaf. */
export const LEAF_THICKNESS = 40;
/** Gap between a sliding leaf and the wall face it runs on (mm). */
export const SLIDE_GAP = 10;
/** How far a closed sliding leaf overlaps the opening on each side, and above it (mm). */
export const SLIDE_OVERLAP = 50;
/** Height of a door handle above the floor (mm), the usual 1050 mm. */
export const HANDLE_HEIGHT = 1050;
/** Length of a door lever (mm). */
export const HANDLE_LENGTH = 130;
/** Height of a sliding door's track above the leaf (mm). */
export const TRACK_HEIGHT = 60;
/**
 * Depth (mm) in front of a sliding door that has to stay free: the leaf with its gap and the
 * handle standing off it. Items there stop it running.
 */
export const SLIDE_CLEAR = 100;

/** The door settings of an opening with their defaults: hinged at the start, opening in, one leaf. */
export interface DoorSetup {
  hinge: DoorHinge;
  swing: DoorSwing;
  leaves: 1 | 2;
}

export function doorSetup(o: Pick<Opening, "hinge" | "swing" | "leaves">): DoorSetup {
  return { hinge: o.hinge ?? "start", swing: o.swing ?? "in", leaves: o.leaves === 2 ? 2 : 1 };
}

/** The opening with its hinge on the other side (a sliding door then slides the other way). */
export function flipHinge(o: Opening): Opening {
  return { ...o, hinge: doorSetup(o).hinge === "start" ? "end" : "start" };
}

/** The opening opening to the other side (a sliding door then runs on the other face). */
export function flipSwing(o: Opening): Opening {
  return { ...o, swing: doorSetup(o).swing === "in" ? "out" : "in" };
}

/** Where an opening lies in its wall band (see the file comment). */
export interface OpeningFrame {
  start: Vec2;
  end: Vec2;
  dir: Vec2;
  normal: Vec2;
  near: number;
  far: number;
}

/** The point `p` moved `k` along the frame's normal. */
export const across = (f: Pick<OpeningFrame, "normal">, p: Vec2, k: number): Vec2 => add(p, scale(f.normal, k));

/** A frame for an opening at `offset` along a host starting at `a`. */
export function frameOn(a: Vec2, dir: Vec2, normal: Vec2, o: Pick<Opening, "offset" | "width">, near: number, far: number): OpeningFrame {
  return { start: add(a, scale(dir, o.offset - o.width / 2)), end: add(a, scale(dir, o.offset + o.width / 2)), dir, normal, near, far };
}

/**
 * The frame of an opening in its host, with the opening clamped into the host; null when the
 * host is missing. Outer walls: the inner face, the band from 0 to -thickness; partitions: the
 * centre line, the band ±thickness/2.
 */
export function openingFrame(room: Pick<Room, "points" | "wallThickness" | "partitions">, o: Opening): { frame: OpeningFrame; opening: Opening } | null {
  const h = openingHost(room, o);
  if (!h || h.length <= 0) return null;
  const c = clampOpening(room, o);
  const [near, far] = h.kind === "wall" ? [0, -h.thickness] : [h.thickness / 2, -h.thickness / 2];
  return { frame: frameOn(h.a, h.dir, h.normal, c, near, far), opening: c };
}

/** The frame turned to the door's swing side: `normal` points there, `near` is that face. */
export function swingFrame(f: OpeningFrame, swing: DoorSwing): OpeningFrame {
  return swing === "in" ? f : { ...f, normal: scale(f.normal, -1), near: -f.far, far: -f.near };
}

/**
 * One leaf of a door, on the frame's reference line: `hinge` is the jamb it turns on (a hinged
 * leaf) or the edge it parks beyond when open (a sliding leaf runs from `hinge` away from
 * `along`); `along` points from that jamb across the opening, `width` is the leaf's share of it.
 */
export interface DoorLeaf {
  hinge: Vec2;
  along: Vec2;
  width: number;
}

/**
 * The leaves of a door in its frame, the active leaf (on the hinge side) first. One leaf turns on
 * its hinge jamb; two leaves share the opening, each turning on its own jamb (a sliding door
 * with two leaves parts in the middle). For a single sliding leaf `hinge` names the side it
 * slides open to, so its `hinge` here is that jamb as well.
 */
export function doorLeaves(f: Pick<OpeningFrame, "start" | "end" | "dir">, o: Pick<Opening, "hinge" | "leaves" | "width">): DoorLeaf[] {
  const s = doorSetup(o);
  const back = scale(f.dir, -1);
  const fromStart: DoorLeaf = { hinge: f.start, along: f.dir, width: o.width };
  const fromEnd: DoorLeaf = { hinge: f.end, along: back, width: o.width };
  if (s.leaves === 1) return [s.hinge === "start" ? fromStart : fromEnd];
  const half = o.width / 2;
  const pair = [
    { ...fromStart, width: half },
    { ...fromEnd, width: half },
  ];
  return s.hinge === "start" ? pair : [pair[1], pair[0]];
}

/**
 * The hand of a door as DIN 107 names it: seen from the side the door opens to, hinges on the
 * left make a „DIN links“ door. For a sliding door: the side it slides open to, seen from the face
 * it runs on. For two leaves: the side of the active leaf.
 */
export function doorHand(f: Pick<OpeningFrame, "dir" | "normal">, o: Pick<Opening, "hinge" | "swing">): "left" | "right" {
  const s = doorSetup(o);
  const n = s.swing === "in" ? f.normal : scale(f.normal, -1);
  // The viewer stands on the `n` side looking along -n; their right on the plan (y down).
  const right = { x: n.y, y: -n.x };
  const toHinge = s.hinge === "start" ? scale(f.dir, -1) : f.dir;
  return dot(toHinge, right) > 0 ? "right" : "left";
}

/** The rectangle `s0`..`s1` along a leaf and `k0`..`k1` across the frame (plan points). */
export function leafRect(f: Pick<OpeningFrame, "normal">, leaf: DoorLeaf, s0: number, s1: number, k0: number, k1: number): Vec2[] {
  const at = (s: number, k: number) => across(f, add(leaf.hinge, scale(leaf.along, s)), k);
  return [at(s0, k0), at(s1, k0), at(s1, k1), at(s0, k1)];
}
