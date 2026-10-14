import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CUBE_FACE_NAMES, cubeFaces, type CubeFace } from "./viewCube";

const SIZE = 60;


/**
 * The cube as it was drawn with CSS 3D: the cube turned by S R^-1 S (S mirrors y, CSS has y
 * down), each face rotated into place and pushed out by half the size. The 2D placement must
 * show every face exactly where that 3D cube, seen orthographically, put it.
 */
function css3dFace(q: THREE.Quaternion, face: CubeFace): { m: THREE.Matrix4; facing: number } {
  const s = new THREE.Matrix4().makeScale(1, -1, 1);
  const turn = s.clone().multiply(new THREE.Matrix4().makeRotationFromQuaternion(q.clone().invert())).multiply(s);
  const r = {
    front: new THREE.Matrix4(),
    back: new THREE.Matrix4().makeRotationY(Math.PI),
    right: new THREE.Matrix4().makeRotationY(Math.PI / 2),
    left: new THREE.Matrix4().makeRotationY(-Math.PI / 2),
    top: new THREE.Matrix4().makeRotationX(Math.PI / 2),
    bottom: new THREE.Matrix4().makeRotationX(-Math.PI / 2),
  }[face];
  const m = turn.multiply(r).multiply(new THREE.Matrix4().makeTranslation(0, 0, SIZE / 2));
  // The face's normal (its local +z) in screen space; towards the viewer is +z.
  const facing = new THREE.Vector3(0, 0, 1).transformDirection(m).z;
  return { m, facing };
}

describe("view cube", () => {
  it("shows only the front face, untransformed, to a camera looking north", () => {
    const faces = cubeFaces(new THREE.Quaternion());
    expect(faces.front.visible).toBe(true);
    expect(faces.front.matrix).toEqual([1, 0, 0, 1]);
    expect(faces.front.offset).toEqual([0, 0]);
    expect(faces.front.transform).toBe("translate(calc(var(--cube) * 0), calc(var(--cube) * 0)) matrix(1,0,0,1,0,0)");
    expect(CUBE_FACE_NAMES.filter((f) => faces[f].visible)).toEqual(["front"]);
  });

  it("shows the top face upright to a camera looking down", () => {
    const down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const faces = cubeFaces(down);
    expect(CUBE_FACE_NAMES.filter((f) => faces[f].visible)).toEqual(["top"]);
    expect(faces.top.matrix).toEqual([1, 0, 0, 1]);
    expect(faces.top.offset).toEqual([0, 0]);
  });

  it("shows three faces, never mirrored, from the perspective preset", () => {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0.75, 0.75, 1);
    cam.lookAt(0, 0, 0);
    const faces = cubeFaces(cam.quaternion);
    expect(CUBE_FACE_NAMES.filter((f) => faces[f].visible)).toEqual(["front", "right", "top"]);
    for (const f of ["front", "right", "top"] as const) {
      const [a, b, c, d] = faces[f].matrix;
      // A positive determinant: the label is not mirrored.
      expect(a * d - b * c).toBeGreaterThan(0);
    }
  });

  it("places every face where the CSS 3D cube put it, for any turn", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < 50; i++) {
      const q = new THREE.Quaternion(rnd(), rnd(), rnd(), rnd()).normalize();
      const faces = cubeFaces(q);
      for (const f of CUBE_FACE_NAMES) {
        const { m, facing } = css3dFace(q, f);
        const e = m.elements;
        // The orthographic projection keeps x and y of the 3D matrix: column-major a b / c d / e f.
        const want = [e[0], e[1], e[4], e[5], e[12], e[13]];
        const { matrix, offset } = faces[f];
        const got = [...matrix, offset[0] * SIZE, offset[1] * SIZE];
        got.forEach((v, k) => expect(v).toBeCloseTo(want[k], 1));
        if (Math.abs(facing) > 0.01) expect(faces[f].visible).toBe(facing > 0);
      }
    }
  });
});
