# Units of the catalog

Everything that makes one unit (Gerät) lives here: what the catalog offers and how the unit looks
in the floor plan, the elevations and 3D. The plan (`model/plan.ts`), the elevations
(`model/elevation.ts`) and 3D (`three/meshes.ts`) draw the walls, the outline and the body box,
and ask the unit's kind for the rest.

```
kinds/
  types.ts          CatalogEntry, KindDef, Area
  registry.ts       CATALOG, CATEGORIES, catalogEntry(id), kindOf(id), kindDef(kind),
                    placementOf(kind), collides(a, b), wallSnapReach(kind)
  contract.test.ts  what every unit must keep (runs for every entry and variant)
  parts/
    plan.ts         PlanSketch (line, rect, circle, quarter) + hob, controlStrip, upstandLine, frontDoorSwing, cross
    elevation.ts    Front (box, line, circle, doors, drawers, panel, worktop, legsAndUndershelf) + doorCount
    mesh.ts         Parts (box, cyl, rod, bar, roundedBox, plate, lathe, pan, extrude, tube, knob,
                    barHandle, tub, topWithHoles, grid, wireBox, wireCage, slope, chamferCorner,
                    ring) + body, worktop, plinth, foot, doors, castor, openFrame, tap,
                    cookingBody, controlKnobs, ovenWindow, roundBowl, roundedRectOutline,
                    wirePositions, arcPoints, roundSteps; edge radii (TOP_RADIUS, BODY_RADIUS,
                    DOOR_RADIUS, BOWL_RADIUS, GN_RADIUS, LEG_RADIUS)
    flue.ts         the flue outlet of gas variants (flueBox, flueMesh, fluePlan, flueFront,
                    withGasFlue); flueMesh takes a box for an outlet elsewhere (kettle)
    frost.ts        the freezer mark in every view (frostMark, frostFront, frostPlan, FROST_STRIP)
    disc.ts         a tilted disc (discFrame, discOutline): its outline as Parts.bar lays it
    entries.ts      withVariants (an entry whose connection values come from its variants)
    sizes.ts        WORK_HEIGHT, TABLE_WIDTHS, HOOD_ELEVATION, WALL_SHELF_ELEVATION, FLUSH_HEIGHT
  <area>/           cooking, cooling, washing, prep, serving, storage, ventilation, building
    entries.ts      the catalog entries of the area
    <kind>.ts       one KindDef per file: plan, elevation, mesh
    common.ts       helpers only this area shares (optional); what two areas need goes to parts/
    index.ts        export const <area>: Area = { entries, kinds: [...] }
```

Areas and sidebar groups are not the same: `prep` holds the work tables (group `tables`) and
preparation machines (group `prep`), `cooking` only the group `cooking`. A new area is added to
`AREAS` in `registry.ts`, a new group to `CategoryId` in `types.ts`, `CATEGORIES` in
`registry.ts` and the `category.<id>` texts.

## Frames and units

- Catalog sizes are millimetres, whole numbers. `width` runs along the front, `depth` from the
  back (against the wall) to the front (the operating side), `height` up from `elevation`.
- Plan: `PlanSketch` draws in millimetres, x from `L` (-w/2) to `R` (+w/2), y from `B` (back,
  -d/2) to `F` (front, +d/2). The footprint outline is drawn for you.
- Elevation: `Front` draws in millimetres, X from `f.l` to `f.r` (the projected width; use `f.w`
  for counts, not `item.width`), heights above the floor from `f.z0` (the elevation) to `f.top`.
  The body box is drawn for you. `elevation(f)` adds the front details when the front faces the
  viewer; seen from the side or back the default is a line under the top (`elevationSide`).
- 3D: `mesh(p, s, item)` builds in metres, x across the width (centred), z from the back (-d/2)
  to the front (+d/2), y up from 0 (the elevation) to `s.h`. Use only `Parts` and the shared
  materials (`MaterialId` in three/shared.ts): no own geometry, materials or textures. How a
  model should look and which part to use for what: "Model style guide" below.

Shared looks in 3D:

- Wire work (baskets, dish racks, wire shelves, grill grids, guards, whisks) is made of thin rods
  in the `wire` material, never of a wireframe (a wireframe box shows its triangles):
  `p.grid(x0, x1, y0, y1, z0, z1, pitch, along = "z")` for a flat grid (frame and wires along x
  or z), `p.wireBox(x0, x1, y0, y1, z0, z1, pitch, { bottom = true, top = false })` for a basket
  or cage, `p.wireCage(cx, cz, y0, y1, r, wires)` for a round cage, `p.bar(mat, a, b, r)` for a
  rod between two points. Each fills the box (or circle) it is given; `BASKET_PITCH` (20 mm) and
  `SHELF_PITCH` (30 mm) are the usual wire distances. The 3D view merges all rods of an item into
  one draw call.
- Shaped sheet metal: `p.slope(mat, x0, x1, zTop, yTop, run, dir)` for a sheet on a 45° fold
  with `p.chamferCorner` for the side panel's triangle under it (a folded front with a rounded
  bend and a rolled edge is better drawn as one `p.extrude` profile, as the canopy hoods do); a
  round hole in a top is a `Hole` with `r` half its size, `p.ring` lays a turned ring over its
  edge (a wok ring); `roundBowl` is a round bowl pressed into a deck (a hand wash basin).
- Water in basins, bain-marie wells and pans is `water` (light, glossy, see-through); `oil` is
  for fryers and dark drinks only. Food in wells, pans and displays is `foodRed`, `foodGreen`,
  `foodCream` or `foodBrown` (muted), never a steel, panel or hob material.
- Slots, holes and perforations drawn flush on a face (flue outlets, vents, a perforated shelf,
  an overflow) are `slot`: dark, and drawn over the face they lie in. Polished chrome (a chromed
  griddle plate) is `chrome`; `handle` is for handles, index marks and small bright trim.
- Gas variants get the flue outlet (Abgasstutzen) at the back of the top from the registry
  (`withGasFlue` in parts/flue.ts): dark `slot` parts named `flue` in 3D, a crossed rectangle in
  the plan, a hidden outline in the front elevation. A kind does nothing for it; one that draws
  its own outlet sets `flue: false`, places it with `flueMesh(p, s, box)` and must still look
  different from its electric variant.

Every view fills exactly width × depth × height. Only these may stick out, and only declared:
`rise` (mm above the height, for taps), door swings in the plan (arcs, an open leaf with the
`opening` pen) at the front, and a stand below a raised floor unit (`elevationBase`, and in 3D
negative y down to `-item.elevation`).

## Model style guide

The models are read at 1 to 5 m in the 3D view and at 56 × 44 px in the catalog. What makes them
read as real equipment is light on edges, round things turned round, and the right material per
element, not small detail. The reference units are `range-6` (gas and electric), `combi-20`,
`fryer-2`, `sink-2`, `fridge-1400` and `hood-island`; look at them before you build.

### Which part for what

| Part | Use for | Not for |
|---|---|---|
| `p.roundedBox(mat, x0..z1, r, edges, axis)` | bodies, worktops, doors and drawer fronts, panels, control strips, legs (`"vertical"`), upstands (`"top"`), door leaves (`"top"` along `"z"`: rounded at the front, flat at the back) | flush marks on a face |
| `p.plate(mat, x0..z1, r, front)` | windows, displays, glass, switch panels, slots with round ends: thin along z, corners rounded in the face | |
| `p.lathe(mat, x, y, z, profile, { axis, rect })` | anything turned: knobs with skirts, feet, burners and caps, hotplates, bowls, kettles, pots, lamp shades, collars, hinge barrels, tyres (`axis: "x"`); with `rect`, a frame or band with round corners (a glass door frame, a gasket round a leaf) | boxes (use `roundedBox`) |
| `p.pan` / `p.tub(mat, x0..z1, wall, r)` | bowls, tanks, wells, GN containers (`pan` with `rim`): round corners, a cove at the floor, open at the top; the `Hole` it sits in gets the same `r` (the default for both) | a square insert in a hole (`Hole.r: 0`) |
| `p.extrude(mat, axis, a, b, outline, holes)` | profiles along a straight run: a hood's skirt with its fold and rolled edge, kick plates, handle and gasket profiles, rails, a deck with a round hole | turned shapes |
| `p.tube(mat, points, r, { bend })` | taps and spouts, bar handles on stand-offs (`barHandle`), gas and waste pipes, rails with bends, basket handles | straight rods (`rod` is cheaper) |
| `p.box`, `p.cyl`, `p.rod`, `p.bar` | flush marks and slots (`slot`), small hidden or dark parts, straight rods, wires | visible bodies, doors and tops (no edge catches light) |
| `p.grid`, `p.wireBox`, `p.wireCage` | wire work (8-sided wires, merged into one draw call) | |

The shared helpers already use them: `body`, `worktop`, `topWithHoles`, `plinth` and `foot`,
`doors`, `knob`/`controlKnobs`, `barHandle`, `tap`, `tub`, `castor`, `openFrame`, `cookingBody`,
`ovenWindow`, `roundBowl`, `ring`, `flueMesh`, and in the areas `lineModule`, `gasBurners`,
`hotplates`, `coolDoor`, `uprightCarcass`, `bowlDrain`, `tableTop`, `counterBody`. Use them before
building your own.

Profiles for `lathe` are (radius, height) pairs from the bottom of the axis out and up, so the
normals point out of the material; an inside surface (a bowl's) runs back down. A turn of more
than 40° stays a sharp edge, less is smoothed (weighted by the segments' lengths, so a narrow
bevel does not shade a wide face). For an exact round give the points with their normals:
`arcPoints(cr, cy, r, a0, a1, steps)`. A profile that ends where it started is a closed ring
without caps.

### Edge radii

| Element | Radius | Constant |
|---|---|---|
| Worktops, covers, upstands, undershelves | 3 mm | `TOP_RADIUS` |
| Bodies (upright corners), plinths, control strips, panels | 2 mm | `BODY_RADIUS` |
| Door and drawer leaves (front edges) | 2 mm | `DOOR_RADIUS` |
| Insulated doors (refrigeration), cabinet corners | 4 mm | `cooling/common.ts` |
| Pressed housings (combi ovens, ovens, machines) | 8 mm | `combiOven.ts` |
| Square tube legs | 4 mm | `LEG_RADIUS` |
| Cast pan supports (top edges) | 4 mm | `cooking/common.ts` |
| Bowls, tanks, wells and their holes (corners seen from above) | 20 mm | `BOWL_RADIUS` |
| GN containers | 12 mm | `GN_RADIUS` |
| Windows in doors | 12 to 30 mm | `ovenWindow`, `combiOven.ts` |

Below 0.2 mm a radius is not drawn. Rounded parts never touch with flat faces in the same plane:
start what stands on a rounded top inside its edge (`h - TOP_RADIUS`, as `tableTop` does), and
let flush marks stand 0.5 to 2 mm proud of the face they lie on.

### Materials per element

| Element | Material |
|---|---|
| Bodies, doors, tops, sheet work | `steel` (brushed; the grain runs along x on tops and fronts) |
| Kick plates, feet, legs, hinges and inner frames in shadow | `steelDark` |
| Turned and pressed steel without grain (hinge barrels, bezels, strainers) | `satin` |
| Handles, taps, index marks, bright trim | `handle` (polished) |
| Chromed griddle plates | `chrome` |
| Pan supports, burner caps, wok rings of gas units | `castIron` (enamelled) |
| Knobs and plastic grips | `knob` |
| Feet pads, gaskets, tyres, seals round windows | `rubber` |
| Glass ceramic hobs | `ceramic`; zones `zone` |
| Hotplates | `plate` |
| See-through glass | `glass`; tinted oven and display glass `glassDark` |
| Panels, liners, light panels | `panel` (white), `panelDark` (control panels) |
| Painted steel: cold room panels and doors, machine housings | `paintGray` (or `panel` for white) |
| Stone and wood tops (pizza, pastry, butcher block) | `granite`, `wood` |
| Water, oil, food | `water`, `oil`, `foodRed`, `foodGreen`, `foodCream`, `foodBrown` |
| Flush slots, vents, openings | `slot` |

### Budget

A unit at its default size stays within 200 parts and 10 000 triangles (today: median 28 parts
and 2 100 triangles; the fryers and the pasta cooker with their baskets the most, about 190 parts
and 8 400 triangles).
Parts are merged per material, so they cost build time, not draw calls; triangles cost every
frame, twice with shadows. Leave the segments to the parts (lathes 16, 24 or 32 round by size,
tubes 8 to 16, rounds 1 to 4 steps per quarter by radius) and spend detail where it shows: the
front, the top and what the hand touches. Shaped parts are cached by their size and shape, so
equal parts of equal units cost nothing extra.

### Checklist for a unit

1. Bodies, tops, doors and panels are `roundedBox` or `plate` with the radius from the table;
   `box` only for flush, hidden or dark parts.
2. Everything round is turned (`lathe`) or a `tube`: knobs, feet, bowls, burners, pipes, handles.
   No stack of cylinders where one profile does it.
3. Tanks, bowls and wells are `tub`/`pan` with their `Hole` in the top at the same radius.
4. Materials from the table; no steel for rubber, glass or food.
5. Shaped parts are never scaled or reused across items by hand; place them with the extents and
   points the call takes. Everything stays inside width × depth × height (plus the declared
   `rise` and stand).
6. Nothing stands in the plane of another face of a different part (no flicker): offset by 0.5
   to 2 mm, or start inside a rounded edge.
7. Within the budget; the 3D view's frame time with the example kitchen stays where it was
   (`window.__view3d.measure()` in the development build).
8. `npx tsc --noEmit` and `npx vitest run src/kinds src/three` are green; then look at the unit
   from the front, from above and from below in the app and in the catalog thumbnail, in the
   light and the dark theme.

## Placement

`KindDef.placement` says where a unit stands; it decides how the plan draws it, what the plan
check lets it overlap and how it snaps. 3D and the elevations draw every unit the same way.

| Placement | Units | Plan | Collides with | Snapping |
|---|---|---|---|---|
| `floor` (default) | ranges, tables, fridges | solid, filled, first | floor units; blocks doors | back pulled to a wall within 150 mm |
| `flat` | floor drains, drainage channels, platforms (`raised`) | solid, unfilled, over the floor units | nothing | as floor |
| `tableTop` | slicer, table mixer, vacuum packer, scale on a table | solid, filled, over the tables | table-top units | back to a wall only when it touches it |
| `overhead` | hoods, wall shelves, wall basins, heat lamps | dashed, unfilled, on top | overhead units | as floor |

Dashed is the plan's convention for "above the cut": in the elevations an overhead unit is seen
and drawn solid like every other unit.

Units snap flush to neighbours of their own placement and align with every item's edges in the
plan. A `tableTop` or `overhead` unit has an elevation above the floor and its model starts
there; a `flat` one lies at elevation 0 and is set into the floor, at most `FLUSH_HEIGHT` (5 mm)
high, unless its kind is `raised` (a platform); a `floor` unit reaches the floor (on a stand if
raised, `elevationBase`). A platform is `flat` so that what stands on it is no overlap; set the
elevation of those items to the platform's height where it matters.

`structural` units (columns, shafts) draw with the wall pen and fill. `planOutline(w, d)` replaces
the footprint rectangle in the plan with an own outline inside it (the round column's circle);
the plan check keeps the rectangle.

## Adding a unit

1. **Entry** in `kinds/<area>/entries.ts`. The `id` is written into project files: never change or
   reuse one. Give `kind`, `category`, `name` (a `cat.<name>` key), sizes, `elevation` and
   `connections` of the default variant. Optional: `widths` (must include `width`), `energy`
   (`["electric", "gas"]`, the first is the default) with `variantConnections`, `tags` (lower case
   search words in both languages), `description` (a `catDesc.<name>` key).
2. **Kind** (only for a new look): `kinds/<area>/<kind>.ts` exporting a `KindDef`, added to the
   area's `index.ts`. Several entries may share one kind; the kind reads sizes from the item, so
   resized items still look right. Set `placement` when the unit does not stand on the floor
   (see "Placement" below). A new kind name must be unique across all areas.
3. **Texts** in `ui/src/locales/de.ts` and `en.ts`, in the section of your area
   (`// Catalog: <area>`). German with "du", glossary in `docs/i18n.md`.
4. **Run** `npx tsc --noEmit` and `npx vitest run src/kinds` in `ui/`, then look at the unit in the
   app: plan, all four elevations, 3D and the catalog thumbnail.

Example: an electric or gas bratt pan as its own kind.

```ts
// kinds/cooking/entries.ts
{ id: "bratt-pan-80", kind: "brattPan", category: "cooking", name: "cat.brattPan80",
  width: 800, depth: 900, height: WORK_HEIGHT, elevation: 0, widths: [800, 1200],
  energy: ["electric", "gas"], tags: ["bräter", "pfanne", "pan"],
  connections: { electricKw: 10, voltage: 400 },
  variantConnections: ({ width, energy }) =>
    energy === "gas" ? { gasKw: (width / 800) * 14, electricKw: 0.1, voltage: 230 } : { electricKw: (width / 800) * 10, voltage: 400 } },

// kinds/cooking/brattPan.ts
export const brattPan: KindDef = {
  kind: "brattPan",
  plan(s) {
    s.rect("detail", s.L + INSET, s.B + INSET, s.R - INSET, s.F - CONTROL_STRIP);
    controlStrip(s);
  },
  elevation(f) {
    applianceFront(f, 2);
  },
  mesh(p, s, item) {
    cookingBody(p, s, item.energy === "gas" ? "steelDark" : "steel", false, [], 2);
  },
};
```

## What the contract test checks

`contract.test.ts` runs for every entry, and for every variant (each width step × each energy):

- the entry's kind exists, ids and kinds are unique, every kind is used, the category is known;
- name (and description) exist in German and English; tags are lower case;
- sizes are whole millimetres, `widths` include `width`, overhead and table-top units have an
  elevation above the floor, flat units lie at elevation 0 and, unless `raised`, at most
  `FLUSH_HEIGHT` high;
- energies are known; `variantConnections` gives `connections` for the default variant;
  connection values are finite and not negative, electric power has a voltage, a gas variant has
  `gasKw`, an electric variant `electricKw` and no gas;
- the plan symbol and a `planOutline` lie inside the footprint (door swings at the front up to
  the unit's width) and every shape carries the item id;
- the elevation shapes (front, side and stand) lie within the projected width, between the floor
  (with a stand) or the elevation and the top plus `rise`, and carry the item id;
- the 3D model's bounding box is width × depth × height at the elevation (up to `rise` above),
  overhead, table-top and flat units start at their elevation, floor units reach the floor;
- the model and the plan symbol turn with the item: at 90 degrees the front faces west, and
  every part is the unturned part turned (nothing depends on the rotation);
- every mesh carries `userData.itemId` and uses only the shared geometry (the unit box and
  cylinders or a cached shaped part, never scaled) and materials, none of them a wireframe;
- a gas variant has the `flue` parts and an electric one none (unless the kind has `flue: false`),
  and every energy variant of an entry looks different in 3D from the default one;
- an item of the entry survives saving and opening the project unchanged;
- the thumbnail framing (`fitOrthoCamera`) fits the model, centred, with a margin.

Never loosen the test for a unit: declare what the unit needs (`rise`, `elevationBase`) or fix the
unit.
