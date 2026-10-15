# Automatic release

Kitchenplaner releases itself: after CI passed for a push to `main`, `.github/workflows/auto-release.yml` releases
the app's version when its release notes `docs/releases/v<version>.md` exist and that version has no tag yet. It
calls `.github/workflows/release.yml` (a reusable workflow) with the version and the commit CI tested; the release
workflow tags that commit, builds on three systems, uploads everything to a draft release, checks the files and
then publishes the release. No secrets are needed: the workflows use the job token only.

## One version

The version is written in one place: `version` under `[workspace.package]` in `Cargo.toml`. These files must say
the same, else CI fails (job „Versions and release scripts“, `node scripts/version.mjs`):

- `src-tauri/tauri.conf.json` (it names the installers),
- `package.json` and `ui/package.json`,
- `package-lock.json` and `ui/package-lock.json` (root entries),
- `Cargo.lock` (the packages `kitchenplaner` and `kitchen-core`).

To raise the version: change it in `Cargo.toml`, `src-tauri/tauri.conf.json`, `package.json` and `ui/package.json`,
then run `cargo check` (updates `Cargo.lock`), `npm install --package-lock-only` and
`npm --prefix ui install --package-lock-only` (update the lockfiles), and `node scripts/version.mjs`, which prints
the version when every file agrees.

The release workflow never rewrites versions: it refuses a version that is not the one in the files.

## When it releases

All of these must hold, else the run of „Auto release“ ends with a notice and nothing happens:

- The CI run finished successfully (a failed run, or one cancelled by a newer push, never releases).
- It ran for a **push** to **`main`** of this repository (not a pull request, a fork or another branch).
- The commit it tested is still the head of `main`: a run for an older commit never releases, the run for the
  newest one decides.
- `docs/releases/v<version>.md` exists for the app's version.
- The version is newer than every release tag `v<major>.<minor>.<patch>`, and its own tag does not exist.
  Pre-release names (`v0.2.0-rc.1`) and other tags do not count.
- The repository variable `AUTO_RELEASE` is not `false`.

Release notes for a version newer than the app's (the version was not raised yet) release nothing; the notice
says so. The choice is `scripts/release-pick.mjs`, tested by `scripts/release-pick.test.mjs` (CI runs it).

## What the release does

1. **Tag**: checks the version format, that the files carry this version, that the notes exist and that no
   published release has this tag; creates the annotated tag `v<version>` on the commit, with the notes as its
   message, and pushes it.
2. **Build** (Windows, Linux, macOS at once), from the tag:
   - Windows: `Kitchenplaner_<version>_x64-setup.exe` (NSIS, per user, unsigned)
   - macOS: `Kitchenplaner_<version>_universal.dmg` and `Kitchenplaner_<version>_universal.app.tar.gz` (one app
     for Apple Silicon and Intel, ad-hoc signed, not notarized)
   - Linux: `Kitchenplaner_<version>_amd64.deb` and `Kitchenplaner_<version>_amd64.AppImage`
3. **Publish**: adds the example kitchens `Beispielkueche-Restaurant.kplan` and `Example-Kitchen-Restaurant.kplan`
   and `SHA256SUMS.txt` over all files, creates the draft release „Kitchenplaner v<version>“ with
   `docs/releases/v<version>.md` as its text (or reuses the draft of a failed run and replaces its files), uploads
   every file, then compares the release's files with the expected list, names and sizes. Only when they match
   is the draft published (and marked as the latest release). A missing or extra file leaves the draft unpublished
   and fails the run.

## Never twice

- The runs of „Auto release“ form one queue (never cancelled): a second green run starts after the first one's
  release and finds its tag.
- The release runs one at a time per version (a manual and an automatic run of the same version wait for each
  other).
- Called by the automatic release, `release.yml` refuses an existing tag. A published release is never replaced.
- The tag is pushed with the job token, which starts no other workflow.

## Releasing

1. Raise the version (see „One version“) if it is not raised yet, write `docs/releases/v<version>.md`
   (`## Improved`, `## Fixed`, `## Checklist for Windows (manual)`; user-facing lines only), and push to `main`.
2. CI runs; when it passes, „Auto release“ starts and calls the release (Actions → Auto release; the release is
   the job „Release“ there). It takes as long as the slowest build.
3. Check the release page, then run the Windows checklist from the notes on a real Windows machine.

Do not push the notes of a version before the release is meant to happen: the first green CI after it releases.

## By hand

Actions → Release → Run workflow, with the version (e.g. `0.2.0`). It tags the head of the selected branch, so
start it only on a commit whose CI is green. If the tag exists already, it builds that tag again: this repairs a
release that failed after tagging (a draft from that run is reused; a published release is refused).

## Switching it off

GitHub → Settings → Secrets and variables → Actions → Variables → **New repository variable** `AUTO_RELEASE` with
the value `false`. Deleting the variable (or any other value) switches it on again. While it is off, release by
hand.

## A failed release

The tag exists then, so the automatic release does not try again. Fix the cause and run Actions → Release → Run
workflow with the same version: it builds the existing tag again and reuses the draft. If the fix has to change
the tagged code itself, raise the version and release the next one instead.

## Repository settings it relies on

- Settings → Actions → General: Actions allowed. The workflows ask for `contents: write` themselves where they need
  it (tag and publish); the default token permission can stay „Read repository contents and packages
  permissions“.
- The tag `v*` must not be protected against the job token (no tag ruleset that blocks `github-actions[bot]`).
