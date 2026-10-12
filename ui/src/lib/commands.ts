// Editing commands on the selection, shared by the inspector, the toolbar and the shortcuts.

import { normalizeAngle, round } from "../model/geometry";
import { newId } from "../model/project";
import { selectedItems, useStore } from "../store/store";

/** Offset of a duplicate from its original (mm), so both stay visible. */
const DUPLICATE_OFFSET = 200;

export function rotateSelected(deg: number) {
  const st = useStore.getState();
  st.updateItems(st.selection.items, (it) => ({ rotation: normalizeAngle(it.rotation + deg) }));
}

export function duplicateSelected() {
  const st = useStore.getState();
  const copies = selectedItems(st).map((it) => ({ ...it, id: newId(), x: round(it.x + DUPLICATE_OFFSET), y: round(it.y + DUPLICATE_OFFSET), connections: { ...it.connections } }));
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
