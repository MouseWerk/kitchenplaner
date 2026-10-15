// Helpers the storage units share: shelves with folded edges and slanted struts (bracing,
// brackets). Castors come from parts/mesh.ts.

import * as THREE from "three";
import type { MaterialId, Parts } from "../parts/mesh";

/** Height of a shelf's folded edge (m). */
export const LIP = 0.03;
/** Sheet thickness of a shelf (m). */
const DECK = 0.006;
/** Pitch of the slats of a slatted shelf (m). */
const PITCH = 0.06;
/** Perforated shelf: distance of the slot rows and of the slots in a row, slot width (m). */
const HOLE_ROW = 0.2;
const HOLE_COL = 0.35;
const HOLE = 0.02;

/** What a shelf is made of: solid sheet, perforated sheet (slotted) or open slats. */
export type Deck = "solid" | "perforated" | "slatted";

/**
 * A round strut from point `a` to point `b` (metres, item frame): cross bracing and bracket
 * struts. Its round section reaches `r` past the line, so keep the ends that far inside the box.
 */
export function strut(p: Parts, mat: MaterialId, a: readonly [number, number, number], b: readonly [number, number, number], r: number): void {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  const m = p.rod(mat, "y", (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, len, r);
  if (len > 0) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

/** One shelf from x0 to x1 and z0 to z1, its lower edge at y: the deck and its folded edges. */
export function shelf(p: Parts, deck: Deck, x0: number, x1: number, z0: number, z1: number, y: number) {
  const top = y + LIP;
  p.box("steel", x0, x1, y, top, z1 - DECK, z1);
  p.box("steel", x0, x1, y, top, z0, z0 + DECK);
  p.box("steel", x0, x0 + DECK, y, top, z0 + DECK, z1 - DECK);
  p.box("steel", x1 - DECK, x1, y, top, z0 + DECK, z1 - DECK);
  const inner0 = z0 + DECK;
  const inner1 = z1 - DECK;
  if (deck === "solid") {
    p.box("steel", x0 + DECK, x1 - DECK, top - DECK, top, inner0, inner1);
    return;
  }
  if (deck === "perforated") {
    // A closed sheet punched with staggered rows of short slots: dark marks set into the top
    // (the `slot` material lies over the face it shares), so it reads as a perforated sheet and
    // never as the open slats of an aluminium shelf.
    p.box("steel", x0 + DECK, x1 - DECK, top - DECK, top, inner0, inner1);
    const rows = Math.max(2, Math.round((inner1 - inner0) / HOLE_ROW));
    const rowPitch = (inner1 - inner0) / rows;
    const cols = Math.max(2, Math.round((x1 - x0) / HOLE_COL));
    const colPitch = (x1 - x0 - 2 * DECK) / cols;
    for (let r = 0; r < rows; r++) {
      const zc = inner0 + rowPitch * (r + 0.5);
      // Every other row is shifted by half a slot pitch and has one slot less.
      const shift = r % 2 === 1 ? colPitch / 2 : 0;
      const n = r % 2 === 1 ? cols - 1 : cols;
      for (let c = 0; c < n; c++) {
        const xc = x0 + DECK + colPitch * (c + 0.5) + shift;
        p.box("slot", xc - colPitch * 0.3, xc + colPitch * 0.3, top - DECK, top, zc - HOLE / 2, zc + HOLE / 2);
      }
    }
    return;
  }
  // Open slats along the shelf with gaps between them.
  const n = Math.max(2, Math.round((inner1 - inner0) / PITCH));
  const pitch = (inner1 - inner0) / n;
  for (let i = 0; i < n; i++) {
    const zc = inner0 + pitch * (i + 0.5);
    p.box("steel", x0 + DECK, x1 - DECK, top - DECK, top, zc - pitch / 4, zc + pitch / 4);
  }
}
