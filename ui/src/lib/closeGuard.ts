// The unsaved-changes question when the window closes or the app quits. Set up once at start
// (main.tsx), outside the React tree: after a crash the boundary replaces the app (its crash
// screen still asks, components/ErrorBoundary.tsx), and the guard must stay.

import { invoke } from "@tauri-apps/api/core";
import { confirmDiscard } from "./actions";
import { discardOwnBackup } from "./autosave";
import { isTauri } from "./platform";
import { useStore } from "../store/store";

/** Installs the guard; returns the function that removes it. */
export function installCloseGuard(): () => void {
  if (!isTauri()) {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }
  let unlisten: (() => void) | undefined;
  let removed = false;
  void (async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    const off = await win.onCloseRequested(async (event) => {
      event.preventDefault();
      // Closing without saving: the discarded changes must not come back as a backup.
      if (await confirmDiscard()) await discardOwnBackup().then(() => win.destroy());
    });
    // Quitting the app (Cmd+Q on macOS) closes no window first, so the shell holds the exit and
    // asks here; "confirm_exit" lets it go.
    const { listen } = await import("@tauri-apps/api/event");
    const offExit = await listen("exit-requested", async () => {
      if (await confirmDiscard()) await discardOwnBackup().then(() => invoke("confirm_exit"));
    });
    unlisten = () => {
      off();
      offExit();
    };
    if (removed) unlisten();
  })();
  return () => {
    removed = true;
    unlisten?.();
  };
}
