// Walk mode ("Begehen") of the 3D view: a person at eye height walking through the kitchen.
// Pure state and steps, no renderer: the view turns the state into its camera.

import type { Item, Vec2 } from "../model/types";
import { isOverhead, kindOf } from "../model/catalog";
import { distToSegment, footprint, pointInPolygon } from "../model/geometry";

/** Eye height above the floor (m). */
export const EYE_HEIGHT = 1.65;
/** Walking and running speed (m/s). */
export const WALK_SPEED = 1.4;
export const RUN_SPEED = 3.2;
/** Closest distance to a wall (mm): the camera never looks through it. */
export const WALL_CLEARANCE = 250;
/** Clearance around equipment (mm). */
export const ITEM_CLEARANCE = 150;
/** Look sensitivity (rad per pixel dragged). */
export const LOOK_PER_PX = 0.004;
/** The view tilts at most this far up or down (rad). */
const MAX_PITCH = (80 * Math.PI) / 180;

/**
 * Position on the plan (mm) and where the person looks: `yaw` turns from north (0) towards
 * west (positive, counterclockwise seen from above, as three's rotation about y), `pitch` up.
 */
export interface WalkState {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
}

/** Movement wish from the held keys: forward and right, each -1, 0 or 1. */
export interface WalkIntent {
  forward: number;
  right: number;
  run: boolean;
}

const FORWARD_CODES = new Set(["KeyW", "ArrowUp"]);
const BACK_CODES = new Set(["KeyS", "ArrowDown"]);
const LEFT_CODES = new Set(["KeyA", "ArrowLeft"]);
const RIGHT_CODES = new Set(["KeyD", "ArrowRight"]);

/** True for the keys that move in walk mode. */
export function isWalkKey(code: string): boolean {
  return FORWARD_CODES.has(code) || BACK_CODES.has(code) || LEFT_CODES.has(code) || RIGHT_CODES.has(code);
}

/** The intent of a set of held key codes (`event.code`, so the keys sit where W A S D are). */
export function intentOf(held: ReadonlySet<string>, run: boolean): WalkIntent {
  const has = (codes: Set<string>) => [...held].some((c) => codes.has(c));
  return {
    forward: (has(FORWARD_CODES) ? 1 : 0) - (has(BACK_CODES) ? 1 : 0),
    right: (has(RIGHT_CODES) ? 1 : 0) - (has(LEFT_CODES) ? 1 : 0),
    run,
  };
}

/** Where the person may stand: inside the room, off the walls and off the floor-standing equipment. */
export interface WalkSpace {
  outline: readonly Vec2[];
  obstacles: readonly (readonly Vec2[])[];
}

export function walkSpace(outline: readonly Vec2[], items: readonly Item[]): WalkSpace {
  const obstacles = items
    .filter((it) => !isOverhead(kindOf(it.catalogId)))
    .map((it) => footprint({ ...it, width: it.width + 2 * ITEM_CLEARANCE, depth: it.depth + 2 * ITEM_CLEARANCE }));
  return { outline, obstacles };
}

export function isFree(p: Vec2, space: WalkSpace): boolean {
  const o = space.outline;
  if (o.length < 3 || !pointInPolygon(p, o)) return false;
  for (let i = 0; i < o.length; i++) if (distToSegment(p, o[i], o[(i + 1) % o.length]) < WALL_CLEARANCE) return false;
  return !space.obstacles.some((ob) => pointInPolygon(p, ob));
}

/**
 * One step of `dt` seconds. A blocked move slides along the obstacle (tries each axis alone);
 * from a blocked spot (started inside equipment) every move is allowed, so the person can
 * always walk out.
 */
export function stepWalk(s: WalkState, intent: WalkIntent, dt: number, space: WalkSpace): WalkState {
  if (intent.forward === 0 && intent.right === 0) return s;
  const speed = (intent.run ? RUN_SPEED : WALK_SPEED) * 1000 * dt;
  const len = Math.hypot(intent.forward, intent.right);
  const f = (intent.forward / len) * speed;
  const r = (intent.right / len) * speed;
  // Forward on the plan at yaw 0 is north (-y); right is east (+x).
  const sin = Math.sin(s.yaw);
  const cos = Math.cos(s.yaw);
  const dx = -sin * f + cos * r;
  const dy = -cos * f - sin * r;
  if (!isFree(s, space)) return { ...s, x: s.x + dx, y: s.y + dy };
  for (const [mx, my] of [
    [dx, dy],
    [dx, 0],
    [0, dy],
  ]) {
    const p = { x: s.x + mx, y: s.y + my };
    if ((mx !== 0 || my !== 0) && isFree(p, space)) return { ...s, ...p };
  }
  return s;
}

/** Turns the view by a drag of (dx, dy) pixels: right turns right, up looks up. */
export function look(s: WalkState, dxPx: number, dyPx: number): WalkState {
  const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitch - dyPx * LOOK_PER_PX));
  return { ...s, yaw: s.yaw - dxPx * LOOK_PER_PX, pitch };
}

/**
 * The start of a walk: the free spot nearest to `at` (the point the orbit looked at) along a
 * spiral of probes, looking along the plan direction `facing` (from the camera to the target).
 * Null when the room has no free spot (too small).
 */
export function startWalk(at: Vec2, facing: Vec2, space: WalkSpace): WalkState | null {
  const yaw = Math.atan2(-facing.x, -facing.y);
  const probe = (p: Vec2) => (isFree(p, space) ? { ...p, yaw, pitch: 0 } : null);
  const first = probe(at);
  if (first) return first;
  for (let r = 250; r <= 20000; r += 250) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / 250));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * 2 * Math.PI;
      const found = probe({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r });
      if (found) return found;
    }
  }
  return null;
}
