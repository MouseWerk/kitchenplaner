// The automatic release's choice of version (scripts/release-pick.mjs): node --test "scripts/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pick, parse } from "./release-pick.mjs";

const TAGS = ["v0.1.0", "v0.2.0", "v0.2.1", "nightly-1"];
const NOTES = ["v0.1.0.md", "v0.2.0.md", "v0.2.1.md", ".gitkeep", "README.md"];
const version = (...a) => pick(...a).version;

test("the app's version is released when its notes exist and it is newer than every tag", () => {
  assert.equal(version("0.3.0", [...NOTES, "v0.3.0.md"], TAGS), "0.3.0");
  assert.equal(version("0.2.2", [...NOTES, "v0.2.2.md"], TAGS), "0.2.2");
  // Numbers compare as numbers, not as text.
  assert.equal(version("0.10.0", ["v0.9.0.md", "v0.10.0.md"], ["v0.9.0"]), "0.10.0");
});

test("the first release: no tags at all", () => {
  assert.equal(version("0.1.0", [".gitkeep", "v0.1.0.md"], []), "0.1.0");
  assert.equal(version("0.1.0", ["v0.1.0.md"], [""]), "0.1.0", "an empty line from an empty tag list");
  assert.equal(version("0.1.0", [".gitkeep"], []), null, "no notes yet");
});

test("nothing is released twice, backwards or without notes", () => {
  assert.equal(version("0.2.1", NOTES, TAGS), null, "tagged already");
  assert.equal(version("0.3.0", NOTES, TAGS), null, "no notes for the app's version");
  // Lower than the newest tag (a tag pushed by hand, or the version went back).
  assert.equal(version("0.1.5", [...NOTES, "v0.1.5.md"], TAGS), null);
  // Its tag exists although older tags are missing from the list.
  assert.equal(version("1.0.0", ["v1.0.0.md"], ["v1.0.0"]), null);
  // Notes for a newer version than the app's do not release anything, and say why.
  const ahead = pick("0.2.1", [...NOTES, "v0.3.0.md"], TAGS);
  assert.equal(ahead.version, null);
  assert.match(ahead.note, /v0\.3\.0\.md is newer than the app's version 0\.2\.1/);
});

test("only plain release versions count", () => {
  assert.deepEqual(parse("v1.2.3"), [1, 2, 3]);
  for (const odd of ["1.2.3", "v1.2", "v1.2.3-rc.1", "v01.2.3", "nightly-1", "v1.2.3.4"]) assert.equal(parse(odd), null, odd);
  assert.equal(version("0.3.0-rc.1", ["v0.3.0-rc.1.md"], TAGS), null);
  assert.equal(version("0.3.0", ["v0.3.0.md"], ["v0.4.0-rc.1", ...TAGS]), "0.3.0", "a pre-release tag is not a release");
});

test("the command line prints the version or nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kitchenplaner-release-pick-"));
  try {
    const notes = path.join(dir, "notes");
    fs.mkdirSync(notes);
    for (const f of [".gitkeep", "v0.1.0.md"]) fs.writeFileSync(path.join(notes, f), "x");
    const tags = path.join(dir, "tags.txt");
    fs.writeFileSync(tags, "");
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "release-pick.mjs");
    const run = () => execFileSync(process.execPath, [script, "0.1.0", notes, tags], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(run(), "0.1.0\n");
    fs.appendFileSync(tags, "v0.1.0\n");
    assert.equal(run(), "");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
