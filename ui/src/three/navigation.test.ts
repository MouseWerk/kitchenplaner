import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { distanceFor, fitDistance, halfHeightAt, orthoHalfHeight, orthoHalfHeightForBox, slerpDirection, VIEW_DIRECTION, viewKeyAction, type KeyLike } from "./navigation";

const key = (k: string, code: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key: k, code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });

describe("framing", () => {
  it("fits a sphere: it touches the narrower field of view with the margin", () => {
    const vFov = THREE.MathUtils.degToRad(45);
    const d = fitDistance(2, vFov, 2, 1);
    // Landscape: the vertical field is the narrow one.
    expect(Math.sin(vFov / 2) * d).toBeCloseTo(2, 6);
    // Portrait: the horizontal field decides and the camera moves back.
    expect(fitDistance(2, vFov, 0.5, 1)).toBeGreaterThan(d);
    expect(fitDistance(2, vFov, 2, 1.1)).toBeCloseTo(d * 1.1, 6);
  });

  it("orthographic fits keep the sphere inside both sides", () => {
    expect(orthoHalfHeight(2, 2, 1)).toBe(2);
    expect(orthoHalfHeight(2, 0.5, 1)).toBe(4);
  });

  it("switching projection keeps the scale at the target", () => {
    const vFov = THREE.MathUtils.degToRad(45);
    expect(distanceFor(halfHeightAt(7, vFov), vFov)).toBeCloseTo(7, 9);
  });

  it("fits a box in an orthographic front view by its projected size", () => {
    // An 8 m wide, 3 m high, 6 m deep room seen from the front at aspect 2: the width decides.
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(8, 3, 6));
    expect(orthoHalfHeightForBox(box, VIEW_DIRECTION.front, 2, 1)).toBeCloseTo(2, 6);
    // From the side the depth is the width.
    expect(orthoHalfHeightForBox(box, VIEW_DIRECTION.right, 2, 1)).toBeCloseTo(1.5, 6);
    // From the top the depth is the height.
    expect(orthoHalfHeightForBox(box, VIEW_DIRECTION.top, 2, 1)).toBeCloseTo(3, 2);
  });

  it("interpolates directions on the sphere, also between opposite ones", () => {
    const a = VIEW_DIRECTION.front;
    const b = VIEW_DIRECTION.right;
    const mid = slerpDirection(a, b, 0.5);
    expect(mid.length()).toBeCloseTo(1, 9);
    expect(mid.angleTo(a)).toBeCloseTo(Math.PI / 4, 6);
    expect(slerpDirection(a, b, 1).distanceTo(b)).toBeLessThan(1e-9);
    const half = slerpDirection(VIEW_DIRECTION.front, VIEW_DIRECTION.back, 0.5);
    expect(half.length()).toBeCloseTo(1, 9);
    expect(Number.isFinite(half.x + half.y + half.z)).toBe(true);
  });
});

describe("view keys", () => {
  it("map the number row and the numpad like Blender", () => {
    expect(viewKeyAction(key("1", "Digit1"))).toEqual({ kind: "view", view: "front" });
    expect(viewKeyAction(key("1", "Numpad1"))).toEqual({ kind: "view", view: "front" });
    expect(viewKeyAction(key("3", "Numpad3"))).toEqual({ kind: "view", view: "right" });
    expect(viewKeyAction(key("7", "Digit7"))).toEqual({ kind: "view", view: "top" });
    expect(viewKeyAction(key("5", "Numpad5"))).toEqual({ kind: "toggleOrtho" });
    expect(viewKeyAction(key("1", "Numpad1", { ctrlKey: true }))).toEqual({ kind: "view", view: "back" });
    expect(viewKeyAction(key("3", "Digit3", { metaKey: true }))).toEqual({ kind: "view", view: "left" });
  });

  it("frame the selection with F or the numpad dot, everything with Home", () => {
    expect(viewKeyAction(key("f", "KeyF"))).toEqual({ kind: "frameSelection" });
    expect(viewKeyAction(key("F", "KeyF"))).toEqual({ kind: "frameSelection" });
    // With Num Lock off the numpad dot reports Delete; it must still frame, not delete.
    expect(viewKeyAction(key("Delete", "NumpadDecimal"))).toEqual({ kind: "frameSelection" });
    expect(viewKeyAction(key("Home", "Home"))).toEqual({ kind: "frameAll" });
  });

  it("leave other keys and modified ones to the app", () => {
    expect(viewKeyAction(key("2", "Digit2"))).toBeNull();
    expect(viewKeyAction(key("4", "Digit4"))).toBeNull();
    expect(viewKeyAction(key("g", "KeyG"))).toBeNull();
    expect(viewKeyAction(key("Delete", "Delete"))).toBeNull();
    expect(viewKeyAction(key("1", "Digit1", { shiftKey: true }))).toBeNull();
    expect(viewKeyAction(key("1", "Digit1", { altKey: true }))).toBeNull();
    expect(viewKeyAction(key("f", "KeyF", { ctrlKey: true }))).toBeNull();
  });
});
