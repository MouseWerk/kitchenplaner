// Short status messages at the bottom of the window.

import { useSyncExternalStore } from "react";

export type ToastTone = "neutral" | "danger";

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

/** How long a message stays (ms); errors stay longer so they can be read. */
const DURATION = 3500;
const DURATION_ERROR = 8000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const f of listeners) f();
}

export function toast(text: string, tone: ToastTone = "neutral") {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, text, tone }];
  emit();
  setTimeout(() => dismissToast(id), tone === "danger" ? DURATION_ERROR : DURATION);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => toasts,
  );
}
