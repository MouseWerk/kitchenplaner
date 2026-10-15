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
    mesh.ts         Parts (box, cyl, rod, bar, knob, barHandle, tub, topWithHoles, grid, wireBox,
                    wireCage, slope, chamferCorner, roundOpening, ring) + body, plinth, doors,
                    castor, openFrame, tap, cookingBody, controlKnobs, ovenWindow, roundBowl,
                    wirePositions
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
  materials (`MaterialId` in three/shared.ts): no own geometry, materials or textures.

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
  (a hood's inclined front) with `p.chamferCorner` for the side panel's triangle under it;
  `p.roundOpening(mat, x, z, r, y0, y1)` makes a square hole in a top read round, `p.ring` lays a
  ring of straight bars over its edge (a wok ring); `roundBowl` is a round bowl pressed into a
  deck (a hand wash basin).
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
- every mesh carries `userData.itemId` and uses only the shared geometry and materials, none of
  them a wireframe;
- a gas variant has the `flue` parts and an electric one none (unless the kind has `flue: false`),
  and every energy variant of an entry looks different in 3D from the default one;
- an item of the entry survives saving and opening the project unchanged;
- the thumbnail framing (`fitOrthoCamera`) fits the model, centred, with a margin.

Never loosen the test for a unit: declare what the unit needs (`rise`, `elevationBase`) or fix the
unit.
