// Updates of the installed app. At start and every few hours the shell asks the release feed
// (src-tauri/src/updater.rs); a newer version shows a quiet notice (components/UpdateNotice.tsx)
// with „Jetzt aktualisieren“ and „Später“. Installing saves the project first if the user wants to
// keep its changes, downloads with progress, asks again about changes made during the download,
// and restarts into the new version. Never in the
// browser, in debug builds or under the end-to-end tests. A failed check is only logged and noted
// in the settings menu: it must never get in the way of planning.

import { Channel, invoke } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { commitFocusedField, saveFile } from "./actions";
import { t } from "./i18n";
import { confirmDialog, isTauri } from "./platform";
import { getSettings } from "./settings";
import { toast } from "./toast";
import { useStore } from "../store/store";

/** How often a running app looks again (ms). */
export const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

export interface UpdateInfo {
  version: string;
  /** This copy cannot install it itself (a .deb install): the notice points to the downloads. */
  manual: boolean;
}

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

/** The shell's update commands; tests pass their own. */
export interface UpdaterApi {
  enabled(): Promise<boolean>;
  check(): Promise<UpdateInfo | null>;
  /** Downloads the update of the last check and verifies it; a new check drops the download. */
  download(onProgress: (p: UpdateProgress) => void): Promise<void>;
  /** Installs the downloaded update; resolves only if the app did not restart (it normally does). */
  install(): Promise<void>;
}

export interface UpdateState {
  /** This build looks for updates (the desktop app in a release build). */
  supported: boolean;
  available: UpdateInfo | null;
  /** The version the user put off with „Später“: not shown again until a newer one comes. */
  later: string | null;
  /** Set while downloading and installing. */
  progress: UpdateProgress | null;
  installFailed: boolean;
  /** The last check failed (a note in the settings menu). */
  checkFailed: boolean;
}

const INITIAL: UpdateState = { supported: false, available: null, later: null, progress: null, installFailed: false, checkFailed: false };

let state: UpdateState = INITIAL;
let api: UpdaterApi | null = null;
/** The version the shell holds downloaded, ready to install; null when none. */
let downloaded: string | null = null;
/**
 * The check under way, if any. Its answer replaces the shell's update and drops a download, so a
 * download waits for it instead of being dropped when the answer comes in after it.
 */
let checking: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  for (const f of listeners) f();
}

export function getUpdateState(): UpdateState {
  return state;
}

export function useUpdates(): UpdateState {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    () => state,
  );
}

/** The commands of src-tauri/src/updater.rs. */
export const tauriUpdater: UpdaterApi = {
  enabled: () => invoke<boolean>("update_enabled"),
  check: () => invoke<UpdateInfo | null>("update_check"),
  async download(onProgress) {
    const channel = new Channel<UpdateProgress>();
    channel.onmessage = onProgress;
    await invoke("update_download", { onProgress: channel });
  },
  install: () => invoke("update_install"),
};

const underTest = () => typeof window !== "undefined" && (window as { __KITCHENPLANER_E2E__?: boolean }).__KITCHENPLANER_E2E__ === true;

/**
 * Starts looking for updates: now, if the setting is on, and every `CHECK_INTERVAL`. Returns the
 * function that stops it. `updater` replaces the shell (tests).
 */
export function startUpdates(updater?: UpdaterApi): () => void {
  if (!updater && (!isTauri() || underTest())) return () => {};
  api = updater ?? tauriUpdater;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  void (async () => {
    const supported = await api!.enabled().catch(() => false);
    if (stopped || !supported) return;
    set({ supported: true });
    if (getSettings().autoUpdate) await checkForUpdate();
    if (stopped) return;
    timer = setInterval(() => {
      if (getSettings().autoUpdate) void checkForUpdate();
    }, CHECK_INTERVAL);
  })();
  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    api = null;
    downloaded = null;
    checking = null;
    state = INITIAL;
  };
}

/**
 * Asks for a newer version. `fromMenu`: the user asked, so the answer is a short message also when
 * there is none or the check failed.
 */
export async function checkForUpdate(fromMenu = false): Promise<void> {
  // None while downloading or installing: its answer would drop the download in the shell.
  if (!api || !state.supported || state.progress) return;
  const run = askFeed(api, fromMenu);
  checking = run;
  try {
    await run;
  } finally {
    if (checking === run) checking = null;
  }
}

async function askFeed(updater: UpdaterApi, fromMenu: boolean): Promise<void> {
  try {
    const found = await updater.check();
    downloaded = null;
    set({ available: found, checkFailed: false, installFailed: false, later: fromMenu ? null : state.later });
    if (fromMenu && !found) toast(t("update.upToDate"));
  } catch (e) {
    console.warn("update check failed:", e);
    set({ checkFailed: true });
    if (fromMenu) toast(t("update.checkFailed"));
  }
}

export function putOffUpdate() {
  if (state.available) set({ later: state.available.version });
}

/** Whether the notice shows: an update the user did not put off, or one being installed. */
export function noticeVisible(s: UpdateState): boolean {
  return s.available !== null && (s.progress !== null || s.later !== s.available.version);
}

/**
 * Installs the found update and restarts. Unsaved changes are saved first, or the update waits:
 * the restart would lose them. Planning goes on during the download, so the question comes again
 * before the restart when there are new changes; cancelled there, the download is kept for the
 * next „Jetzt aktualisieren“.
 */
export async function installUpdate(): Promise<void> {
  const found = state.available;
  if (!api || !found || found.manual || state.progress) return;
  if (!(await saveChanges())) return;
  set({ progress: { downloaded: 0, total: null }, installFailed: false });
  // A check that started before: its answer is waited for, and the update goes on only when it is
  // still this version (a newer one shows in the notice instead).
  if (checking) {
    await checking;
    if (state.available?.version !== found.version || state.available.manual) {
      set({ progress: null });
      return;
    }
  }
  try {
    if (downloaded !== found.version) {
      await api.download((p) => set({ progress: p }));
      downloaded = found.version;
    }
    if (!(await saveChanges())) {
      set({ progress: null });
      return;
    }
    await api.install();
    // Still here: the platform did not restart by itself.
    set({ progress: null });
  } catch (e) {
    console.warn("update install failed:", e);
    // The shell keeps neither a failed download nor one it failed to install: the retry loads again.
    downloaded = null;
    set({ progress: null, installFailed: true });
  }
}

/** Applies a typed field value, then saves unsaved changes if the user agrees; false: no update now. */
async function saveChanges(): Promise<boolean> {
  commitFocusedField();
  if (!useStore.getState().dirty) return true;
  const save = await confirmDialog(t("update.saveFirst"), t("app.name"), t("update.saveAndUpdate"), t("common.cancel"));
  return save && (await saveFile());
}

/** Download progress in percent, or null while the size is unknown. */
export function percent(p: UpdateProgress): number | null {
  return p.total ? Math.min(100, Math.round((p.downloaded / p.total) * 100)) : null;
}
