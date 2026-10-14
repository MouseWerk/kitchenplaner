// The view cube's geometry: where each face of a cube turned like the world appears on screen.
//
// The cube is drawn without CSS 3D. A `preserve-3d` cube needs the browser's 3D compositing:
// WebKitGTK without accelerated compositing (software rendering, some drivers) flattens it and
// shows one mirrored face, and WebKit rasterizes 3D layers blurry at a device pixel ratio of 2.
// Seen orthographically, every face of a cube is a parallelogram, which a 2D affine transform
// of a square describes exactly; the faces turned away are hidden. A convex cube's visible faces
// never overlap, so no depth sorting is needed either.

import * as THREE from "three";

export type CubeFace = "front" | "back" | "right" | "left" | "top" | "bottom";

/**
 * Each face in world axes (three: y up, z towards the viewer of the front view): its outward
 * normal, which doubles as the direction of its centre, and the world directions of the face
 * element's own x (right) and y (down) axes, so its label reads upright from outside.
 */
const FACES: Record<CubeFace, { n: [number, number, number]; u: [number, number, number]; v: [number, number, number] }> = {
  front: { n: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0] },
  back: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, -1, 0] },
  right: { n: [1, 0, 0], u: [0, 0, -1], v: [0, -1, 0] },
  left: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] },
  top: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  bottom: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
};

export const CUBE_FACE_NAMES = Object.keys(FACES) as CubeFace[];

/** Faces seen this close to edge-on are left out: a sliver of a face only flickers. */
const EDGE_ON = 1e-3;

/** A face on screen: shown or not, and the 2D transform that places it (origin at its centre). */
export interface FacePlacement {
  visible: boolean;
  /** The linear part (a, b, c, d of a CSS `matrix()`): the square turned and foreshortened. */
  matrix: [number, number, number, number];
  /** Where the face's centre lands, in cube widths from the cube's centre (CSS axes). */
  offset: [number, number];
  /**
   * The CSS transform for a face element as large as the cube and centred in its box; the
   * offset scales with `--cube`, so the cube needs no measuring and follows the pane's size.
   */
  transform: string;
}

const round = (v: number, f: number) => Math.round(v * f) / f || 0;

/**
 * Where each face of the cube appears to a camera turned by `q`. The camera's
 * inverse rotation takes world directions into view space (x right, y up, z towards the
 * viewer); CSS has y down, so view y is negated.
 */
export function cubeFaces(q: THREE.Quaternion): Record<CubeFace, FacePlacement> {
  const inv = q.clone().invert();
  const view = (a: [number, number, number]) => new THREE.Vector3(...a).applyQuaternion(inv);
  const out = {} as Record<CubeFace, FacePlacement>;
  for (const name of CUBE_FACE_NAMES) {
    const f = FACES[name];
    const n = view(f.n);
    const u = view(f.u);
    const v = view(f.v);
    // Rounded so float noise does not restyle the cube on every frame.
    const matrix: FacePlacement["matrix"] = [round(u.x, 1e4), round(-u.y, 1e4), round(v.x, 1e4), round(-v.y, 1e4)];
    const offset: FacePlacement["offset"] = [round(n.x / 2, 1e4), round(-n.y / 2, 1e4)];
    const transform = `translate(calc(var(--cube) * ${offset[0]}), calc(var(--cube) * ${offset[1]})) matrix(${matrix.join(",")},0,0)`;
    out[name] = { visible: n.z > EDGE_ON, matrix, offset, transform };
  }
  return out;
}
