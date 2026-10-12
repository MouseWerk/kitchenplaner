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
  unsigned. No updater, tray, store build or keyring.
- UI language German with "du" (default) and English; „Computer“, not „Rechner“; ellipsis directly
  after the word („Speichern…“). Glossary: `docs/i18n.md`.
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
  reach the UI as `{ kind: "tooLarge" | "notUtf8" | "notProject" | "io", message }`; the UI maps
  `kind` to its i18n key.
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
npm run build            # installers in target/release/bundle
```

`tauri::generate_context!` needs `ui/dist` to exist: build the UI first (or create a placeholder
`ui/dist/index.html`, it is gitignored) before clippy or cargo build.

Never kill processes by name or pattern; kill only PIDs you started. Prefer root-cause fixes; never
skip or weaken a test.

## Release

Push to main and wait for CI green (UI, Rust on all three systems, bundles). Write
`docs/releases/v<version>.md`, then run the Release workflow (Actions -> Release -> Run workflow)
with the version. It builds Windows, Linux and macOS and creates a draft release
"Kitchenplaner v<version>"; check the assets and publish the draft by hand.
