// The update feed (scripts/update-feed.mjs): node --test "scripts/*.test.mjs"

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeFeed, platformFiles, readPublicKey, verifyFeed, verifySignature } from "./update-feed.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "update-feed.mjs");
const CONF = path.join(ROOT, "src-tauri", "tauri.conf.json");
const VERSION = "0.2.1";
const BASE = `https://github.com/MouseWerk/kitchenplaner/releases/download/v${VERSION}`;

/** A minisign key pair in tauri's format: the public key as base64 of the .pub text, and a signer. */
function keyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const id = crypto.randomBytes(8);
  const pk = publicKey.export({ format: "der", type: "spki" }).subarray(12);
  const pubText = `untrusted comment: minisign public key\n${Buffer.concat([Buffer.from("Ed"), id, pk]).toString("base64")}\n`;
  const sign = (data, name = "file") => {
    const hash = crypto.createHash("blake2b512").update(data).digest();
    const sig = crypto.sign(null, hash, privateKey);
    const trusted = `timestamp:1792000000\tfile:${name}`;
    const global = crypto.sign(null, Buffer.concat([sig, Buffer.from(trusted)]), privateKey);
    const text = `untrusted comment: signature from tauri secret key\n${Buffer.concat([Buffer.from("ED"), id, sig]).toString("base64")}\ntrusted comment: ${trusted}\n${global.toString("base64")}\n`;
    return Buffer.from(text).toString("base64");
  };
  return { pub: Buffer.from(pubText).toString("base64"), sign };
}

const folders = [];
after(() => {
  for (const d of folders) fs.rmSync(d, { recursive: true, force: true });
});

/** A release folder with every signed update file, and a tauri.conf.json with the key. */
function release(keys, { skip = [], withDeb = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitchenplaner-feed-"));
  folders.push(dir);
  const files = new Set(Object.values(platformFiles(VERSION)));
  if (!withDeb) files.delete(`Kitchenplaner_${VERSION}_amd64.deb`);
  for (const f of files) {
    const data = crypto.randomBytes(256);
    fs.writeFileSync(path.join(dir, f), data);
    if (!skip.includes(f)) fs.writeFileSync(path.join(dir, `${f}.sig`), keys.sign(data, f));
  }
  const conf = path.join(dir, "tauri.conf.json");
  fs.writeFileSync(conf, JSON.stringify({ plugins: { updater: { pubkey: keys.pub } } }));
  return { dir, conf };
}

function writeFeed(dir, feed) {
  fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify(feed));
}

test("the feed names every platform's signed file of this release", () => {
  const keys = keyPair();
  const { dir } = release(keys);
  const feed = makeFeed(dir, VERSION, BASE, "## Improved\n- x\n", new Date("2026-10-15T10:00:00Z"));
  assert.equal(feed.version, VERSION);
  assert.equal(feed.pub_date, "2026-10-15T10:00:00.000Z");
  assert.equal(feed.notes, "## Improved\n- x\n");
  assert.deepEqual(Object.keys(feed.platforms).sort(), ["darwin-aarch64", "darwin-x86_64", "linux-x86_64", "linux-x86_64-deb", "windows-x86_64"]);
  assert.equal(feed.platforms["windows-x86_64"].url, `${BASE}/Kitchenplaner_${VERSION}_x64-setup.exe`);
  // One universal app for both Mac architectures.
  assert.equal(feed.platforms["darwin-aarch64"].url, feed.platforms["darwin-x86_64"].url);
  assert.equal(feed.platforms["linux-x86_64"].url, `${BASE}/Kitchenplaner_${VERSION}_amd64.AppImage`);
  assert.equal(feed.platforms["windows-x86_64"].signature, fs.readFileSync(path.join(dir, `Kitchenplaner_${VERSION}_x64-setup.exe.sig`), "utf8"));
});

test("a release without a required signature gets no feed; the .deb entry is optional", () => {
  const keys = keyPair();
  assert.throws(() => makeFeed(release(keys, { skip: [`Kitchenplaner_${VERSION}_x64-setup.exe`] }).dir, VERSION, BASE, ""), /x64-setup\.exe/);
  const feed = makeFeed(release(keys, { withDeb: false }).dir, VERSION, BASE, "");
  assert.equal(feed.platforms["linux-x86_64-deb"], undefined);
  assert.ok(feed.platforms["linux-x86_64"]);
});

test("a feed of signed files on the release verifies", () => {
  const keys = keyPair();
  const { dir, conf } = release(keys);
  writeFeed(dir, makeFeed(dir, VERSION, BASE, ""));
  assert.deepEqual(verifyFeed(dir, conf, VERSION, BASE), []);
  const out = execFileSync(process.execPath, [SCRIPT, "verify", dir, conf, VERSION, BASE], { encoding: "utf8" });
  assert.match(out, /valid signature/);
});

test("verification catches a changed file, another key, a missing file and a wrong URL or version", () => {
  const keys = keyPair();
  const { dir, conf } = release(keys);
  writeFeed(dir, makeFeed(dir, VERSION, BASE, ""));
  const exe = `Kitchenplaner_${VERSION}_x64-setup.exe`;

  fs.writeFileSync(path.join(dir, exe), "changed after signing");
  assert.match(verifyFeed(dir, conf, VERSION, BASE).join("\n"), /windows-x86_64: .*does not match the file/);

  fs.rmSync(path.join(dir, exe));
  assert.match(verifyFeed(dir, conf, VERSION, BASE).join("\n"), /windows-x86_64: .* is not on the release/);

  assert.match(verifyFeed(dir, conf, "0.2.2", BASE).join("\n"), /version is "0\.2\.1", expected 0\.2\.2/);
  assert.match(verifyFeed(dir, conf, VERSION, BASE.replace("v0.2.1", "v0.2.0")).join("\n"), /is not under/);

  // The right files, signed by a key the apps do not trust.
  const other = release(keyPair());
  writeFeed(other.dir, makeFeed(other.dir, VERSION, BASE, ""));
  assert.match(verifyFeed(other.dir, conf, VERSION, BASE).join("\n"), /signed with another key/);

  // A required platform missing from the feed.
  const feed = makeFeed(other.dir, VERSION, BASE, "");
  delete feed.platforms["darwin-x86_64"];
  writeFeed(other.dir, feed);
  assert.match(verifyFeed(other.dir, other.conf, VERSION, BASE).join("\n"), /darwin-x86_64 is missing/);

  assert.throws(() => execFileSync(process.execPath, [SCRIPT, "verify", dir, conf, VERSION, BASE], { stdio: "pipe" }));
});

test("the app's updater config: this repository's feed, passive Windows install, the release key", () => {
  const conf = JSON.parse(fs.readFileSync(CONF, "utf8"));
  const updater = conf.plugins.updater;
  assert.deepEqual(updater.endpoints, ["https://github.com/MouseWerk/kitchenplaner/releases/latest/download/latest.json"]);
  assert.equal(updater.windows.installMode, "passive");
  // Off in the config: CI and local builds have no private key; the release switches it on.
  assert.equal(conf.bundle.createUpdaterArtifacts, false);
  const pub = readPublicKey(updater.pubkey);
  // Signed with the release key (`npx tauri signer sign`): proves the committed public key belongs
  // to the private key the release uses.
  const data = Buffer.from("Kitchenplaner update feed test\n");
  const sig =
    "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVRNHhHOEUwdXU1S0V2TXFVV2lkeWRFRWVLZVNFTlNMaVVwUmNnak5RV2FRTEhoVTdGOEpiRDlyczF0STNnSTBlUnBWNHBWOWM1bDZicjhKY29XcFFkSmZYN1FXMmFaWEFBPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkyMDU0Njc5CWZpbGU6Zml4dHVyZS50eHQKeGgxUks3WnNZelAvWStFWWZ6V3crTWpYdlcxeHVVRk5WWjF0VmtRN2xWK0JsUFRlTmRVaGhTR0o5d05YM2dZR1pBRUc2Sk9GeUVpL1BMZk5EUHMrQlE9PQo=";
  assert.equal(verifySignature(data, sig, pub), null);
  assert.equal(verifySignature(Buffer.from("other"), sig, pub), "the signature does not match the file");
});
