// One version in every file (scripts/version.mjs): node --test "scripts/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { cargoLockVersions, cargoWorkspaceVersion, check, readVersions } from "./version.mjs";

test("the workspace version is read from [workspace.package] only", () => {
  const toml = [
    "[workspace]",
    'members = ["a"]',
    "",
    "[workspace.dependencies]",
    'serde = { version = "1" }',
    'version = "9.9.9"',
    "",
    "[workspace.package]",
    'version = "0.4.2"',
    'edition = "2024"',
  ].join("\r\n");
  assert.equal(cargoWorkspaceVersion(toml), "0.4.2");
  assert.equal(cargoWorkspaceVersion('[package]\nversion = "1.0.0"\n'), null);
});

test("Cargo.lock: the versions of the named packages", () => {
  const lock = ['version = 4', "", "[[package]]", 'name = "serde"', 'version = "1.0.0"', "", "[[package]]", 'name = "kitchenplaner"', 'version = "0.4.2"', "dependencies = []"].join("\n");
  assert.deepEqual(cargoLockVersions(lock, ["kitchenplaner", "kitchen-core"]), { kitchenplaner: "0.4.2" });
});

test("every file must say what Cargo.toml says", () => {
  const ok = [["Cargo.toml", "0.4.2"], ["src-tauri/tauri.conf.json", "0.4.2"], ["ui/package.json", "0.4.2"]];
  assert.deepEqual(check(ok), []);
  assert.deepEqual(check(ok, "0.4.2"), []);
  assert.deepEqual(check(ok, "v0.4.2"), []);
  assert.equal(check(ok, "0.5.0").length, 1);
  const off = [["Cargo.toml", "0.4.2"], ["ui/package.json", "0.4.1"], ["package.json", null]];
  const problems = check(off);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /^ui\/package\.json: "0\.4\.1", Cargo\.toml says "0\.4\.2"/);
  assert.equal(check([["Cargo.toml", "0.4"]]).length, 1, "not MAJOR.MINOR.PATCH");
  assert.equal(check([["Cargo.toml", null]]).length, 1, "no version");
});

test("this repository's versions agree", () => {
  assert.deepEqual(check(readVersions()), []);
});
