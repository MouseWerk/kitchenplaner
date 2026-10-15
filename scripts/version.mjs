// The app's version has one source: `version` under [workspace.package] in Cargo.toml. Every other
// file that carries it (tauri.conf.json, which names the installers, the npm manifests, the
// lockfiles) must say the same; CI fails when one does not, and the release builds only the version
// that is written there.
//
//   node scripts/version.mjs                  # prints the version, exit 1 when the files disagree
//   node scripts/version.mjs --expect 0.2.0   # also exit 1 when the version is not 0.2.0

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The version under [workspace.package] in the text of the workspace Cargo.toml, or null. */
export function cargoWorkspaceVersion(toml) {
  let section = "";
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      section = header[1].trim();
      continue;
    }
    const m = /^version\s*=\s*"([^"]*)"/.exec(line);
    if (m && section === "workspace.package") return m[1];
  }
  return null;
}

/** The versions of the workspace's own packages in the text of Cargo.lock: `{ name: version }`. */
export function cargoLockVersions(lock, names) {
  const found = {};
  for (const block of lock.split(/\r?\n\[\[package\]\]\r?\n/)) {
    const name = /^name = "([^"]*)"/m.exec(block)?.[1];
    const version = /^version = "([^"]*)"/m.exec(block)?.[1];
    if (name && names.includes(name)) found[name] = version ?? null;
  }
  return found;
}

/** Every place the version is written, read from the repository at `root`: `[[file, version]]`. */
export function readVersions(root = ROOT) {
  const text = (p) => fs.readFileSync(path.join(root, p), "utf8");
  const json = (p) => JSON.parse(text(p));
  const list = [["Cargo.toml", cargoWorkspaceVersion(text("Cargo.toml"))]];
  const lock = cargoLockVersions(text("Cargo.lock"), ["kitchen-core", "kitchenplaner"]);
  for (const name of ["kitchen-core", "kitchenplaner"]) list.push([`Cargo.lock (${name})`, lock[name] ?? null]);
  list.push(["src-tauri/tauri.conf.json", json("src-tauri/tauri.conf.json").version ?? null]);
  for (const dir of [".", "ui"]) {
    const pkg = dir === "." ? "package.json" : `${dir}/package.json`;
    const lockfile = dir === "." ? "package-lock.json" : `${dir}/package-lock.json`;
    list.push([pkg, json(pkg).version ?? null]);
    const l = json(lockfile);
    list.push([lockfile, l.version ?? null]);
    list.push([`${lockfile} (packages[""])`, l.packages?.[""]?.version ?? null]);
  }
  return list;
}

/** Problems with the versions (empty when all agree with Cargo.toml and, if given, `expect`). */
export function check(versions, expect) {
  const problems = [];
  const source = versions[0][1];
  if (!source || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(source)) {
    problems.push(`Cargo.toml: [workspace.package] version is ${JSON.stringify(source)}, not MAJOR.MINOR.PATCH`);
    return problems;
  }
  for (const [file, version] of versions.slice(1)) {
    if (version !== source) problems.push(`${file}: ${JSON.stringify(version)}, Cargo.toml says "${source}"`);
  }
  if (expect !== undefined && expect.replace(/^v/, "") !== source) {
    problems.push(`The release is for ${expect}, but Cargo.toml says "${source}": raise the version in every file first`);
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--expect");
  const expect = i >= 0 ? args[i + 1] : undefined;
  if (i >= 0 && !expect) {
    console.error("usage: node scripts/version.mjs [--expect <version>]");
    process.exit(2);
  }
  const versions = readVersions();
  const problems = check(versions, expect);
  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log(versions[0][1]);
}
