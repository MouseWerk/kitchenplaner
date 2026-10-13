# End-to-end tests

These tests drive the real desktop app: the debug build with the production UI embedded, started
by `tauri-driver` and controlled through WebDriver (WebdriverIO). Every test starts its own app
with fresh data and checks what a user sees and what lands on disk.

## Running

Linux (also CI):

```
sudo apt-get install webkit2gtk-driver xvfb x11-utils   # plus the Tauri build packages
cargo install tauri-driver --locked
npm ci --prefix e2e
e2e/run.sh                              # builds UI + app, runs every file
e2e/run.sh tests/05-files.test.js       # one file while working (paths relative to e2e/)
```

`run.sh` builds exactly what the tests need (`npm --prefix ui run build`, then
`cargo build -p kitchenplaner --features custom-protocol`) and passes the binary as
`KITCHENPLANER_APP`. Against a build you already have:

```
cd e2e
KITCHENPLANER_APP=../target/debug/kitchenplaner node --test --test-concurrency=1 tests/04-views.test.js
```

The harness starts its own Xvfb on `$DISPLAY` (default `:99`, 2560x1440) when no X server answers
there, and stops it at the end.

Windows: `tauri-driver` drives WebView2 through Microsoft's `msedgedriver.exe`, whose version must
match the installed WebView2 runtime (Settings > Apps, „Microsoft Edge WebView2 Runtime“, or the
registry value `pv` under
`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`).
Download the matching driver from Microsoft (Edge WebDriver downloads), put it on `PATH` or point
`KITCHENPLANER_EDGEDRIVER` at it, then:

```
cargo install tauri-driver --locked
npm ci --prefix e2e
e2e\run.ps1
e2e\run.ps1 tests\05-files.test.js
```

WebView2 updates itself; when the tests stop starting the app („session not created“), fetch the
driver for the new version.

macOS has no WebDriver for WKWebView. Use the container (also handy on Windows without a matching
driver): `e2e/docker/run.sh [files]` builds a Linux image like the CI job and runs the suite in it;
build output and `node_modules` stay in Docker volumes.

Screenshots of failures (and the page HTML) land in `e2e/screenshots/FAIL-*`; CI uploads them as the
artifact `e2e-screenshots`. A few tests also write review shots there (start screen, layouts).

## Test hooks in the app

Native dialogs cannot be driven by WebDriver, and every run needs its own data. Debug builds have
three hooks, all off unless the variable is set and all compiled out of release builds:

- `KITCHENPLANER_DATA_DIR`: the app data folder (recent files) for this run
  (`src-tauri/src/lib.rs`, `data_dir`).
- `KITCHENPLANER_E2E=1`: the shell injects a script (`e2e_hooks` in `src-tauri/src/lib.rs`) that
  sets `window.__KITCHENPLANER_E2E__` and records console errors and warnings in
  `window.__E2E_ERRORS__` / `window.__E2E_WARNINGS__`. With it, `ui/src/lib/platform.ts` opens no
  dialogs: open and save take the path from `window.__E2E_NEXT_PATH__` (none: cancelled), the
  yes/no question takes `window.__E2E_NEXT_ANSWER__` (none: no) and records its text in
  `window.__E2E_ASKED__`. The harness sets these with `app.nextPath(path)` and
  `app.nextAnswer(yes)`.
- WebView storage (settings such as the language) is isolated per run through
  `WEBVIEW2_USER_DATA_FOLDER` (Windows) and the XDG folders (Linux). The tests pin the language to
  German.

## Writing tests

- One file per area in `tests/`, run with `node --test`. `appTest(name, async (app, t) => ...)`
  (`lib/kitchen.js`) starts a fresh app for the test, saves a screenshot on failure, and fails the
  test when the page logged a console error.
- Find elements as a user does: German texts from `ui/src/locales/de.ts`, ARIA roles and labels
  (`aside[aria-label='Katalog']`, `[role=group][aria-label='Ansicht wählen']`), the `data-item`
  ids of the plan. Add a `data-testid` only where nothing visible identifies an element.
- Wait for conditions (`app.waitUntil`, `app.waitToast`, `app.waitFile`), never for time.
- Files go into the test's own folder: `app.file("name.kplan")`.

## Coverage

| File | What |
|---|---|
| 01-start | window title, empty project, plan drawn, no console errors or warnings |
| 02-catalog | catalog click places items (plan `data-item`, inspector, status bar), undo/redo by button and keys |
| 03-inspector | „1.600“ sets 1600 mm; walking through all fields with Tab changes nothing (no undo step) |
| 04-views | layouts by keys 1–4 and buttons; Tab switches Einrichten/Raum (status bar, room tools) |
| 05-files | save as `.kplan` (format, version, items), open again, save to the known path, cancelled dialog |
| 06-exports | plan SVG (mm size), DXF (layer WAENDE, EOF), CSV (BOM, header), 3D PNG (signature) |
| 07-unsaved | the unsaved-changes question on new, open and window close; cancel and discard |
| 08-design | no horizontal overflow at 1000/1440/1920 px in every layout; neutral `:focus-visible` ring |

Not covered yet (features still being built): the G/R operators with typed values and axis locks,
frame selection (left-to-right vs right-to-left), the wall tool (lengths, snapping, closing),
partitions and pass-through hatches, catalog previews, and Cmd+Q on macOS (no WebDriver there).
