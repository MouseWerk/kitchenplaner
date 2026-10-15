# Architecture

Kitchenplaner is a Tauri 2 desktop app. The UI (`ui/`) does all planning, drawing and exporting;
the Rust side (`src-tauri/`, `crates/kitchen-core/`) only opens the window, reads and writes
files, keeps the autosave backups and installs updates. Every layer depends only on the layers above it in this list.

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
   - PNG export: the SVG rendered into a canvas;
   - PDF plan set (`render/planSet.ts` on the small writer `render/pdf.ts`, no dependency): plan,
     elevations, equipment list and an optional 3D image on sheets A4 to A0 at a true scale, each
     with frame and title block. Standard Helvetica in WinAnsiEncoding (no embedded font);
     characters outside it fall back (accents dropped, else "?"). A drawing that does not fit its
     sheet at the chosen scale is refused, never clipped; the dialog offers a scale or paper that
     fits.
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
`placementOf`; unknown catalog ids (a newer file) draw as a plain table. The registry also adds
the flue outlet to every gas variant (`withGasFlue`, `kinds/parts/flue.ts`), so no kind can ship
a gas unit that looks electric.

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
  - `autosave`: backups of unsaved changes (see "Autosave and recovery" below).
- `src-tauri`: the window, the dialog plugin and these commands:

  | Command | Arguments | Returns |
  |---|---|---|
  | `read_project` | `path: string` | project text |
  | `write_text_file` | `path: string, contents: string` | nothing |
  | `write_binary_file` | `path: string, data: string` (base64; PNG, PDF) | nothing |
  | `recent_files` | none | `string[]` |
  | `add_recent_file` | `path: string` | nothing |
  | `startup_file` | none | `string \| null`: the `.kplan` the app was started with |
  | `autosave_write` | `project: string, path: string \| null, name: string` | nothing |
  | `autosave_clear` | none | nothing |
  | `autosave_list` | none | backups of ended sessions, newest first |
  | `autosave_restore` | `id: string` | the backup's text and details |
  | `autosave_discard` | `id: string` | nothing |
  | `update_enabled` | none | `boolean`: this build looks for updates (release builds only) |
  | `update_check` | none | `{ version, manual } \| null`: a newer version, or none |
  | `update_install` | `onProgress: Channel` (bytes downloaded, total) | nothing; restarts into the new version |

  Errors are `{ kind, path, detail }` with `kind` one of tooLarge, notUtf8, notProject, readOnly,
  notFound, permissionDenied, badExtension, badPath, io; `path` is the file name only and
  `detail` the OS error text (only for `io`). The UI shows its own translated text per `kind`
  (`ui/src/lib/errors.ts`). Paths must be absolute and carry an allowed extension.
  On macOS a `.kplan` opened while the app runs arrives as the event `open-file` (payload: the
  path); Windows and Linux start a new window with the path as argument.

## Autosave and recovery

A crash or a power cut loses at most a few seconds of work.

- **When** (`ui/src/lib/autosave.ts`): while the project has unsaved changes, a backup is written
  5 s after the last change, and at the latest 30 s after the first change not yet backed up while
  the editing goes on. Writes and clears run in order through one queue; a write that finds the
  project saved meanwhile does nothing. Saving, a new or opened project (the store's `dirty` going
  false) and closing or quitting without saving remove the backup. A failing backup is shown
  once as an error message, not on every try.
- **Where** (`crates/kitchen-core/src/autosave.rs`, commands in `src-tauri/src/autosave.rs`):
  every running app is a session with a random id, started with the first autosave command. Its
  backup is `autosave/<id>.kplan` plus `<id>.json` (original path or null, project name, time,
  app version) in the app data directory, both written atomically; the size limit is that of
  `read_project`. The session holds `<id>.lock`, locked by the operating system for as long as
  the process lives, so a crash releases it. Another app (started later, or running at the same
  time) offers only backups whose lock is free; a running app's backup is never offered.
  Without file locks a lock file touched in the last 12 hours counts as running.
- **Recovery** (`ui/src/components/RecoveryDialog.tsx`): at start the UI lists the backups; if
  there are any, it asks „Nicht gespeicherte Änderungen wiederherstellen?“ with name, time and
  original file of each. „Wiederherstellen“ moves the backup into the own session (the rename is
  the claim: of two apps only one gets it) and opens it as unsaved, with its original path when
  that file still exists (Ctrl+S saves there), else as a new project. „Verwerfen…“ asks again,
  starting on „Abbrechen“, and deletes it. Escape leaves the decision to the next start. The
  first-start introduction (`components/Intro.tsx`) waits until this question is answered or the
  check found nothing (`onSettled`), so the two dialogs never stack.
- **Cleanup**: listing removes lock files of ended sessions, backups older than 14 days or beyond
  the newest 5, backups that are no project file, and temp files of interrupted writes.
- **Status bar**: while there are unsaved changes and a backup of them exists, a quiet cell says
  „Automatisch gesichert 14:32“; only its time moves on. No message per backup: it would
  interrupt every few seconds, and whoever wonders whether the work is safe finds the answer there.
- **Browser** (Vite without Tauri): the same in `localStorage`; each page load is a session
  holding a Web Lock, so open tabs are told from closed ones.

## Annotations of the plan (`ui/src/model/plan.ts`)

Position numbers and names are laid out for the paper scale the plan is drawn at (the screen, or
the sheet's scale in the PDF and the other exports), since their size is given in paper mm. A
number sits in its unit (towards the front right for table-top and overhead units) and moves to
the nearest free place around it when another number is there, with a leader when it ends up
outside the unit (`labelCentres`). Names (`nameLabels`, „Bezeichnungen im Grundriss“ in the view
settings, and an option of its own in the plan set dialog) come after the numbers: shortened with
an ellipsis to the unit's width (Helvetica widths of `render/pdf.ts`), placed under or above the
number, else elsewhere inside the unit, else right below or above it inside the room and clear of
other units; a name with no free place is left out instead of overlapping. Both are
deterministic, and the tests check the example kitchen at every sheet scale for overlaps.

## Updates

Release builds look for a newer version at start and every four hours and install it on request
(`src-tauri/src/updater.rs`, `ui/src/lib/updates.ts`, `components/UpdateNotice.tsx`); the feed,
its signing and the release side are in [release/automatic.md](release/automatic.md). Debug and
end-to-end builds never check.

## Files

A `.kplan` is UTF-8 JSON: `{ "format": "kitchenplaner", "version": <number>, ... }`. Lengths are
millimetres. The version is raised on every incompatible change, and the UI migrates older files
on open (`ui/src/model/serialize.ts`). Version 3 (0.2) adds the stable position number `pos` of
every item, its product `spec` (manufacturer, model, article, net price), `settings.simultaneity`,
`info.drawingNo` and `info.revision`, sliding doors and a door's hinge, swing and leaves. Older
files get the numbers of their list order and the simultaneity 1, so they show what they showed.

Position numbers are stable: a new, pasted or duplicated item gets one above the highest, and a
deletion renumbers nothing. „Positionen neu nummerieren“ in the project panel counts all items
from 1, clockwise round the room from its top left, as one undo step.

## Security

Strict CSP (no remote origins, no inline scripts), no fs plugin: the UI can only read project
files and write files through the commands above, with paths the user chose in a dialog.
