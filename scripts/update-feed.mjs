// The update feed `latest.json` the installed apps read (tauri-plugin-updater, the endpoint in
// src-tauri/tauri.conf.json → plugins.updater). The release workflow writes it from the signed
// files (`make`) and checks it against the files on the draft release before publishing (`verify`).
//
//   node scripts/update-feed.mjs make <dist folder> <version> <download base url> <notes file>
//   node scripts/update-feed.mjs verify <folder with latest.json and the files> <tauri.conf.json> <version> <download base url>
//
// The download base is `https://github.com/<owner>/<repo>/releases/download/v<version>`. Signatures
// are minisign (Ed25519 over the BLAKE2b-512 hash of the file), made by `tauri build` with
// TAURI_SIGNING_PRIVATE_KEY; the public key is the one in tauri.conf.json.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Feed keys and the release file each one installs. The universal macOS app serves both
 * architectures. A .deb install looks for `linux-x86_64-deb` first and installs that package
 * (pkexec dpkg -i); without it, it would find the AppImage and fail, so the entry is written
 * whenever the .deb was signed.
 */
export function platformFiles(version) {
  const p = `Kitchenplaner_${version}`;
  return {
    "windows-x86_64": `${p}_x64-setup.exe`,
    "darwin-aarch64": `${p}_universal.app.tar.gz`,
    "darwin-x86_64": `${p}_universal.app.tar.gz`,
    "linux-x86_64": `${p}_amd64.AppImage`,
    "linux-x86_64-deb": `${p}_amd64.deb`,
  };
}

/** Platforms a signed release must carry; the .deb entry is optional. */
export const REQUIRED = ["windows-x86_64", "darwin-aarch64", "darwin-x86_64", "linux-x86_64"];

/**
 * The feed for the signed files in `dir` (`<file>.sig` next to each). Throws when a required
 * platform has no signature: a feed without Windows would leave those apps on the old version
 * without a word.
 */
export function makeFeed(dir, version, base, notes, now = new Date()) {
  const platforms = {};
  const missing = [];
  for (const [platform, file] of Object.entries(platformFiles(version))) {
    const sig = path.join(dir, `${file}.sig`);
    if (fs.existsSync(sig) && fs.existsSync(path.join(dir, file))) {
      platforms[platform] = { signature: fs.readFileSync(sig, "utf8").trim(), url: `${base}/${encodeURIComponent(file)}` };
    } else if (REQUIRED.includes(platform)) {
      missing.push(`${file}(.sig)`);
    }
  }
  if (missing.length) throw new Error(`Signed update files are missing: ${missing.join(", ")}`);
  return { version, notes, pub_date: now.toISOString(), platforms };
}

/** The minisign public key (`.key.pub` content, base64) as key id and Node key object. */
export function readPublicKey(pubkeyBase64) {
  const lines = Buffer.from(pubkeyBase64.trim(), "base64").toString("utf8").split("\n");
  const raw = Buffer.from((lines[1] ?? "").trim(), "base64");
  if (raw.length !== 42 || raw.subarray(0, 2).toString("latin1") !== "Ed") throw new Error("The updater public key is not a minisign Ed25519 key.");
  const key = crypto.createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw.subarray(10)]),
    format: "der",
    type: "spki",
  });
  return { id: raw.subarray(2, 10), key };
}

/** Whether `signature` (the .sig content, base64) is a valid signature of `data` by `pub`. */
export function verifySignature(data, signature, pub) {
  const lines = Buffer.from(signature.trim(), "base64").toString("utf8").split("\n");
  if (lines.length < 4) return "not a minisign signature";
  const sig = Buffer.from(lines[1].trim(), "base64");
  const trusted = lines[2].replace(/^trusted comment: /, "");
  const global = Buffer.from(lines[3].trim(), "base64");
  // "ED": the file's BLAKE2b-512 hash is signed (what tauri writes). The legacy "Ed" is refused.
  if (sig.length !== 74 || sig.subarray(0, 2).toString("latin1") !== "ED") return "unsupported signature algorithm";
  if (!sig.subarray(2, 10).equals(pub.id)) return "signed with another key";
  const hash = crypto.createHash("blake2b512").update(data).digest();
  if (!crypto.verify(null, hash, pub.key, sig.subarray(10))) return "the signature does not match the file";
  if (!crypto.verify(null, Buffer.concat([sig.subarray(10), Buffer.from(trusted)]), pub.key, global)) return "the trusted comment is not signed";
  return null;
}

/**
 * Problems of the feed in `dir` (empty: good): its version, every required platform present,
 * every URL a file of this release under `base` that exists in `dir`, every signature valid for
 * the public key of `tauri.conf.json`.
 */
export function verifyFeed(dir, confFile, version, base) {
  const problems = [];
  let feed;
  try {
    feed = JSON.parse(fs.readFileSync(path.join(dir, "latest.json"), "utf8"));
  } catch (e) {
    return [`latest.json cannot be read: ${e.message}`];
  }
  const conf = JSON.parse(fs.readFileSync(confFile, "utf8"));
  let pub;
  try {
    pub = readPublicKey(conf.plugins?.updater?.pubkey ?? "");
  } catch (e) {
    return [`${confFile}: ${e.message}`];
  }
  if (feed.version !== version) problems.push(`version is ${JSON.stringify(feed.version)}, expected ${version}`);
  if (Number.isNaN(Date.parse(feed.pub_date))) problems.push("pub_date is not a date");
  const platforms = feed.platforms ?? {};
  for (const p of REQUIRED) if (!platforms[p]) problems.push(`${p} is missing`);
  const expected = platformFiles(version);
  for (const [platform, entry] of Object.entries(platforms)) {
    const name = decodeURIComponent(String(entry.url ?? "").split("/").pop());
    if (expected[platform] !== name) problems.push(`${platform}: ${name} is not the file for this platform (${expected[platform] ?? "unknown platform"})`);
    if (entry.url !== `${base}/${encodeURIComponent(name)}`) problems.push(`${platform}: ${entry.url} is not under ${base}`);
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      problems.push(`${platform}: ${name} is not on the release`);
      continue;
    }
    const bad = verifySignature(fs.readFileSync(file), String(entry.signature ?? ""), pub);
    if (bad) problems.push(`${platform}: ${name}: ${bad}`);
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "make" && args.length === 4) {
    const [dir, version, base, notesFile] = args;
    try {
      const feed = makeFeed(dir, version, base, fs.readFileSync(notesFile, "utf8"));
      fs.writeFileSync(path.join(dir, "latest.json"), `${JSON.stringify(feed, null, 2)}\n`);
      console.log(`latest.json: ${Object.keys(feed.platforms).join(", ")}`);
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  } else if (cmd === "verify" && args.length === 4) {
    const problems = verifyFeed(...args);
    for (const p of problems) console.error(`BAD ${p}`);
    if (problems.length) process.exit(1);
    console.log("latest.json: every platform points to a file of this release with a valid signature.");
  } else {
    console.error("usage: node scripts/update-feed.mjs make <dist> <version> <base url> <notes file>\n       node scripts/update-feed.mjs verify <dir> <tauri.conf.json> <version> <base url>");
    process.exit(2);
  }
}
