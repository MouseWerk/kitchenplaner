// Helpers the storage units share: shelves with folded edges and slanted struts (bracing,
// brackets). Castors come from parts/mesh.ts.

import * as THREE from "three";
import type { MaterialId, Parts } from "../parts/mesh";

/** Height of a shelf's folded edge (m). */
export const LIP = 0.03;
/** Sheet thickness of a shelf (m). */
const DECK = 0.006;
/** Pitch of the slot rows of a perforated shelf and the slats of a slatted one (m). */
const PITCH = 0.06;

/** What a shelf is made of: solid sheet, perforated sheet or open slats. */
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
  // Rows of slots (perforated) or open slats along the shelf; a perforated shelf has a dark
  // underside showing through the slots.
  if (deck === "perforated") p.box("steelDark", x0 + DECK, x1 - DECK, top - DECK * 2.5, top - DECK * 1.5, inner0, inner1);
  const n = Math.max(2, Math.round((inner1 - inner0) / PITCH));
  const pitch = (inner1 - inner0) / n;
  const bar = deck === "perforated" ? pitch * 0.62 : pitch * 0.5;
  for (let i = 0; i < n; i++) {
    const zc = inner0 + pitch * (i + 0.5);
    p.box("steel", x0 + DECK, x1 - DECK, top - DECK, top, zc - bar / 2, zc + bar / 2);
  }
}
