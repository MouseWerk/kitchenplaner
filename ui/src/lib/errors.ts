// User-facing text for errors from the project parser and from the Rust commands. Kept apart from
// actions.ts so it can be tested without loading the renderers and three.js.
//
// The Rust side sends `{ kind, path, detail }` (src-tauri/src/lib.rs, `CmdError`): `kind` is a
// stable name, `path` the file name only, `detail` the OS text for the generic case. Its German
// log text is deliberately not sent, so the English UI never shows German.

import { ProjectError } from "../model/serialize";
import { t, type TKey } from "./i18n";

/** The error kinds of `kitchen_core::ErrorKind` with their own text; others fall back to generic. */
const KIND_KEYS: Record<string, TKey> = {
  tooLarge: "error.tooLarge",
  // A file that is not UTF-8 text cannot be a project; the user needs no encoding lesson.
  notUtf8: "error.notProjectFile",
  notProject: "error.notProjectFile",
  readOnly: "error.readOnly",
  notFound: "error.notFound",
  permissionDenied: "error.permissionDenied",
  badExtension: "error.badExtension",
  badPath: "error.badPath",
};

const field = (e: unknown, name: string): string | null =>
  typeof e === "object" && e && name in e && (e as Record<string, unknown>)[name] != null ? String((e as Record<string, unknown>)[name]) : null;

/** A message for the user from any error: project errors by their key, command errors by kind. */
export function errorText(e: unknown): string {
  if (e instanceof ProjectError) return t(e.key);
  const kind = field(e, "kind");
  const name = field(e, "path");
  const key = kind ? KIND_KEYS[kind] : undefined;
  // Every kind text names the file; without a name it would read „“, so the generic text is better.
  if (key && name) return t(key, { name });
  const message = field(e, "detail") ?? field(e, "message") ?? (kind ? kind : String(e));
  return t("error.generic", { message });
}
