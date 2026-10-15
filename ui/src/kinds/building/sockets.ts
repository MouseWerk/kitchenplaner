// Sockets of the building elements: 230 V earthed sockets with a flip lid and 400 V five-pin
// (CEE) sockets, as on socket panels, media columns and floor boxes.

import type { Parts } from "../parts/mesh";

/**
 * A 230 V socket with a flip lid, `lid` square, on a face at `zFace` reaching `zFront`, centred
 * at (x, y): the base plate, the lid with rounded edges hinged at the top, its round cap.
 */
export function socket230(p: Parts, x: number, y: number, zFace: number, zFront: number, lid: number): void {
  const d = zFront - zFace;
  p.roundedBox("panelDark", x - lid / 2, x + lid / 2, y - lid / 2, y + lid / 2, zFace - 0.001, zFace + d * 0.4, 0.004, "top", "z");
  p.roundedBox("panelDark", x - lid * 0.43, x + lid * 0.43, y - lid * 0.43, y + lid * 0.43, zFace + d * 0.4, zFront - 0.003, 0.006, "top", "z");
  p.lathe("knob", x, y, zFront - 0.003, [[0, 0], [lid * 0.25, 0], [lid * 0.25, 0.001], [lid * 0.2, 0.003], [0, 0.003]], { axis: "z" });
  // The lid's hinge along its top edge.
  p.rod("knob", "x", x, y + lid * 0.43, zFace + d * 0.55, lid * 0.7, 0.004);
}

/**
 * A 400 V CEE socket in its red housing, radius `r`, on a face at `zFace`
 * reaching `zFront`, centred at (x, y): the turned housing and its spring lid on top.
 */
export function socket400(p: Parts, x: number, y: number, zFace: number, zFront: number, r: number): void {
  const d = zFront - zFace;
  p.lathe("signalRed", x, y, zFace - 0.001, [
    [0, 0],
    [r, 0],
    [r, d * 0.15],
    [r * 0.9, d * 0.25],
    [r * 0.9, d * 0.85],
    [r * 0.85, d],
    [0, d],
  ], { axis: "z" });
  p.roundedBox("signalRed", x - r * 0.7, x + r * 0.7, y + r * 0.55, y + r * 0.95, zFace + d * 0.3, zFront - 0.0005, 0.004);
}
