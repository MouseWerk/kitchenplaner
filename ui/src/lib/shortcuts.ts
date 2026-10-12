// Keyboard shortcuts of the main window. Strg on Windows and Linux, Cmd on macOS.

import { newFile, openFile, saveFile } from "./actions";
import { duplicateSelected, nudgeSelected, rotateSelected, selectAll } from "./commands";
import { useStore, type Layout } from "../store/store";

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** A shortcut as the user's keyboard labels it: „Strg+S“ / "Ctrl+S" / "⌘S". */
export function keyLabel(combo: string, lang: "de" | "en"): string {
  if (isMac) return combo.replace("Mod+", "⌘").replace("Shift+", "⇧").replace("Alt+", "⌥");
  return combo.replace("Mod", lang === "de" ? "Strg" : "Ctrl").replace("Shift", lang === "de" ? "Umschalt" : "Shift").replace("Del", lang === "de" ? "Entf" : "Del");
}

/** Nudge steps with the arrow keys (mm): plain and with Shift. */
const NUDGE = 10;
const NUDGE_BIG = 100;

const LAYOUT_KEYS: Record<string, Layout> = { "1": "plan", "2": "elevations", "3": "3d", "4": "split" };

/** Handles a key press; returns true when it was a shortcut. `fit` fits the views. */
export function handleShortcut(e: KeyboardEvent, fit: () => void): boolean {
  const target = e.target as HTMLElement | null;
  const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  // Shortcuts do nothing behind an open dialog or menu.
  if (document.querySelector("[role=menu], [role=dialog]")) return false;
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const st = useStore.getState();

  if (mod) {
    if (key === "s") return run(() => void saveFile(e.shiftKey));
    if (key === "o") return run(() => void openFile());
    if (key === "n") return run(() => void newFile());
    if (typing) return false;
    if (key === "z" && !e.shiftKey) return run(st.undo);
    if ((key === "z" && e.shiftKey) || key === "y") return run(st.redo);
    if (key === "d") return run(duplicateSelected);
    if (key === "a") return run(selectAll);
    return false;
  }
  if (typing || e.altKey) return false;
  const hasSel = st.selection.items.length > 0;
  switch (key) {
    case "Delete":
    case "Backspace":
      return hasSel || st.selection.opening ? run(st.removeSelected) : false;
    case "Escape":
      return run(() => st.select({ items: [], opening: null }));
    case "r":
      return hasSel ? run(() => rotateSelected(e.shiftKey ? -90 : 90)) : false;
    case "f":
      return run(fit);
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown": {
      if (!hasSel) return false;
      const s = e.shiftKey ? NUDGE_BIG : NUDGE;
      const dx = key === "ArrowLeft" ? -s : key === "ArrowRight" ? s : 0;
      const dy = key === "ArrowUp" ? -s : key === "ArrowDown" ? s : 0;
      return run(() => nudgeSelected(dx, dy));
    }
  }
  if (LAYOUT_KEYS[key]) return run(() => st.setLayout(LAYOUT_KEYS[key]));
  return false;

  function run(f: () => void): true {
    e.preventDefault();
    f();
    return true;
  }
}
