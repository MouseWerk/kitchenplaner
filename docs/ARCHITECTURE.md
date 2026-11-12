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
   - DXF export (`render/dxf.ts` on the writer `render/dxfWriter.ts`, no dependency): AutoCAD
     2000 (AC1015) in millimetres with handles, owners, block records and layouts, so CAD
     programs open it without repair. Each unit becomes a reference to a block (one per catalog
     variant and drawn size, units that look alike share it), in the plan at its centre and
     turned with it, in an elevation at its lower left corner; position, name, size, product and
     connection values ride along as invisible attributes. Layers by trade: walls, openings,
     equipment (hanging units on their own, dashed), details, labels (position numbers, names,
     leaders), dimensions, frame, and one layer per connection trade (electric, gas, water,
     drain, exhaust) for the attributes. Dimensions stay lines and text, cut walls SOLID
     triangles, both as on screen; `render/testDxf.ts` checks the structure in the tests;
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
  picking (`itemIdOf`). `shared.ts`: the unit box and cylinders, the shaped parts cached by
  their parameters, and the fixed materials every model shares, held by each renderer
  (`retainShared` / `releaseShared`). `shapes.ts`: the shaped parts' geometry (rounded boxes,
  lathes, rounded-rectangle pans, extrusions, bent tubes) at real size with UVs in metres.
- `merge.ts`: merges a model into one mesh per material to keep the draw calls low.
- `batch.ts`: draws the merged models' opaque parts as one `BatchedMesh` per material (one
  multi-draw call for all items of that material); items of the same model (`modelKey`) share
  one geometry, a move writes the instance matrix. Each item's own merged group stays in the
  scene with those meshes hidden, for picking, boxes and outlines; selected items are drawn by
  their own meshes (the highlight changes their material), glass and water always are.
- `stress.ts`: stress projects of any size from the catalog for `scripts/bench-3d.mjs`, which
  measures frame time, draw calls and pixel equality of the batches in Chromium, and the
  catalog thumbnails on a first and a second start of a production build.
- `look.ts`: room textures (tiled floor, painted walls) and soft contact shadows under the items;
  `textures.ts` generates the procedural textures (brushed steel, granite, wood, tiles, paint) as pixel data.
- `room.ts`: floor, walls with their openings and the partitions as 3D objects; walls between
  camera and room are hidden (cutaway).
- `navigation.ts`: camera math and the key mapping (numpad views, framing), free of the DOM.
- `walk.ts`: walk mode, a person at eye height moving through the kitchen.
- `drag.ts`: moving items by dragging in 3D with the plan's snapping.
- `thumbnails.ts`: the catalog previews, rendered from the same models in idle slices with a
  time budget, only for the rows near the visible part of the list; a new renderer compiles its
  shaders off the main thread first (`compileAsync`). `thumbStore.ts` keeps the images across
  sessions in IndexedDB, keyed by the build (the hashed chunk URL; development builds keep none),
  shown as `blob:` URLs: a second start renders none.

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
  | `update_download` | `onProgress: Channel` (bytes downloaded, total) | nothing; downloads the found update and checks its signature |
  | `update_install` | none | nothing; installs the downloaded update and restarts into the new version |

  Errors are `{ kind, path, detail }` with `kind` one of tooLarge, notUtf8, notProject, corrupt
  (a `.kplan` that starts like a JSON object but does not parse), readOnly, inUse, notFound,
  permissionDenied, badExtension, badPath, io; `path` is the file name only and
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

## Plan check (`ui/src/model/checks.ts`, `clearances.ts`, `checkRules.ts`)

`checkProject` runs on every change and lists findings in a fixed order: the layout rules
(outline crossing itself, overlaps, units outside the room or in a partition, partitions outside,
door swing areas, units higher than the room), then the workplace rules of `clearances.ts`. Each
finding names its units (`itemIds`, selected when it is clicked); the workplace findings also give
the measured value against the required one. They are advice for a planner, worded as „measured
… needed …“, never as „norm met“. All thresholds and the lists of units they apply to are
constants in `checkRules.ts`, each with its source:

| Rule | Value | Source |
|---|---|---|
| Movement area in front of a workplace, somewhere along its front with its middle in front of the unit (may reach over neighbours; a dead corner beside the unit does not count) | 1000 deep, 1000 wide | DGUV Regel 110-002 3.2.1.4 („nirgends weniger als 1,00 m“), ASR A1.2 |
| Aisle between two workplaces facing each other | 1200 | DGUV Regel 110-002 3.2.3.1 (traffic route with workplaces). **Unsure:** many planners ask 1500 where both sides work at once |
| Free depth in front of shelving and racks, and the aisle between two of them (facing a workplace, its aisle applies) | 800 | ASR A1.8 (about 0.75 to 1.00 m between storage racks). **Unsure:** the value in that range is ours |
| Function area of a side-hinged door (ovens, cabinets), over the unit's width | leaf width | ASR A1.2 (may overlap the operator's own movement area, 5.1.5) |
| Door folding down (range oven, deck oven, undercounter dishwasher) | 600 | **Unsure:** own value |
| Tilting pan or kettle | 1200 | **Unsure:** usual planning value |
| Roll-in unit (rack trolley; also the floor-standing 20 × GN combi) | 1500 | **Unsure:** usual planning value |
| Hood-type dishwasher | 1000 over its width | movement area |
| Approach to a door or passage, both sides inside the room | 1000 | ASR A1.8 keeps routes to doors free; **unsure:** the depth is ours |
| Hood overhang over cooking units, open sides | 200 | DGUV Regel 110-002 3.2.11.1 (at a lower edge of 2.10 m), VDI 2052. **Unsure:** VDI 2052 asks more for higher hoods; not scaled |
| Hood overhang at the door of a steaming unit (combi, convection oven, steamer, deck oven, smoker) | 400 | DGUV Regel 110-002 3.2.11.1 |
| Hand-wash basin near every production unit, same area (no partition ≥ 2000 mm between), centre to centre | 8000 | Regulation (EC) 852/2004 Annex II (no figure). **Unsure:** own value |

DGUV Regel 110-002 is the former BGR 111; DGUV Regel 110-003 „Branche Küchenbetriebe“ replaced it
in 2019, and its figures are still taken as the state of the art (**unsure** whether 110-003
repeats each of them).

How it measures: the free space in front of a unit is cut into cells along the front at every
obstacle edge (in 50 mm steps on one grid where an obstacle stands turned against it and comes
within the measured depth, its nearest point in each cell found from its outline, not by
clipping); each cell holds the distance to the first floor unit, partition or outer wall. The
movement area is slid along the front as a sliding maximum over the cells. Overhead, table-top and flat units are
no obstacles. A workplace facing back across the gap turns the movement area into an aisle; a
gap is reported once, naming both units. A side of a cooking unit needs only as much overhang as
there is room before a wall or a partition at least 2000 mm high; hoods side by side count as
one, a condensing hood on a combi or convection oven and a downdraft module beside a hob replace
the canopy. Which units are workplaces, need a hood or count as production follows the catalog
areas and groups, with the exceptions listed in `checkRules.ts` (a test keeps every kind named
there in the catalog).

Pallets, crates, trolleys, mobile racks and bins and dispensers on castors are no workplaces
(`NOT_WORKPLACES`): they need no free space of their own but stay obstacles for the others. Water
baths and closed cookers (bain-marie, sous-vide, rice cooker, egg boiler) need no hood
(**unsure**, the ventilation planner decides); units that fry or bake on a plate still do.

Cost: `checkProject` takes about 6 ms for 500 units on a desktop computer, about 7.5 ms when
every second work table stands turned against its neighbours and about 9 ms when all do. Budget
tests ask for less than 20 ms for the first two; run beside the whole parallel test suite both
take about twice as long. Overlaps are only tested for units whose boxes meet (swept along x), the
workplace rules look up obstacles in a 2 m grid.

Adding a unit by click (`freeSpot.ts`) uses `freeSpotTest`, which keeps the same layout rules and
the spot-dependent workplace rules: the new unit's own free space, door approaches, and the free
space of the workplaces around it that is kept now. Hoods and hand-wash basins depend on what is
added, not on where, so a range added without a hood is still reported.

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

## Elevations (`ui/src/model/elevation.ts`)

An elevation is named by an `ElevationId`: a compass view (`"north"` … `"west"`) or a wall view
(`"wall-<i>"`, the wall from corner i to i + 1, the index openings use). A compass view looks at
every wall turned that way across the whole room (both legs of an L-shaped room at once); it is
the familiar default and stays as it was. A wall view looks against one wall's inward normal and
reaches from corner to corner: only that wall's openings, the units whose centre stands in front
of it, the cut walls at its ends as wide as the section plane cuts them (t·√2 next to a 45°
chamfer), its length as the dimension. The cut depth („Schnitttiefe“) is measured from that wall.
For a wall of a rectangular room both kinds draw the same; a slanted wall, which no compass view
sees face-on (`slantedWalls`), is true only in its own view. `standardElevations` (the four plus
each slanted wall) is what „Alle Ansichten als SVG“ prints; the plan set adds single walls by a
rule (none, slanted, every wall), since its options are remembered per computer, not per project.

The choice is view state, not project data: the panes keep it, the store's `facing` holds the one
the single exports use, and the `.kplan` format is unchanged. A wall view follows the wall index,
not the wall: inserting or deleting a corner before it renumbers the walls, and the pane then
shows the wall that now has that index. A wall view whose wall no longer exists (corners deleted,
or a wall shorter than the geometry's tolerance, `elevationExists`) resolves to the north view
where it is drawn (`resolveElevation`), so an undo brings it back. The chooser in each pane head
is one menu („Nord ▾“, „Wand 3 ▾“) with the four compass views and every wall that
`elevationExists` accepts, so it fits a quarter of a narrow window. Names come from
`model/elevationNames.ts`: „Ansicht Wand 5“, and in the chooser „Wand 5 (Nordost, 1.414 mm)“
with the inspector's numbering.

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
