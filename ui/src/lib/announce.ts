// Messages for screen readers: what a keyboard action did (placed, deleted, mode switched) and
// what the toasts say. Two hidden live regions in the window (components/LiveRegions.tsx), one
// polite and one assertive for errors. Live regions must exist before their text changes, so they
// stay mounted and the messages come and go inside them.

import { useSyncExternalStore } from "react";

export type Politeness = "polite" | "assertive";

export interface Announcement {
  id: number;
  text: string;
  politeness: Politeness;
}

/** A message stays this long (ms): long enough to be read out, short enough not to pile up. */
const KEEP_MS = 7000;
/** At most this many messages per region; a new one is added as its own node so a repeated text is read again. */
const MAX = 3;

let messages: Announcement[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const f of listeners) f();
}

/** Has `text` read out by a screen reader; errors (`assertive`) interrupt. */
export function announce(text: string, politeness: Politeness = "polite") {
  if (!text) return;
  const id = nextId++;
  const same = messages.filter((m) => m.politeness === politeness);
  const other = messages.filter((m) => m.politeness !== politeness);
  messages = [...other, ...same.slice(-(MAX - 1)), { id, text, politeness }];
  emit();
  setTimeout(() => {
    messages = messages.filter((m) => m.id !== id);
    emit();
  }, KEEP_MS);
}

export function useAnnouncements(): Announcement[] {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => messages,
  );
}
