// The short introduction: shown once on the first start of the app on a computer, and again on
// request (view menu). Whether it was seen is stored per computer in the webview's storage, like
// the appearance settings; a failing storage (private mode) shows it once per session.

import { useSyncExternalStore } from "react";

const KEY = "kitchenplaner.intro.v1";

let open = false;
let seenThisSession = false;
const listeners = new Set<() => void>();

function emit() {
  for (const f of listeners) f();
}

export function introSeen(): boolean {
  if (seenThisSession) return true;
  try {
    return localStorage.getItem(KEY) === "seen";
  } catch {
    return false;
  }
}

function markSeen() {
  seenThisSession = true;
  try {
    localStorage.setItem(KEY, "seen");
  } catch {
    // Storage unavailable: it stays seen for this session.
  }
}

/** Opens the introduction on the first start; true when it opened. */
export function showIntroOnFirstStart(): boolean {
  if (introSeen()) return false;
  openIntro();
  return true;
}

export function openIntro() {
  if (open) return;
  open = true;
  // Seen as soon as it is shown: a crash or closing the window does not bring it back each time.
  markSeen();
  emit();
}

export function closeIntro() {
  if (!open) return;
  open = false;
  emit();
}

export function useIntroOpen(): boolean {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => open,
  );
}

/** Forgets the session state; for tests. */
export function resetIntroForTests() {
  open = false;
  seenThisSession = false;
  emit();
}
