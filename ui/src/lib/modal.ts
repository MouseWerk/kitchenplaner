// Modal transform operators, as in Blender: G grabs (moves), R rotates. While one runs the mouse
// drives it, X or Y locks an axis (pressed again: free), typed digits give an exact value, Enter
// or a click confirms, Escape or a right click cancels. Pure state functions: the plan view feeds
// them the cursor and the keys and applies the result to whatever the mode moves (items in
// "Einrichten", corners and openings in "Raum").

import type { Vec2 } from "../model/types";
import { currentLang, num, type Lang } from "./i18n";
import { parseNumber } from "../components/Fields";

export type Axis = "free" | "x" | "y";

export interface GrabOp {
  kind: "grab";
  /** Cursor (plan mm) when the operator started. */
  start: Vec2;
  axis: Axis;
  /** The value typed so far ("" when the mouse drives it). */
  typed: string;
}

export interface RotateOp {
  kind: "rotate";
  /** Centre of the rotation (plan mm). */
  pivot: Vec2;
  /** Cursor when the operator started. */
  start: Vec2;
  typed: string;
}

export type ModalOp = GrabOp | RotateOp;

/** Rotation steps (degrees) while the mouse drives a rotation; Alt rotates freely. */
export const ROTATE_STEP = 15;

export function startGrab(cursor: Vec2): GrabOp {
  return { kind: "grab", start: cursor, axis: "free", typed: "" };
}

export function startRotate(pivot: Vec2, cursor: Vec2): RotateOp {
  return { kind: "rotate", pivot, start: cursor, typed: "" };
}

/** The typed value as a number, or null while nothing (or only a sign) is typed. */
export function typedValue(op: ModalOp, lang: Lang = currentLang()): number | null {
  if (op.typed === "" || op.typed === "-") return null;
  return parseNumber(op.typed, lang);
}

/**
 * The move of a grab: the cursor's offset from the start (on the grid, along the locked axis),
 * or the typed distance along the locked axis — without a locked axis along the axis the mouse
 * moved most on, so "G 500 Enter" moves 500 mm the way the user pulled.
 */
export function grabDelta(op: GrabOp, cursor: Vec2, grid: number): Vec2 {
  const raw = { x: cursor.x - op.start.x, y: cursor.y - op.start.y };
  const typed = typedValue(op);
  const axis: Axis = op.axis !== "free" ? op.axis : typed !== null ? (Math.abs(raw.x) >= Math.abs(raw.y) ? "x" : "y") : "free";
  if (typed !== null) {
    // Typed without an axis: the sign follows the mouse, so 500 means "500 mm that way".
    const sign = op.axis === "free" && (axis === "x" ? raw.x : raw.y) < 0 ? -1 : 1;
    return axis === "x" ? { x: typed * sign, y: 0 } : { x: 0, y: typed * sign };
  }
  const snap = (v: number) => (grid > 0 ? Math.round(v / grid) * grid : v);
  if (axis === "x") return { x: snap(raw.x), y: 0 };
  if (axis === "y") return { x: 0, y: snap(raw.y) };
  return { x: snap(raw.x), y: snap(raw.y) };
}

/**
 * The angle of a rotation in degrees, clockwise on the plan: the typed value, else the angle the
 * cursor turned around the pivot, in `ROTATE_STEP` steps unless `free`.
 */
export function rotateAngle(op: RotateOp, cursor: Vec2, free: boolean): number {
  const typed = typedValue(op);
  if (typed !== null) return typed;
  const a0 = Math.atan2(op.start.y - op.pivot.y, op.start.x - op.pivot.x);
  const a1 = Math.atan2(cursor.y - op.pivot.y, cursor.x - op.pivot.x);
  let deg = ((a1 - a0) * 180) / Math.PI;
  if (deg > 180) deg -= 360;
  if (deg <= -180) deg += 360;
  return free ? Math.round(deg * 10) / 10 : Math.round(deg / ROTATE_STEP) * ROTATE_STEP;
}

/** What a key does to a running operator. */
export type KeyResult = { op: ModalOp } | "confirm" | "cancel" | null;

/**
 * Handles a key while an operator runs; null when the key is not the operator's (it is then
 * ignored, so no other shortcut fires in the middle of a move).
 */
export function operatorKey(op: ModalOp, key: string): KeyResult {
  if (key === "Enter" || key === " ") return "confirm";
  if (key === "Escape") return "cancel";
  if (key === "Backspace") return { op: { ...op, typed: op.typed.slice(0, -1) } };
  const k = key.toLowerCase();
  if (op.kind === "grab" && (k === "x" || k === "y")) {
    return { op: { ...op, axis: op.axis === k ? "free" : k } };
  }
  if (/^[0-9]$/.test(key)) return { op: { ...op, typed: op.typed + key } };
  if ((key === "." || key === ",") && !/[.,]/.test(op.typed)) return { op: { ...op, typed: op.typed + key } };
  // Minus toggles the sign, wherever the typing is.
  if (key === "-") return { op: { ...op, typed: op.typed.startsWith("-") ? op.typed.slice(1) : "-" + op.typed } };
  return null;
}

/** The status line of a running operator ("G  X  500 mm"), for the status bar. */
export function operatorLabel(op: ModalOp, cursor: Vec2, grid: number, free: boolean, lang: Lang = currentLang()): string {
  if (op.kind === "grab") {
    const d = grabDelta(op, cursor, grid);
    const axis = op.axis === "free" ? "" : `  ${op.axis.toUpperCase()}`;
    const typed = op.typed ? `  [${op.typed}]` : "";
    return `G${axis}${typed}  Δx ${num(d.x)}  Δy ${num(d.y)} mm`;
  }
  const typed = op.typed ? `  [${op.typed}]` : "";
  void lang;
  return `R${typed}  ${num(rotateAngle(op, cursor, free), 1)}°`;
}
