// Keyboard shortcuts of the main window. Strg on Windows and Linux, Cmd on macOS.
//
// The editing modes add their own keys through `setModeKeyHandler`: the plan's arrange mode
// (G, R, Shift+D and the keys of a running operator) and the room layer register a handler while
// they are active; it sees every key first and swallows what it handles. A tool laid over both
// modes (the measure tool) registers with `setToolKeyHandler` and sees keys before the mode.

import { newFile, openFile, saveFile } from "./actions";
import { deselectAll, duplicateSelected, nudgeSelected, rotateSelected, selectAll } from "./commands";
import { planShown, toggleMeasuring } from "./measureTool";
import { useStore, type Layout } from "../store/store";

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** A shortcut as the user's keyboard labels it: „Strg+S“ / "Ctrl+S" / "⌘S". */
export function keyLabel(combo: string, lang: "de" | "en"): string {
  if (isMac) return combo.replace("Mod+", "⌘").replace("Shift+", "⇧").replace("Alt+", "⌥").replace("Enter", "↩");
  return combo
    .replace("Mod", lang === "de" ? "Strg" : "Ctrl")
    .replace("Shift", lang === "de" ? "Umschalt" : "Shift")
    .replace("Del", lang === "de" ? "Entf" : "Del")
    .replace("Enter", lang === "de" ? "Eingabe" : "Enter");
}

/** Nudge steps with the arrow keys (mm): plain and with Shift. */
const NUDGE = 10;
const NUDGE_BIG = 100;

const LAYOUT_KEYS: Record<string, Layout> = { "1": "plan", "2": "elevations", "3": "3d", "4": "split" };

/** Handles a key of the active editing mode; returns true when it took the key. */
export type ModeKeyHandler = (e: KeyboardEvent) => boolean;

let modeKeyHandler: ModeKeyHandler | null = null;

/**
 * Registers the key handler of the active editing mode (null removes it). The returned function
 * removes this handler only while it is still the registered one, so a late cleanup cannot drop
 * the handler of the mode that took over.
 */
export function setModeKeyHandler(fn: ModeKeyHandler | null): () => void {
  modeKeyHandler = fn;
  return () => {
    if (modeKeyHandler === fn) modeKeyHandler = null;
  };
}

let toolKeyHandler: ModeKeyHandler | null = null;

/** Registers the key handler of a tool over the modes (null removes it); as `setModeKeyHandler`. */
export function setToolKeyHandler(fn: ModeKeyHandler | null): () => void {
  toolKeyHandler = fn;
  return () => {
    if (toolKeyHandler === fn) toolKeyHandler = null;
  };
}

/** Handles a key press; returns true when it was a shortcut. `fit` fits the views. */
export function handleShortcut(e: KeyboardEvent, fit: () => void): boolean {
  const target = e.target as HTMLElement | null;
  const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  // Shortcuts do nothing behind an open dialog or menu.
  if (document.querySelector("[role=menu], [role=dialog]")) return false;
  if (!typing && (toolKeyHandler?.(e) || modeKeyHandler?.(e))) {
    e.preventDefault();
    return true;
  }
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const st = useStore.getState();
  const arrange = st.mode === "arrange";

  if (mod) {
    if (key === "s") return run(() => void saveFile(e.shiftKey), true);
    if (key === "o") return run(() => void openFile(), true);
    if (key === "n") return run(() => void newFile(), true);
    if (typing) return false;
    if (key === "z" && !e.shiftKey) return run(st.undo);
    if ((key === "z" && e.shiftKey) || key === "y") return run(st.redo);
    if (key === "d" && arrange) return run(duplicateSelected);
    if (key === "a" && arrange) return run(selectAll);
    return false;
  }
  if (typing) return false;
  // Alt+A clears the selection, as in Blender (by the key's position: Alt changes the character on macOS).
  if (e.altKey && e.code === "KeyA" && !e.shiftKey && arrange) return run(deselectAll);
  if (e.altKey) return false;
  // Tab switches between arranging equipment and editing the room, as in Blender.
  // Only from the views or with nothing focused: elsewhere Tab keeps moving the keyboard focus.
  const inViews = !target || target === document.body || !!target.closest?.(".views");
  if (key === "Tab" && inViews && !e.shiftKey) return run(() => st.setMode(st.mode === "room" ? "arrange" : "room"));
  if (key === "f") return run(fit);
  if (LAYOUT_KEYS[key]) return run(() => st.setLayout(LAYOUT_KEYS[key]));
  // M measures in the plan, in both modes (a running operator took the key above).
  if (key === "m" && !e.shiftKey && planShown()) return run(toggleMeasuring);
  // The rest edits equipment; the room mode handles its own keys (its handler above).
  if (!arrange) return false;
  const hasSel = st.selection.items.length > 0;
  switch (key) {
    case "Delete":
    case "Backspace":
    case "x":
      return hasSel && !e.shiftKey ? run(st.removeSelected) : false;
    case "Escape":
      return run(deselectAll);
    case "a":
      return e.shiftKey ? false : run(selectAll);
    // R with the cursor over the plan starts the rotate operator (plan handler); elsewhere it turns by 90°.
    case "r":
      return hasSel ? run(() => rotateSelected(e.shiftKey ? -90 : 90)) : false;
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
  return false;

  /** `commitField`: blur the focused field first, so its pending edit is applied before saving. */
  function run(f: () => void, commitField = false): true {
    e.preventDefault();
    if (commitField && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    f();
    return true;
  }
}
