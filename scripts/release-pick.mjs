// Which version the automatic release (.github/workflows/auto-release.yml) publishes: the app's
// version (Cargo.toml, scripts/version.mjs), when docs/releases/v<version>.md exists, the version is
// newer than every release tag and its own tag does not exist yet. Prints that version (without v),
// or nothing.
//
//   node scripts/release-pick.mjs <version> <notes folder> <file with one tag per line>

import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RELEASE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** `[major, minor, patch]` of `v1.2.3`, or null for anything else (pre-releases, other tags). */
export function parse(tag) {
  const m = RELEASE.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * `{ version, note }`: the version to release (or null) and, when there is nothing to release, why.
 * `version` is the app's version without v, `noteFiles` the names in docs/releases, `tags` every tag
 * of the repository.
 */
export function pick(version, noteFiles, tags) {
  const own = parse(`v${version}`);
  if (!own) return { version: null, note: `The app's version ${JSON.stringify(version)} is not MAJOR.MINOR.PATCH.` };
  const notes = noteFiles.map((f) => (f.endsWith(".md") ? parse(f.slice(0, -3)) : null)).filter(Boolean);
  const ahead = notes.filter((n) => compare(n, own) > 0).sort(compare).at(-1);
  // Notes for a newer version than the app's: the version was not raised yet. Never released from here.
  const hint = ahead ? ` (docs/releases/v${ahead.join(".")}.md is newer than the app's version ${version}: raise it to release that)` : "";
  if (!noteFiles.includes(`v${version}.md`)) return { version: null, note: `No docs/releases/v${version}.md${hint}.` };
  const tagged = tags.map((t) => t.trim()).filter(Boolean);
  if (tagged.includes(`v${version}`)) return { version: null, note: `v${version} is tagged already${hint}.` };
  const released = tagged.map(parse).filter(Boolean).sort(compare).at(-1);
  if (released && compare(own, released) <= 0) {
    return { version: null, note: `${version} is not newer than the release v${released.join(".")}.` };
  }
  return { version, note: "" };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [version, dir, tagFile] = process.argv.slice(2);
  if (!version || !dir || !tagFile) {
    console.error("usage: node scripts/release-pick.mjs <version> <notes folder> <tag file>");
    process.exit(2);
  }
  const result = pick(version, fs.readdirSync(dir), fs.readFileSync(tagFile, "utf8").split("\n"));
  if (result.version) console.log(result.version);
  else console.error(result.note);
}
