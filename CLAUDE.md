# Working on Kitchenplaner

Kitchenplaner is a desktop app for planning professional (commercial, gastro) kitchens: a 2D floor
plan, four elevations and a 3D view, an equipment list with connection values, a plan check, and
exports as SVG, DXF, PNG, CSV and the project file (`.kplan`, JSON). Stack: Tauri 2 shell
(`src-tauri/`), a small Rust core for file IO (`crates/kitchen-core/`), and the UI in React 19 +
TypeScript + Vite (`ui/`, three.js for 3D, zustand store with undo). Read `docs/ARCHITECTURE.md`
and `README.md` first. Follow https://github.com/mauricekleindienst/AICodeGuidelines (read its
CLAUDE.md first); this file wins where it is more specific.

## Owner decisions (standing)

- Commits are authored as `Maurice Kleindienst <kleindiema@gmail.com>`:
  `git -c user.name="Maurice Kleindienst" -c user.email=kleindiema@gmail.com commit ...`.
  No co-author or session trailers, no assistant or model names in commits, code, comments or docs.
- No pull requests unless asked. No force push, branch deletion or history rewrite without an
  explicit request.
- No paid code signing. macOS builds are ad-hoc signed (`signingIdentity: "-"`), Windows builds are
  unsigned. Open, not decided by the owner yet: Microsoft Store/winget builds and an in-app updater
  (Arcalo has both); ask before adding either.
- UI language German with "du" (default) and English; „Computer“, not „Rechner“; ellipsis directly
  after the word („Speichern…“). Glossary: `docs/i18n.md`.
- Editing works in modes like Blender (2026-10-12): Tab switches „Einrichten“ (arrange equipment,
  object mode) and „Raum“ (edit corners, walls, partitions, openings; edit mode). Modal operators:
  G move, R rotate, X/Y lock an axis, typed numbers give exact values, Enter or click confirms,
  Escape or right click cancels; Shift+D duplicates, A selects all, frame selection by dragging
  (left to right: fully inside, right to left: touching).
- Room drawing: a CAD-like wall tool (click wall by wall, type lengths, 90°/45° snapping, snap to
  corners, closing on the start point), partitions inside the room, and pass-through hatches
  (Durchreiche) as their own opening kind. Snapping shows guide lines.
- The catalog shows a 3D preview of every entry. End-to-end tests drive the real app.
- All lengths in the model and the files are millimetres (integers where possible); the UI formats
  them for display.
- The project file is `.kplan`: UTF-8 JSON with `"format": "kitchenplaner"` and a numeric
  `"version"`. The UI owns its schema and migrations; the Rust core only checks that envelope, the
  size limit (50 MB) and UTF-8, and writes every file atomically (temp file, fsync, rename).
- Secrets only in the environment's secret settings (none are needed today).

## Code rules

- Match the surrounding style and comment density. Comment why, not what. No emojis anywhere.
- UI texts go through the i18n catalogs (`ui/src/locales`); German and English stay complete.
- Use the design tokens; no one-off colors or sizes.
- No accent-colored borders, outlines, left bars, glows or gradient borders for selected, active or
  current states; quiet neutral tint and text weight instead. Focus visible only on `:focus-visible`,
  neutral. No colored bars on the left anywhere.
- File IO only through the app commands in `src-tauri/src/lib.rs` (no fs plugin). Command errors
  reach the UI as `{ kind, path, detail }` (kinds in `crates/kitchen-core/src/error.rs`); the UI
  maps `kind` to its i18n key in `ui/src/lib/errors.ts`. Commands accept only absolute paths with
  the expected extensions (kplan, svg, dxf, csv, png).
- CSP is strict (`src-tauri/tauri.conf.json`): no remote origins, no inline scripts; images may be
  `blob:` and `data:`.
- Release notes: `docs/releases/v<version>.md` with "## Improved", "## Fixed" and
  "## Checklist for Windows (manual)"; user-facing lines only.

## Checks

```
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm --prefix ui run typecheck
npm --prefix ui test
npm --prefix ui run build
node scripts/version.mjs            # one version in every manifest
node --test "scripts/*.test.mjs"    # release scripts
npm run build            # installers in target/release/bundle
e2e/run.sh               # end-to-end tests, Linux (builds UI + debug app, Xvfb, tauri-driver)
e2e/run.sh tests/05-files.test.js   # one file while working
e2e\run.ps1              # Windows (needs msedgedriver matching WebView2, see e2e/README.md)
e2e/docker/run.sh        # the Linux suite in Docker (macOS, or Windows without msedgedriver)
```

`tauri::generate_context!` needs `ui/dist` to exist: build the UI first (or create a placeholder
`ui/dist/index.html`, it is gitignored) before clippy or cargo build.

Never kill processes by name or pattern; kill only PIDs you started. Prefer root-cause fixes; never
skip or weaken a test.

## Release

Releases are automatic (`docs/release/automatic.md`). The version lives in `[workspace.package]` of
`Cargo.toml`; `src-tauri/tauri.conf.json`, both `package.json`, both `package-lock.json` and
`Cargo.lock` must match (`node scripts/version.mjs`, checked in CI). To release: raise the version
everywhere, write `docs/releases/v<version>.md`, push to main. When CI is green on main's head,
„Auto release“ tags `v<version>` and runs `release.yml`: Windows, Linux and macOS builds, a draft
"Kitchenplaner v<version>" with every file, a check of the expected files, then it publishes. The
repository variable `AUTO_RELEASE=false` switches it off; Actions -> Release -> Run workflow
releases by hand or rebuilds a failed release. Never push notes for a version before it is meant to
go out. After the release, run the notes' Windows checklist.
