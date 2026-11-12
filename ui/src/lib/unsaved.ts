// The question before unsaved changes would be lost (a new project, opening another, closing,
// quitting): „Speichern“, „Nicht speichern“ or „Abbrechen“, asked in the app's own dialog
// (components/UnsavedDialog.tsx). The native question offered only two answers and put the focus
// on discarding. Under the end-to-end tests the test answers it (platform.ts `e2eAnswer`): yes is
// „Nicht speichern“, no is „Abbrechen“.

import { useSyncExternalStore } from "react";
import { t } from "./i18n";
import { e2eAnswer } from "./platform";

export type UnsavedAnswer = "save" | "discard" | "cancel";

export interface UnsavedQuestion {
  /** The project's name, as the question names it. */
  name: string;
  answer: (a: UnsavedAnswer) => void;
}

let open: UnsavedQuestion | null = null;
const listeners = new Set<() => void>();

function set(q: UnsavedQuestion | null) {
  open = q;
  for (const f of listeners) f();
}

/** The question the dialog shows; null when none is asked. */
export function useUnsavedQuestion(): UnsavedQuestion | null {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => open,
  );
}

/**
 * Asks what happens to the unsaved changes of the project `name`. A second question while one is
 * open (closing the window while it asks) is cancelled: the first one is still being answered.
 */
export function askUnsaved(name: string): Promise<UnsavedAnswer> {
  const test = e2eAnswer(t("unsaved.question", { name }));
  if (test !== null) return Promise.resolve(test ? "discard" : "cancel");
  if (open) return Promise.resolve("cancel");
  return new Promise((resolve) => {
    const q: UnsavedQuestion = {
      name,
      answer: (a) => {
        if (open === q) set(null);
        resolve(a);
      },
    };
    set(q);
  });
}
