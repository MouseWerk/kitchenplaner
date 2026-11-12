// The website shows the latest release (downloads, version, changelog), so it must be built again
// after every release: every workflow that publishes one, or calls one that does, has to start
// .github/workflows/website.yml through workflow_run. Run: node --test "scripts/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../.github/workflows/", import.meta.url));

/** The workflow's `name:` (top level). */
export const workflowName = (yml) => yml.match(/^name:\s*(.+?)\s*$/m)?.[1].replace(/^["']|["']$/g, "") ?? null;

/** Publishes a release itself: a draft made public, or a release created without --draft. */
export const publishesItself = (yml) =>
  /-F\s+draft=false\b/.test(yml) ||
  /\bgh release create\b(?![^\n]*--draft)/.test(yml) ||
  /\bgh release edit\b[^\n]*--draft=false/.test(yml) ||
  /uses:\s*softprops\/action-gh-release/.test(yml);

/** The local reusable workflows a workflow calls (`uses: ./.github/workflows/x.yml`). */
export const calls = (yml) => [...yml.matchAll(/uses:\s*\.\/\.github\/workflows\/([\w.-]+\.ya?ml)/g)].map((m) => m[1]);

/** Can it start on its own, not only as a called workflow? */
export const startsOnItsOwn = (yml) => {
  const on = yml.match(/^on:\s*\n((?:[ \t]+.*\n|\s*\n)*)/m)?.[1] ?? "";
  const triggers = [...on.matchAll(/^ {2}([\w-]+):/gm)].map((m) => m[1]);
  return triggers.some((t) => t !== "workflow_call");
};

/** The workflow names in website.yml's workflow_run trigger. */
export const websiteFollows = (yml) => {
  const list = yml.match(/workflow_run:\s*\n\s+workflows:\s*\[([^\]]*)\]/)?.[1] ?? "";
  return list.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
};

/** The names of the workflows that publish a release, directly or through a called workflow. */
export function publishers(files) {
  const memo = new Map();
  const publishes = (file, seen = new Set()) => {
    if (memo.has(file)) return memo.get(file);
    if (seen.has(file) || !files[file]) return false;
    seen.add(file);
    const r = publishesItself(files[file]) || calls(files[file]).some((c) => publishes(c, seen));
    memo.set(file, r);
    return r;
  };
  return Object.keys(files)
    .filter((f) => publishes(f) && startsOnItsOwn(files[f]))
    .map((f) => workflowName(files[f]));
}

const readAll = () =>
  Object.fromEntries(
    readdirSync(DIR)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => [f, readFileSync(join(DIR, f), "utf8")]),
  );

test("every workflow that publishes a release starts the website build", () => {
  const files = readAll();
  const pubs = publishers(files);
  // The repository releases by hand (Release) and automatically (Auto release).
  assert.ok(pubs.includes("Release"), `publishers: ${pubs.join(", ")}`);
  assert.ok(pubs.includes("Auto release"), `publishers: ${pubs.join(", ")}`);
  const follows = websiteFollows(files["website.yml"]);
  for (const p of pubs) assert.ok(follows.includes(p), `website.yml does not follow "${p}" (workflow_run.workflows: ${follows.join(", ")})`);
});

test("the website deploys only after a successful run", () => {
  const yml = readAll()["website.yml"];
  assert.match(yml, /github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'/);
});

test("a caller of a publishing workflow counts as a publisher; a workflow_call-only one does not", () => {
  const files = {
    "release.yml": "name: Release\non:\n  workflow_call:\n    inputs: {}\njobs:\n  p:\n    steps:\n      - run: gh api -X PATCH x -F draft=false\n",
    "auto.yml": "name: Auto release\non:\n  workflow_run:\n    workflows: [CI]\njobs:\n  r:\n    uses: ./.github/workflows/release.yml\n",
    "ci.yml": "name: CI\non:\n  push:\njobs:\n  t:\n    steps:\n      - run: gh release create v1 --draft\n",
  };
  assert.deepEqual(publishers(files), ["Auto release"]);
  assert.deepEqual(websiteFollows("on:\n  workflow_run:\n    workflows: [Release, \"Auto release\"]\n"), ["Release", "Auto release"]);
});
