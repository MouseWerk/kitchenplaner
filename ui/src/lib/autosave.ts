// Autosave and recovery: while the project has unsaved changes, a backup is kept a few seconds
// after the last change, so a crash or a power cut loses at most that much work. Saving, opening,
// a new project or closing without saving removes it; at the next start, backups of apps that
// ended without that are offered for recovery (components/RecoveryDialog.tsx).
//
// In the app the backups live in the app data folder (crates/kitchen-core/src/autosave.rs, which
// also tells running apps from ended ones by an OS file lock). In a plain browser (the Vite dev
// server) they live in localStorage, and Web Locks tell open tabs from closed ones, so the dev app
// behaves the same.

import { invoke } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { parseProject, ProjectError, serializeProject } from "../model/serialize";
import { useStore, type AppState } from "../store/store";
import { confirmDiscard } from "./actions";
import { errorText } from "./errors";
import { currentLang, t, type Lang } from "./i18n";
import { baseName, isTauri } from "./platform";
import { toast } from "./toast";

/** A backup is written this long after the last change (ms)... */
export const AUTOSAVE_DELAY = 5_000;
/** ...but no later than this after the first unsaved change, while the editing goes on. */
export const AUTOSAVE_MAX_WAIT = 30_000;

/** Browser backups older than this are removed (as in the Rust core). */
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
/** How many browser backups of closed tabs are kept. */
const MAX_KEPT = 5;

/** A backup of an app that ended without saving. */
export interface Recoverable {
  id: string;
  /** The file it belongs to; null for a project never saved. */
  path: string | null;
  /** The project name ("" when unknown). */
  name: string;
  /** Time of the backup, ms since 1970. */
  savedAt: number;
  appVersion: string;
  /** Whether `path` still exists; if not, the project comes back as a new one. */
  pathExists: boolean;
}

export interface Restored extends Omit<Recoverable, "id"> {
  text: string;
}

export interface AutosaveBackend {
  /** Keeps `project` as this app's backup, replacing the last one. */
  write(project: string, path: string | null, name: string): Promise<void>;
  /** Removes this app's backup. */
  clear(): Promise<void>;
  /** Backups of ended apps, newest first (removing old and surplus ones). */
  list(): Promise<Recoverable[]>;
  /** Takes over a backup: it becomes this app's own. Fails with kind "notFound" when it is gone. */
  restore(id: string): Promise<Restored>;
  /** Removes a backup of an ended app for good. */
  discard(id: string): Promise<void>;
}

const tauriBackend: AutosaveBackend = {
  write: (project, path, name) => invoke("autosave_write", { project, path, name }),
  clear: () => invoke("autosave_clear"),
  list: () => invoke<Recoverable[]>("autosave_list"),
  restore: (id) => invoke<Restored>("autosave_restore", { id }),
  discard: (id) => invoke("autosave_discard", { id }),
};

const KEY_PREFIX = "kitchenplaner.autosave.";
const LOCK_PREFIX = "kitchenplaner-autosave-";

interface StoredBackup {
  text: string;
  path: string | null;
  name: string;
  savedAt: number;
}

/**
 * Backups in `storage` (localStorage). Each page load is a session holding a Web Lock until the
 * tab closes or reloads; without Web Locks every other session counts as ended.
 */
export function browserBackend(storage: Storage, locks: LockManager | undefined, now: () => number = Date.now): AutosaveBackend {
  const id = Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0")).join("");
  // Held for the life of the page: the promise never settles.
  void locks?.request(LOCK_PREFIX + id, () => new Promise<void>(() => {})).catch(() => {});
  const keyOf = (sid: string) => KEY_PREFIX + sid;
  const gone = () => ({ kind: "notFound", path: null, detail: null });
  const running = async (): Promise<Set<string>> => {
    const held = locks ? ((await locks.query().catch(() => null))?.held ?? []) : [];
    return new Set(held.map((l) => (l.name ?? "").slice(LOCK_PREFIX.length)));
  };
  const read = (sid: string): StoredBackup | null => {
    try {
      const v = JSON.parse(storage.getItem(keyOf(sid)) ?? "null") as StoredBackup | null;
      return v && typeof v.text === "string" && typeof v.savedAt === "number" ? v : null;
    } catch {
      return null;
    }
  };
  return {
    async write(text, path, name) {
      storage.setItem(keyOf(id), JSON.stringify({ text, path, name, savedAt: now() } satisfies StoredBackup));
    },
    async clear() {
      storage.removeItem(keyOf(id));
    },
    async list() {
      const live = await running();
      const found: Recoverable[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(KEY_PREFIX)) continue;
        const sid = key.slice(KEY_PREFIX.length);
        if (sid === id || live.has(sid)) continue;
        const b = read(sid);
        if (!b || now() - b.savedAt > MAX_AGE) continue;
        found.push({ id: sid, path: b.path, name: b.name, savedAt: b.savedAt, appVersion: "", pathExists: false });
      }
      found.sort((a, b) => b.savedAt - a.savedAt);
      // Damaged, old and surplus backups go (collected first: removing shifts the indices).
      const keep = new Set(found.slice(0, MAX_KEPT).map((r) => r.id));
      const stale: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        const sid = key?.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : null;
        if (sid && sid !== id && !live.has(sid) && !keep.has(sid)) stale.push(key!);
      }
      for (const key of stale) storage.removeItem(key);
      return found.slice(0, MAX_KEPT);
    },
    async restore(sid) {
      if (sid === id || (await running()).has(sid)) throw gone();
      const b = read(sid);
      if (!b) throw gone();
      storage.removeItem(keyOf(sid));
      storage.setItem(keyOf(id), JSON.stringify(b));
      return { text: b.text, path: b.path, name: b.name, savedAt: b.savedAt, appVersion: "", pathExists: false };
    },
    async discard(sid) {
      if (sid === id) return;
      storage.removeItem(keyOf(sid));
    },
  };
}

let backend: AutosaveBackend | null = null;

function currentBackend(): AutosaveBackend {
  backend ??= isTauri() ? tauriBackend : browserBackend(localStorage, typeof navigator !== "undefined" ? navigator.locks : undefined);
  return backend;
}

// ---- The time of the last backup, for the status bar

let lastSaved: number | null = null;
const listeners = new Set<() => void>();

function setLastSaved(v: number | null) {
  if (v === lastSaved) return;
  lastSaved = v;
  for (const f of listeners) f();
}

/** When this app last kept a backup of the open project (ms); null when it has none. */
export const lastAutosave = (): number | null => lastSaved;

/** `lastAutosave`, re-rendering the component when it changes. */
export function useLastAutosave(): number | null {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    },
    lastAutosave,
  );
}

// ---- Writing and clearing

let timer: ReturnType<typeof setTimeout> | null = null;
/** Time of the first change not in a backup yet; null when none is pending. */
let pendingSince: number | null = null;
/** Writes and clears run one after the other, in the order they were asked for. */
let queue: Promise<void> = Promise.resolve();
/** The last write failed: the next failure in a row is not shown again. */
let failing = false;

function enqueue(job: () => Promise<void>): Promise<void> {
  queue = queue.then(job).catch((e: unknown) => {
    if (!failing) toast(t("autosave.failed", { message: errorText(e) }), "danger");
    failing = true;
  });
  return queue;
}

function cancelPending() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  pendingSince = null;
}

function schedule() {
  const now = Date.now();
  pendingSince ??= now;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flush, Math.max(0, Math.min(AUTOSAVE_DELAY, pendingSince + AUTOSAVE_MAX_WAIT - now)));
}

function flush() {
  cancelPending();
  void enqueue(async () => {
    // The state when the write runs: a save in between makes the backup unnecessary.
    const { project, path, dirty } = useStore.getState();
    if (!dirty) return;
    await currentBackend().write(serializeProject(project), path, project.info.name);
    failing = false;
    setLastSaved(Date.now());
  });
}

function clearBackup(): Promise<void> {
  cancelPending();
  return enqueue(async () => {
    await currentBackend().clear();
    setLastSaved(null);
  });
}

/**
 * Starts keeping backups of unsaved changes; returns the function that stops it. `with` replaces
 * the backend (tests).
 */
export function startAutosave(withBackend?: AutosaveBackend): () => void {
  if (withBackend) backend = withBackend;
  const stop = useStore.subscribe((s: AppState, prev: AppState) => {
    if (s.dirty && s.project !== prev.project) schedule();
    // Saved, or replaced by a project without changes (new, opened).
    else if (!s.dirty && prev.dirty) void clearBackup();
  });
  return () => {
    stop();
    cancelPending();
    failing = false;
    setLastSaved(null);
  };
}

/** Removes the backup before the window closes without saving (the user discarded the changes). */
export function discardOwnBackup(): Promise<void> {
  return clearBackup();
}

// ---- Recovery

/** Backups of apps that ended without saving, newest first; none when they cannot be read. */
export async function findRecoverable(): Promise<Recoverable[]> {
  try {
    return await currentBackend().list();
  } catch {
    return [];
  }
}

/**
 * Opens the backup `r` as an unsaved project: with its original path when that file still exists
 * (so saving writes there), else as a new project. Returns whether it was opened.
 */
export async function restoreBackup(r: Recoverable): Promise<boolean> {
  if (!(await confirmDiscard())) return false;
  let restored: Restored;
  try {
    restored = await currentBackend().restore(r.id);
  } catch (e) {
    const kind = typeof e === "object" && e && "kind" in e ? (e as { kind: unknown }).kind : null;
    toast(kind === "notFound" ? t("autosave.gone") : errorText(e), "danger");
    return false;
  }
  try {
    const project = parseProject(restored.text);
    useStore.getState().load(project, restored.pathExists ? restored.path : null, { dirty: true });
    toast(t("autosave.restored", { name: project.info.name }));
    return true;
  } catch (e) {
    // A backup the UI cannot read is no use: it is this app's own now, so it goes.
    if (e instanceof ProjectError) void clearBackup();
    toast(errorText(e), "danger");
    return false;
  }
}

/** What the recovery dialog says about a backup: its name, when it was kept, and its file. */
export function backupDetails(r: Recoverable, lang: Lang = currentLang()): { name: string; when: string; file: string } {
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const when = new Date(r.savedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const file = !r.path ? t("autosave.neverSaved", undefined, lang) : t(r.pathExists ? "autosave.file" : "autosave.fileGone", { file: baseName(r.path) }, lang);
  return { name: r.name || t("app.untitled", undefined, lang), when: t("autosave.savedAt", { when }, lang), file };
}

/** The status bar's note for a backup kept at `time` (ms): „Automatisch gesichert 14:32“. */
export function autosaveStatus(time: number, lang: Lang = currentLang()): string {
  const hhmm = new Date(time).toLocaleTimeString(lang === "de" ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  return t("autosave.status", { time: hhmm }, lang);
}

/** Removes the backup `r` for good. */
export async function discardBackup(r: Recoverable): Promise<void> {
  try {
    await currentBackend().discard(r.id);
  } catch (e) {
    toast(errorText(e), "danger");
  }
}
