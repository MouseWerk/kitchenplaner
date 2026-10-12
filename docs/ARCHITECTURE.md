# Architecture

Kitchenplaner is a Tauri 2 desktop app. The UI (`ui/`) does all planning, drawing and exporting;
the Rust side (`src-tauri/`, `crates/kitchen-core/`) only opens the window and reads and writes
files. Every layer depends only on the layers above it in this list.

## Layers

1. **Model** (`ui/src/model/`): the project as plain, serialisable data: room, items from the
   catalog, positions and sizes in millimetres, connection values. Pure functions derive
   everything else from it: geometry, the elevations of each wall, the equipment list, the plan
   check. No DOM, no React, no Tauri; unit tested with Vitest.
2. **Drawing primitives** (`ui/src/render/`): the model turned into a flat list of lines, arcs,
   polygons, texts and dimensions in model coordinates (mm), with a semantic style per primitive
   (wall, item outline, hidden edge, dimension) instead of colours.
3. **Outputs** of those primitives, each a thin adapter:
   - the screen (`ui/src/components/DrawingSvg.tsx`, `ui/src/views/`): SVG in the React tree,
     with the viewport transform (pan, zoom) and the selection on top;
   - SVG export: the same primitives as a standalone file;
   - DXF export: the same primitives as DXF entities, one layer per style;
   - PNG export: the SVG rendered into a canvas.
   Because plan, elevations and every export share the primitives, what you see is what you get.
4. **3D** (`ui/src/three/`): three.js meshes built from the model (not from the 2D primitives),
   rebuilt when the model changes.
5. **Store** (`ui/src/store/`): one zustand store holds the project, the selection and the view
   state. Every edit is a command on the project; the store keeps the undo and redo history of
   project states, so undo restores exactly what was there. View state (zoom, open panel) is not
   part of the history.
6. **Platform bridge** (`ui/src/lib/platform.ts`): the only place that talks to Tauri (commands,
   dialogs, window title). In a plain browser (Vite without Tauri) it falls back to browser APIs
   so the UI can be developed and tested without the shell.

## Rust side

- `crates/kitchen-core`: file IO without Tauri, tested headless.
  - `read_project`: rejects files over 50 MB, non-UTF-8 text, and anything that is not a JSON
    object with `"format": "kitchenplaner"` and a numeric `"version"`. The UI validates and
    migrates the rest of the content.
  - `write_atomic`: temp file in the same directory, fsync, rename over the target, so a crash or
    a full disk never leaves a half-written file. A read-only target is refused with a clear
    message.
  - `recent`: the last 10 projects as JSON in the app data directory, deduplicated (case- and
    slash-insensitive on Windows), missing files dropped when listed.
- `src-tauri`: the window, the dialog plugin and these commands:

  | Command | Arguments | Returns |
  |---|---|---|
  | `read_project` | `path: string` | project text |
  | `write_text_file` | `path: string, contents: string` | nothing |
  | `write_binary_file` | `path: string, data: string` (base64) | nothing |
  | `recent_files` | none | `string[]` |
  | `add_recent_file` | `path: string` | nothing |
  | `startup_file` | none | `string \| null`: the `.kplan` the app was started with |

  Errors are `{ kind: "tooLarge" | "notUtf8" | "notProject" | "io", message }`; the UI shows its
  own translated text per `kind` and may add `message` (German, names the file) as detail.
  On macOS a `.kplan` opened while the app runs arrives as the event `open-file` (payload: the
  path); Windows and Linux start a new window with the path as argument.

## Files

A `.kplan` is UTF-8 JSON: `{ "format": "kitchenplaner", "version": <number>, ... }`. Lengths are
millimetres. The version is raised on every incompatible change, and the UI migrates older files
on open.

## Security

Strict CSP (no remote origins, no inline scripts), no fs plugin: the UI can only read project
files and write files through the commands above, with paths the user chose in a dialog.
