// Camera math and key mapping of the 3D view, free of renderer and DOM so it can be tested.
//
// Views follow Blender's numpad: 1 front, 3 right side, 7 top (with Ctrl the opposite side),
// 5 switches between perspective and orthographic, F or the numpad dot frames the selection,
// Home frames everything. Three coordinates: y up, plan y (south) is +z, so "front" looks from
// the south towards north.

import * as THREE from "three";

export type ViewName = "perspective" | "front" | "back" | "right" | "left" | "top";

/** A top view looks straight down but a hair off vertical, so the orbit keeps north up. */
const TOP_VIEW_TILT = 1e-3;

/** Direction from the target towards the camera for each named view. */
export const VIEW_DIRECTION: Record<ViewName, THREE.Vector3> = {
  perspective: new THREE.Vector3(0.75, 0.75, 1).normalize(),
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  right: new THREE.Vector3(1, 0, 0),
  left: new THREE.Vector3(-1, 0, 0),
  top: new THREE.Vector3(0, 1, TOP_VIEW_TILT).normalize(),
};

/**
 * Distance from a sphere's centre at which a perspective camera shows the whole sphere with
 * `margin` (1.1 = 10 % around it), for a vertical field of view (rad) and aspect (w / h).
 */
export function fitDistance(radius: number, vFov: number, aspect: number, margin: number): number {
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  return (radius * margin) / Math.sin(Math.min(vFov, hFov) / 2);
}

/** Half the height an orthographic view needs to show a sphere with `margin` at `aspect`. */
export function orthoHalfHeight(radius: number, aspect: number, margin: number): number {
  return (radius * margin) / Math.min(1, aspect);
}

/**
 * Half the height an orthographic view along `dir` (towards the camera, y up) needs to show
 * `box` with `margin`, centred on the box's centre. Tighter than the bounding sphere: a front
 * view of a flat room fills the width instead of leaving room for the sphere above and below.
 */
export function orthoHalfHeightForBox(box: THREE.Box3, dir: THREE.Vector3, aspect: number, margin: number): number {
  const z = dir.clone().normalize();
  const x = new THREE.Vector3(0, 1, 0).cross(z);
  if (x.lengthSq() < 1e-12) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const c = box.getCenter(new THREE.Vector3());
  let w = 0;
  let h = 0;
  const p = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c);
    w = Math.max(w, Math.abs(p.dot(x)));
    h = Math.max(h, Math.abs(p.dot(y)));
  }
  return Math.max(h, w / aspect) * margin;
}

/**
 * Half the visible height at the target of a perspective camera `distance` away: the size an
 * orthographic view takes so switching projection keeps the target's scale.
 */
export function halfHeightAt(distance: number, vFov: number): number {
  return distance * Math.tan(vFov / 2);
}

/** The distance that inverts `halfHeightAt`: back from orthographic to perspective. */
export function distanceFor(halfHeight: number, vFov: number): number {
  return halfHeight / Math.tan(vFov / 2);
}

/**
 * Spherical interpolation between two unit directions, `t` from 0 to 1. Opposite directions
 * turn over the vertical, so a front-to-back change swings over the top instead of through
 * the target.
 */
export function slerpDirection(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const angle = Math.acos(dot);
  if (angle < 1e-6) return b.clone();
  let axis = new THREE.Vector3().crossVectors(a, b);
  if (axis.lengthSq() < 1e-12) {
    // Exactly opposite: any axis perpendicular to a works; prefer one that passes over the top.
    axis = new THREE.Vector3().crossVectors(a, new THREE.Vector3(0, 1, 0));
    if (axis.lengthSq() < 1e-12) axis.set(1, 0, 0);
  }
  axis.normalize();
  return a.clone().applyAxisAngle(axis, angle * t).normalize();
}

/** Smooth start and stop for camera moves. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** What a key does in the 3D view. */
export type ViewKeyAction =
  | { kind: "view"; view: ViewName }
  | { kind: "toggleOrtho" }
  | { kind: "frameSelection" }
  | { kind: "frameAll" };

/** The parts of a keyboard event the mapping looks at. */
export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * The view action of a key, or null when the key is not one of the 3D view's. Digits work on
 * the number row and the numpad; Ctrl (Cmd) with 1 or 3 gives the opposite side as in Blender.
 */
export function viewKeyAction(e: KeyLike): ViewKeyAction | null {
  if (e.altKey || e.shiftKey) return null;
  const mod = e.ctrlKey || e.metaKey;
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1] ?? (/^[0-9]$/.test(e.key) ? e.key : null);
  switch (digit) {
    case "1":
      return { kind: "view", view: mod ? "back" : "front" };
    case "3":
      return { kind: "view", view: mod ? "left" : "right" };
    case "7":
      return mod ? null : { kind: "view", view: "top" };
    case "5":
      return mod ? null : { kind: "toggleOrtho" };
  }
  if (mod) return null;
  if (e.code === "NumpadDecimal" || e.key.toLowerCase() === "f") return { kind: "frameSelection" };
  if (e.key === "Home") return { kind: "frameAll" };
  return null;
}
