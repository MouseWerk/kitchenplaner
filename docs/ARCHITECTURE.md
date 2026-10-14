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
   rebuilt when the model changes (see "3D view" below).
5. **Store** (`ui/src/store/`): one zustand store holds the project, the selection and the view
   state. Every edit is a command on the project; the store keeps the undo and redo history of
   project states, so undo restores exactly what was there. View state (zoom, open panel) is not
   part of the history.
6. **Platform bridge** (`ui/src/lib/platform.ts`): the only place that talks to Tauri (commands,
   dialogs, window title). In a plain browser (Vite without Tauri) it falls back to browser APIs
   so the UI can be developed and tested without the shell.

## Units of the catalog (`ui/src/kinds/`)

Each unit of the catalog is described in one place instead of a switch per view. An area
(`kinds/cooking`, `cooling`, `washing`, `prep`, `serving`, `storage`, `ventilation`, `building`)
brings its catalog entries (`entries.ts`) and one `KindDef` per kind of unit (`<kind>.ts`): the
plan symbol, the elevation front and the 3D model, drawn in the item's own frame with the shared
building blocks in `kinds/parts/` (plan, elevation, mesh, entry helpers; whatever two areas
share lives there, the rest in the area's `common.ts`). `kinds/registry.ts` collects the areas
into `CATALOG`, `CATEGORIES` and the lookups `catalogEntry`, `kindOf`, `kindDef` and
`placementOf`; unknown catalog ids (a newer file) draw as a plain table.

Each kind has a placement: `floor` (the default), `tableTop` (stands on a table: slicers, table
mixers), `overhead` (hangs: hoods, wall shelves) or `flat` (in the floor: drains, channels,
platforms). The plan draws them in layers (floor, flat unfilled, table-top, overhead
dashed); in the plan check (`model/checks.ts`) only units of the same placement
collide (`collides`; flat ones never), and only floor units block a door; snapping pulls
a table-top unit's back to a wall only when it touches it (`wallSnapReach`); walking in 3D and
the contact shadows treat only floor units as standing on the floor. A kind may give its own
plan outline (`planOutline`, the round column); the check keeps the footprint rectangle.

`planDrawing`, `elevationDrawing` and `buildItemObject` keep the parts every unit shares (the
footprint outline, the body box, placing and turning the model) and call the unit's kind for the
rest. Catalog entries may offer width steps and energy variants (electric, gas) with connection
values per variant; an item stores its energy. `kinds/contract.test.ts` checks every entry and
variant against the same rules (texts, sizes in every view, rotation, shared materials, file
round trip, thumbnail framing), so a new unit needs no tests of its own. How to add a unit:
`ui/src/kinds/README.md`.

The kinds sit between the model and the outputs: they use the model's geometry and the shared 3D
materials (`three/shared.ts`); the model's plan, elevations and plan check use the registry.

## 3D view (`ui/src/three/`)

- `engine.ts`: renderer, scene, cameras and input of the 3D view. Renders on demand (no loop),
  rebuilds only the items whose object changed, navigation like Blender, editing and walking.
- `meshes.ts`: places and turns the item models (`buildItemObject`), selection highlight and
  picking (`itemIdOf`). `shared.ts`: the unit box and cylinder and the fixed materials every
  model shares, held by each renderer (`retainShared` / `releaseShared`).
- `merge.ts`: merges a model into one mesh per material to keep the draw calls low.
- `look.ts`: room textures (tiled floor, painted walls) and soft contact shadows under the items;
  `textures.ts` generates the procedural textures (brushed steel, tiles, paint) as pixel data.
- `room.ts`: floor, walls with their openings and the partitions as 3D objects; walls between
  camera and room are hidden (cutaway).
- `navigation.ts`: camera math and the key mapping (numpad views, framing), free of the DOM.
- `walk.ts`: walk mode, a person at eye height moving through the kitchen.
- `drag.ts`: moving items by dragging in 3D with the plan's snapping.
- `thumbnails.ts`: the catalog previews, rendered from the same models in idle slices.

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

  Errors are `{ kind, path, detail }` with `kind` one of tooLarge, notUtf8, notProject, readOnly,
  notFound, permissionDenied, badExtension, badPath, io; `path` is the file name only and
  `detail` the OS error text (only for `io`). The UI shows its own translated text per `kind`
  (`ui/src/lib/errors.ts`). Paths must be absolute and carry an allowed extension.
  On macOS a `.kplan` opened while the app runs arrives as the event `open-file` (payload: the
  path); Windows and Linux start a new window with the path as argument.

## Files

A `.kplan` is UTF-8 JSON: `{ "format": "kitchenplaner", "version": <number>, ... }`. Lengths are
millimetres. The version is raised on every incompatible change, and the UI migrates older files
on open.

## Security

Strict CSP (no remote origins, no inline scripts), no fs plugin: the UI can only read project
files and write files through the commands above, with paths the user chose in a dialog.
