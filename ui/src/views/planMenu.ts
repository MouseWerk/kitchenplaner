// The entries of the floor plan's context menu (components/ContextMenu.tsx), per mode. They run
// the same commands as the keys, the toolbar and the inspector, and show the keys as hints.

import type { ContextEntry } from "../components/ContextMenu";
import { alignSelected, distributeSelected, packSelected } from "../lib/align";
import { duplicateSelected, rotateSelected, selectAll } from "../lib/commands";
import { currentLang, t } from "../lib/i18n";
import { setMeasuring } from "../lib/measureTool";
import { keyLabel } from "../lib/shortcuts";
import { flipHinge, flipSwing, isDoor } from "../model/doors";
import type { RoomHit } from "../model/roomEdit";
import type { Vec2 } from "../model/types";
import { useStore } from "../store/store";
import { insertCornerOnWall, removeRoomSelection } from "./RoomEditLayer";

const k = (combo: string) => keyLabel(combo, currentLang());

/** Moves the keyboard focus to the first field of the inspector (after the menu gave it back). */
export function focusInspector() {
  setTimeout(() => document.querySelector<HTMLElement>("aside.inspector :is(input, select, textarea, button):not(:disabled)")?.focus(), 0);
}

const measureEntry = (): ContextEntry => ({ label: t("measure.title"), hint: "M", onSelect: () => setMeasuring(true) });

/** Aligning, distributing and lining up the selection; for two or more items. */
export function alignEntries(count: number): ContextEntry[] {
  return [
    { label: t("align.left"), onSelect: () => alignSelected("left") },
    { label: t("align.centreX"), onSelect: () => alignSelected("centreX") },
    { label: t("align.right"), onSelect: () => alignSelected("right") },
    "sep",
    { label: t("align.top"), onSelect: () => alignSelected("top") },
    { label: t("align.centreY"), onSelect: () => alignSelected("centreY") },
    { label: t("align.bottom"), onSelect: () => alignSelected("bottom") },
    "sep",
    { label: t("align.distributeX"), disabled: count < 3, onSelect: () => distributeSelected("x") },
    { label: t("align.distributeY"), disabled: count < 3, onSelect: () => distributeSelected("y") },
    "sep",
    { label: t("align.packX"), onSelect: () => packSelected("x") },
    { label: t("align.packY"), onSelect: () => packSelected("y") },
  ];
}

/** The arrange mode: for the selected items, or with none selected the whole plan. */
export function arrangeMenu(): ContextEntry[] {
  const st = useStore.getState();
  const n = st.selection.items.length;
  if (n === 0) {
    return [{ label: t("contextMenu.selectAll"), hint: "A", disabled: st.project.items.length === 0, onSelect: selectAll }, measureEntry()];
  }
  return [
    { label: t("inspector.duplicate"), hint: k("Mod+D"), onSelect: duplicateSelected },
    { label: t("inspector.rotateRight"), hint: "R", onSelect: () => rotateSelected(90) },
    { label: t("inspector.rotateLeft"), hint: k("Shift+R"), onSelect: () => rotateSelected(-90) },
    ...(n >= 2 ? ["sep" as const, { label: t("align.title"), children: alignEntries(n) }] : []),
    "sep",
    { label: t("contextMenu.properties"), onSelect: focusInspector },
    measureEntry(),
    "sep",
    { label: t("inspector.delete"), hint: k("Del"), danger: true, onSelect: () => useStore.getState().removeSelected() },
  ];
}

/** The room mode (select tool): `hit` is what was under the pointer, already selected. */
export function roomMenu(world: Vec2, hit: RoomHit | null): ContextEntry[] {
  const st = useStore.getState();
  const sel = st.selection;
  const entries: ContextEntry[] = [];
  if (hit?.kind === "wall") entries.push({ label: t("contextMenu.insertCorner"), onSelect: () => insertCornerOnWall(hit.index, world) });
  const opening = sel.opening ? st.project.room.openings.find((o) => o.id === sel.opening) : undefined;
  if (opening && isDoor(opening)) {
    const flip = (f: typeof flipHinge) => () => {
      const s = useStore.getState();
      const o = s.project.room.openings.find((x) => x.id === opening.id);
      if (o) s.updateOpening(o.id, f(o));
    };
    entries.push({ label: t("contextMenu.flipHinge"), onSelect: flip(flipHinge) }, { label: t("contextMenu.flipSwing"), onSelect: flip(flipSwing) });
  }
  const any = sel.corners.length > 0 || sel.partitions.length > 0 || !!sel.opening;
  if (entries.length > 0) entries.push("sep");
  if (any) entries.push({ label: t("contextMenu.properties"), onSelect: focusInspector });
  entries.push(measureEntry());
  if (any) entries.push("sep", { label: t("inspector.delete"), hint: k("Del"), danger: true, onSelect: () => void removeRoomSelection() });
  return entries;
}
