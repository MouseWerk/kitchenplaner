// The pointer position on the plan (mm) for the status bar. It changes with every pointer move,
// so it lives here and not in the window's state: only the status bar's readout re-renders.

import { useSyncExternalStore } from "react";
import type { Vec2 } from "../model/types";

let cursor: Vec2 | null = null;
const listeners = new Set<() => void>();

/** Sets the cursor on the plan (mm), or null when the pointer left it. */
export function setCursor(p: Vec2 | null): void {
  if (p === cursor || (p && cursor && p.x === cursor.x && p.y === cursor.y)) return;
  cursor = p;
  for (const f of listeners) f();
}

export function getCursor(): Vec2 | null {
  return cursor;
}

/** Calls `f` whenever the cursor changed; returns the unsubscribe function. */
export function subscribeCursor(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** The cursor, re-rendering the component when it moves. */
export function useCursor(): Vec2 | null {
  return useSyncExternalStore(subscribeCursor, getCursor);
}
