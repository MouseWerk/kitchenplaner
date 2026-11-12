// Keyboard shortcuts of the main window. Strg on Windows and Linux, Cmd on macOS.
//
// The editing modes add their own keys through `setModeKeyHandler`: the plan's arrange mode
// (G, R, Shift+D and the keys of a running operator) and the room layer register a handler while
// they are active; it sees every key first and swallows what it handles. A tool laid over both
// modes (the measure tool) registers with `setToolKeyHandler` and sees keys before the mode.
//
// Tab switches the mode only while a drawing itself has the focus (an element marked
// `data-drawing`: the floor plan, the 3D view); everywhere else it moves the keyboard focus, so a
// button in a pane or a field never traps it. F6 and Shift+F6 jump between the window's regions.

import { newFile, openFile, saveFile } from "./actions";
import { announce } from "./announce";
import { deselectAll, duplicateSelected, nudgeSelected, rotateSelected, selectAll } from "./commands";
import { t } from "./i18n";
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

/** The regions F6 cycles through, in the window's reading order. */
const REGIONS = ["header.toolbar", "aside.sidebar", "main.views", "aside.inspector"];

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]";

/** Moves the focus to the next (`step` 1) or previous (-1) region: its drawing, or its first control. */
export function focusRegion(step: 1 | -1): boolean {
  const regions = REGIONS.map((sel) => document.querySelector<HTMLElement>(sel)).filter((r): r is HTMLElement => !!r);
  if (regions.length === 0) return false;
  const active = document.activeElement;
  // From outside every region (nothing focused, a toast) F6 starts at the first, Shift+F6 at the last.
  const at = regions.findIndex((r) => r.contains(active));
  const from = at >= 0 ? at : step > 0 ? -1 : regions.length;
  for (let n = 1; n <= regions.length; n++) {
    const region = regions[(((from + step * n) % regions.length) + regions.length) % regions.length];
    const target =
      region.querySelector<HTMLElement>("[data-drawing][tabindex='0']") ??
      [...region.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => el.tabIndex >= 0 && !el.closest("[hidden], [inert]"));
    if (target) {
      target.focus();
      return true;
    }
  }
  return false;
}

/**
 * Left and Right (and Home, End) move the focus between the buttons of a toolbar or a segment
 * group, as Up and Down do in the menus. Returns true when it moved.
 */
export function toolbarArrow(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target || target.tagName !== "BUTTON" || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return false;
  const group = target.closest<HTMLElement>("[role=toolbar], .seg[role=group]");
  if (!group) return false;
  const buttons = [...group.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter((b) => !b.closest("[role=menu]"));
  const i = buttons.indexOf(target as HTMLButtonElement);
  if (i < 0) return false;
  const to = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
  buttons[to].focus();
  return true;
}

/** Selects the next (`step` 1) or previous (-1) item by position number and reads it out. */
export function selectNextItem(step: 1 | -1) {
  const st = useStore.getState();
  const items = [...st.project.items].sort((a, b) => a.pos - b.pos);
  if (items.length === 0) {
    announce(t("announce.noItems"));
    return;
  }
  const sel = st.selection.items;
  // From the last selected one on; with none selected N starts at the first, Shift+N at the last.
  const current = sel.length > 0 ? items.findIndex((i) => i.id === sel[sel.length - 1]) : -1;
  const next = current < 0 ? (step > 0 ? 0 : items.length - 1) : (current + step + items.length) % items.length;
  const item = items[next];
  st.select({ items: [item.id], opening: null });
  announce(t("announce.selected", { pos: String(item.pos), name: item.name, i: next + 1, n: items.length }));
}

/** Handles a key press; returns true when it was a shortcut. `fit` fits the views. */
export function handleShortcut(e: KeyboardEvent, fit: () => void): boolean {
  const target = e.target as HTMLElement | null;
  const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  // Shortcuts do nothing behind an open dialog or menu.
  if (document.querySelector("[role=menu], [role=dialog]")) return false;
  // F6 also leaves a field: it is how the keyboard gets from one region to the next.
  if (e.key === "F6" && !e.ctrlKey && !e.metaKey && !e.altKey) return focusRegion(e.shiftKey ? -1 : 1) ? run(() => {}) : false;
  // Arrows on a toolbar move the focus there; nudging the selection must not see them.
  if (toolbarArrow(e)) return run(() => {});
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
    if (key === "a" && arrange) return run(selectAllAnnounced);
    return false;
  }
  if (typing) return false;
  // Alt+A clears the selection, as in Blender (by the key's position: Alt changes the character on macOS).
  if (e.altKey && e.code === "KeyA" && !e.shiftKey && arrange) return run(deselectAnnounced);
  if (e.altKey) return false;
  // Tab switches between arranging equipment and editing the room, as in Blender, while the
  // drawing has the focus; anywhere else (a button in a pane, nothing focused) it moves the focus.
  if (key === "Tab" && !e.shiftKey && !!target?.matches?.("[data-drawing]")) return run(() => st.setMode(st.mode === "room" ? "arrange" : "room"));
  if (key === "f") return run(fit);
  if (LAYOUT_KEYS[key]) return run(() => st.setLayout(LAYOUT_KEYS[key]));
  // M measures in the plan, in both modes (a running operator took the key above).
  if (key === "m" && !e.shiftKey && planShown()) return run(toggleMeasuring);
  // The rest edits equipment; the room mode handles its own keys (its handler above).
  if (!arrange) return false;
  const n = st.selection.items.length;
  const hasSel = n > 0;
  switch (key) {
    case "Delete":
    case "Backspace":
    case "x":
      return hasSel && !e.shiftKey
        ? run(() => {
            st.removeSelected();
            announce(t("announce.deleted", { n }));
          })
        : false;
    case "Escape":
      return run(deselectAnnounced);
    case "a":
      return e.shiftKey ? false : run(selectAllAnnounced);
    // N walks through the items one by one: how the keyboard picks a single unit.
    case "n":
      return run(() => selectNextItem(e.shiftKey ? -1 : 1));
    // R with the cursor over the plan starts the rotate operator (plan handler); elsewhere it turns by 90°.
    case "r":
      return hasSel
        ? run(() => {
            const deg = e.shiftKey ? -90 : 90;
            rotateSelected(deg);
            announce(t("announce.rotated", { deg }));
          })
        : false;
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

  function selectAllAnnounced() {
    selectAll();
    announce(t("announce.selectedAll", { n: useStore.getState().selection.items.length }));
  }

  function deselectAnnounced() {
    const had = useStore.getState().selection.items.length > 0;
    deselectAll();
    if (had) announce(t("announce.deselected"));
  }

  /** `commitField`: blur the focused field first, so its pending edit is applied before saving. */
  function run(f: () => void, commitField = false): true {
    e.preventDefault();
    if (commitField && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    f();
    return true;
  }
}
