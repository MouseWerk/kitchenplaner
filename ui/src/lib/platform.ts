// The bridge to the desktop shell. In the Tauri app files are read and written by the Rust
// side (atomic writes, `src-tauri/src/lib.rs`); in a plain browser (the Vite dev server, used
// for quick UI work and tests) opening uses a file picker and saving downloads the file.

import { invoke } from "@tauri-apps/api/core";

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface FileFilter {
  name: string;
  extensions: string[];
}

export const PROJECT_FILTER: FileFilter = { name: "Kitchenplaner", extensions: ["kplan"] };

/** An opened file: its path (null in the browser) and text. */
export interface OpenedFile {
  path: string | null;
  name: string;
  text: string;
}

/** Asks for a project file and reads it; null when the user cancelled. */
export async function openProjectFile(): Promise<OpenedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false, directory: false, filters: [PROJECT_FILTER] });
    if (typeof path !== "string") return null;
    return readProjectPath(path);
  }
  return pickInBrowser(".kplan,application/json");
}

/** Reads a project file at a known path (recent files). */
export async function readProjectPath(path: string): Promise<OpenedFile> {
  const text = await invoke<string>("read_project", { path });
  return { path, name: baseName(path), text };
}

/**
 * Writes text to a file. With `path` null the user is asked where (a save dialog with
 * `suggestedName` and `filter`); returns the path written (the file name in the browser), or
 * null when the user cancelled.
 */
export async function saveText(path: string | null, suggestedName: string, filter: FileFilter, text: string): Promise<string | null> {
  if (isTauri()) {
    const target = path ?? (await askSavePath(suggestedName, filter));
    if (!target) return null;
    await invoke("write_text_file", { path: target, contents: text });
    return target;
  }
  download(new Blob([text], { type: mimeOf(filter) }), suggestedName);
  return suggestedName;
}

/** Writes binary data (PNG) after a save dialog; returns the path, or null when cancelled. */
export async function saveBinary(suggestedName: string, filter: FileFilter, data: Uint8Array): Promise<string | null> {
  if (isTauri()) {
    const target = await askSavePath(suggestedName, filter);
    if (!target) return null;
    await invoke("write_binary_file", { path: target, data: toBase64(data) });
    return target;
  }
  download(new Blob([data as BlobPart], { type: mimeOf(filter) }), suggestedName);
  return suggestedName;
}

/** The recently opened projects, newest first (empty in the browser). */
export async function recentFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  return invoke<string[]>("recent_files");
}

export async function addRecentFile(path: string): Promise<void> {
  if (isTauri()) await invoke("add_recent_file", { path });
}

/** A yes/no question; the native dialog in the app. */
export async function confirmDialog(message: string, title: string, okLabel: string, cancelLabel: string): Promise<boolean> {
  if (isTauri()) {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return ask(message, { title, kind: "warning", okLabel, cancelLabel });
  }
  return window.confirm(message);
}

async function askSavePath(suggestedName: string, filter: FileFilter): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: suggestedName, filters: [filter] });
  if (!path) return null;
  // Some platforms return the name without the extension the filter asked for.
  const ext = filter.extensions[0];
  return ext && !path.toLowerCase().endsWith(`.${ext}`) ? `${path}.${ext}` : path;
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Device names Windows reserves in every folder, whatever the case and extension ("nul.txt"
 * is the device too): saving a project named "Con" would fail or write to the device.
 */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)$/i;

/** A file name without characters or names Windows, macOS or Linux refuse. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").trim();
  if (!cleaned) return "Kitchenplaner";
  // Windows matches the part before the first dot, ignoring spaces before that dot.
  const dot = cleaned.indexOf(".");
  const stem = dot < 0 ? cleaned : cleaned.slice(0, dot);
  if (!WINDOWS_RESERVED.test(stem.trimEnd())) return cleaned;
  return `${stem}_${cleaned.slice(stem.length)}`;
}

function mimeOf(filter: FileFilter): string {
  const ext = filter.extensions[0];
  return ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "csv" ? "text/csv" : ext === "dxf" ? "application/dxf" : "application/json";
}

function toBase64(data: Uint8Array): string {
  let s = "";
  for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(s);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function pickInBrowser(accept: string): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      resolve(f ? { path: null, name: f.name, text: await f.text() } : null);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
