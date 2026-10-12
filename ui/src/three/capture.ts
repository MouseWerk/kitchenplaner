// The PNG export of the 3D view: the mounted view registers how to capture itself, exports call
// `capture3dPng`. Only one 3D view captures at a time; the last one mounted wins.

import { useSyncExternalStore } from "react";
import { t } from "../lib/i18n";

/** Renders the current 3D view as PNG bytes, optionally at a given width in pixels. */
export type CaptureFn = (widthPx?: number) => Promise<Uint8Array>;

let current: CaptureFn | null = null;
const listeners = new Set<() => void>();

function setCurrent(fn: CaptureFn | null) {
  if (fn === current) return;
  current = fn;
  for (const f of listeners) f();
}

/** Registers the capture of a mounted 3D view; the returned function unregisters it. */
export function registerCapture(fn: CaptureFn): () => void {
  setCurrent(fn);
  return () => {
    // A view mounted later may have replaced this one; only remove our own registration.
    if (current === fn) setCurrent(null);
  };
}

/** True when a 3D view is mounted and can be captured. */
export function canCapture3d(): boolean {
  return current !== null;
}

/** Calls `f` whenever `canCapture3d()` may have changed; returns the unsubscribe function. */
export function subscribeCapture(f: () => void): () => void {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** `canCapture3d()`, re-rendering the component when a 3D view mounts or unmounts. */
export function useCanCapture3d(): boolean {
  return useSyncExternalStore(subscribeCapture, canCapture3d);
}

/** PNG bytes of the current 3D view. Throws when no 3D view is mounted. */
export async function capture3dPng(widthPx?: number): Promise<Uint8Array> {
  if (!current) throw new Error(t("export.no3d"));
  return current(widthPx);
}
