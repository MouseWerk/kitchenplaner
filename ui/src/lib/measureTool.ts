// Whether the measure tool of the floor plan is on. View state, not part of the project or its
// undo history: the toolbar button, the M key and the plan's context menu switch it, the plan's
// MeasureLayer (views/MeasureLayer.tsx) takes the pointer while it is on.

import { useSyncExternalStore } from "react";
import { useStore } from "../store/store";
import { cancelActiveOperator } from "./commands";

let active = false;
const listeners = new Set<() => void>();

export function isMeasuring(): boolean {
  return active;
}

/** Switches the tool; a running G or R ends first, as Escape would end it. */
export function setMeasuring(on: boolean) {
  if (on === active) return;
  if (on) cancelActiveOperator();
  active = on;
  if (!on) useStore.getState().setStatus(null);
  for (const f of listeners) f();
}

export function toggleMeasuring() {
  setMeasuring(!active);
}

/** The tool measures in the plan: only layouts that show one can switch it on. */
export function planShown(): boolean {
  const layout = useStore.getState().layout;
  return layout === "plan" || layout === "split";
}

// A layout without the plan has nothing to measure in: the tool ends with it.
useStore.subscribe((s, prev) => {
  if (s.layout !== prev.layout && !planShown()) setMeasuring(false);
});

export function useMeasuring(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => active,
  );
}
