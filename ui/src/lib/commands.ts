// Editing commands on the selection, shared by the inspector, the toolbar, the shortcuts and the
// plan's operators.

import { bounds, footprint, normalizeAngle, rad, round } from "../model/geometry";
import { newId } from "../model/project";
import type { Item, Vec2 } from "../model/types";
import { selectedItems, useStore, type AppState } from "../store/store";

/** Offset of a duplicate from its original (mm), so both stay visible. */
const DUPLICATE_OFFSET = 200;

export function rotateSelected(deg: number) {
  const st = useStore.getState();
  st.updateItems(st.selection.items, (it) => ({ rotation: normalizeAngle(it.rotation + deg) }));
}

/** Copies of items with new ids, `offset` mm to the lower right. */
function copiesOf(items: readonly Item[], offset: number): Item[] {
  return items.map((it) => ({ ...it, id: newId(), x: round(it.x + offset), y: round(it.y + offset), connections: { ...it.connections } }));
}

export function duplicateSelected() {
  const st = useStore.getState();
  const copies = copiesOf(selectedItems(st), DUPLICATE_OFFSET);
  if (copies.length > 0) st.addItems(copies);
}

/** Moves the selection by (dx, dy) mm; each key press is one undo step. */
export function nudgeSelected(dx: number, dy: number) {
  const st = useStore.getState();
  st.updateItems(st.selection.items, (it) => ({ x: round(it.x + dx), y: round(it.y + dy) }));
}

export function selectAll() {
  const st = useStore.getState();
  st.select({ items: st.project.items.map((i) => i.id) });
}

export function deselectAll() {
  useStore.getState().select({ items: [], opening: null });
}

/** How a click or a frame changes the selection: replace it, add to it (Shift) or toggle (Ctrl/Cmd). */
export type SelectMode = "replace" | "add" | "toggle";

export function combineSelection(current: readonly string[], hits: readonly string[], mode: SelectMode): string[] {
  if (mode === "replace") return [...hits];
  if (mode === "add") return [...current, ...hits.filter((id) => !current.includes(id))];
  const flip = new Set(hits);
  return [...current.filter((id) => !flip.has(id)), ...hits.filter((id) => !current.includes(id))];
}

/** The centre of the items' common bounding box: the pivot of a rotation, the anchor of a move. */
export function selectionCentre(items: readonly Item[]): Vec2 {
  if (items.length === 1) return { x: items[0].x, y: items[0].y };
  const b = bounds(items.flatMap((it) => footprint(it)));
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** An item turned by `deg` (clockwise on the plan) around `pivot`. */
export function rotateItemAround(it: Item, pivot: Vec2, deg: number): Pick<Item, "x" | "y" | "rotation"> {
  const a = rad(deg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = it.x - pivot.x;
  const dy = it.y - pivot.y;
  return { x: round(pivot.x + dx * c - dy * s), y: round(pivot.y + dx * s + dy * c), rotation: normalizeAngle(round(it.rotation + deg)) };
}

/**
 * A running transform of items (a G or R operator, a mouse drag): one undo step however often
 * it changes the items, and a cancel brings back exactly the state before it, without an undo
 * step. Every update is computed from the items as they were at the start.
 */
export interface TransformSession {
  before: Pick<AppState, "project" | "past" | "future" | "dirty" | "selection">;
  /** The transformed items as they were at the start, by id. */
  origin: Map<string, Item>;
}

function snapshot(): TransformSession["before"] {
  const { project, past, future, dirty, selection } = useStore.getState();
  return { project, past, future, dirty, selection };
}

/** Starts transforming the selected items; null when nothing is selected. */
export function beginTransform(): TransformSession | null {
  const st = useStore.getState();
  const items = selectedItems(st);
  if (items.length === 0) return null;
  const before = snapshot();
  st.beginGesture();
  return { before, origin: new Map(items.map((i) => [i.id, i])) };
}

/**
 * Duplicates the selection and starts transforming the copies (Shift+D): the copies stand on
 * the originals until the grab moves them. Adding and moving are one undo step.
 */
export function beginDuplicate(): TransformSession | null {
  const st = useStore.getState();
  const copies = copiesOf(selectedItems(st), 0);
  if (copies.length === 0) return null;
  const before = snapshot();
  st.beginGesture();
  st.change((p) => ({ ...p, items: [...p.items, ...copies] }), { gesture: true });
  st.select({ items: copies.map((c) => c.id) });
  return { before, origin: new Map(copies.map((i) => [i.id, i])) };
}

/** Sets the transformed items from their start state. */
export function applyTransform(s: TransformSession, fn: (orig: Item) => Partial<Item>) {
  useStore.getState().updateItems([...s.origin.keys()], (it) => {
    const orig = s.origin.get(it.id);
    return orig ? fn(orig) : {};
  }, { gesture: true });
}

/** Ends the transform and keeps the result; a transform that changed nothing leaves no undo step. */
export function confirmTransform(s: TransformSession) {
  const st = useStore.getState();
  st.endGesture();
  const unchanged = st.project.items.every((it) => {
    const o = s.origin.get(it.id);
    return !o || (o.x === it.x && o.y === it.y && o.rotation === it.rotation);
  });
  // A duplicate that did not move still counts: it added items.
  const added = st.project.items.length !== s.before.project.items.length;
  if (unchanged && !added) restore(s);
}

/** Ends the transform and restores everything as it was before it (no undo step). */
export function cancelTransform(s: TransformSession) {
  useStore.getState().endGesture();
  restore(s);
}

function restore(s: TransformSession) {
  useStore.setState({ ...s.before });
}
