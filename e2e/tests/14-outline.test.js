// The room outline drawn with the wall tool like in CAD: typed lengths, directions snapped to the
// axes although the mouse points a little off, the room closed by a click on its first point.
// Then the new room edited in „Raum“: a wall and a corner moved with G, a locked axis and a typed
// distance; deleting every corner is refused.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, clickAt, germanNumber, hover, panelTitle, planOnly, planToScreen, pressed, roomHandles, roomMode, saveAs } from "../lib/kitchen.js";

const TOOLS = "header [role=group][aria-label='Werkzeug']";

/** Points the next wall from the last point drawn towards `dir` (pixels), types its length and sets it. */
async function wall(app, dir, length) {
  const points = await roomHandles(app);
  const last = points[points.length - 1];
  await hover(app, { x: last.x + dir.x, y: last.y + dir.y });
  await app.type(String(length));
  await app.waitUntil(async () => (await app.statusText()).includes(`[${length}]`), `the status bar does not show the typed ${length}: „${await app.statusText()}“`);
  await app.keys(Key.Enter);
  await app.waitUntil(async () => (await roomHandles(app)).length === points.length + 1, `the wall of ${length} mm was not set`);
}

appTest("the wall tool draws a room from typed lengths, snapped to the axes, closed on its start", async (app) => {
  await planOnly(app);
  await roomMode(app);
  await app.click("Umriss zeichnen", TOOLS);
  await app.waitUntil(async () => (await pressed(app, "Werkzeug")) === "Umriss zeichnen", "the outline tool is not active");

  // The first corner inside the old 8 × 6 m room, away from its corners.
  const start = await planToScreen(app, { x: 1000, y: 1000 });
  await clickAt(app, start);
  await app.waitUntil(async () => (await roomHandles(app)).length === 1, "the first point was not set");
  // Each direction is off its axis by a few degrees: the wall still runs along it.
  await wall(app, { x: 120, y: 18 }, 4000);
  await wall(app, { x: -15, y: 120 }, 3000);
  await wall(app, { x: -120, y: -20 }, 4000);

  // Back on the first point: it is marked as the closing target, and a click closes the room.
  const [first] = await roomHandles(app);
  await hover(app, first);
  await app.waitUntil(
    () => app.exec(() => document.querySelector("section[aria-label='Grundriss'] .room-layer rect.room-handle")?.classList.contains("is-hover")),
    "the first point is not offered for closing",
  );
  await clickAt(app, first);
  // Closed: the drawing is gone, the tool stays for another outline; Escape goes back to selecting.
  await app.waitUntil(async () => (await roomHandles(app)).length === 0, "the outline did not close");
  await app.keys(Key.Escape);
  await app.waitUntil(async () => (await pressed(app, "Werkzeug")) === "Auswählen", "Escape did not return to the select tool");

  const doc = await saveAs(app, "Umriss.kplan");
  const pts = doc.room.points;
  assert.equal(pts.length, 4, `expected four corners: ${JSON.stringify(pts)}`);
  const [a, b, c, d] = pts;
  // Exact, axis-parallel walls from the typed lengths, starting on the 50 mm grid.
  assert.deepEqual({ x: b.x - a.x, y: b.y - a.y }, { x: 4000, y: 0 });
  assert.deepEqual({ x: c.x - b.x, y: c.y - b.y }, { x: 0, y: 3000 });
  assert.deepEqual({ x: d.x - c.x, y: d.y - c.y }, { x: -4000, y: 0 });
  assert.deepEqual({ x: a.x - d.x, y: a.y - d.y }, { x: 0, y: -3000 });
  assert.equal(a.x % 50, 0);
  assert.equal(a.y % 50, 0);
  // The old room's door was in a wall that is gone.
  assert.deepEqual(doc.room.openings, []);
});

appTest("in Raum a wall and a corner move with G, a locked axis and a typed distance", async (app) => {
  await planOnly(app);
  await roomMode(app);
  assert.equal(await pressed(app, "Werkzeug"), "Auswählen");
  // The new project's room: 8000 × 6000 mm, corners clockwise from the north-west.
  let h = await roomHandles(app);
  assert.equal(h.length, 4, "the room has no four corner handles");
  const width0 = h[1].x - h[0].x;

  // The east wall (corners 2 and 3), clicked in its middle.
  await clickAt(app, { x: (h[1].x + h[2].x) / 2, y: (h[1].y + h[2].y) / 2 });
  await app.waitUntil(async () => /^Wand 2 .*6\.000 mm/.test((await panelTitle(app)) ?? ""), `the east wall is not selected: „${await panelTitle(app)}“`);
  // The cursor is still over the plan, where G works.
  await app.type("gx500");
  await app.waitUntil(async () => /G\s+X\s+\[500\]/.test(await app.statusText()), `G does not run with X and 500: „${await app.statusText()}“`);
  await app.keys(Key.Enter);
  await app.waitUntil(async () => {
    const now = await roomHandles(app);
    return Math.abs((now[1].x - now[0].x) / width0 - 8500 / 8000) < 0.01;
  }, "the east wall did not move 500 mm east");
  // The wall moved parallel: its own length stays.
  assert.match(await panelTitle(app), /^Wand 2 .*6\.000 mm/);

  // The south-east corner, by its handle: down by 500 mm.
  h = await roomHandles(app);
  await clickAt(app, h[2]);
  await app.waitUntil(async () => (await panelTitle(app)) === "Ecke 3", `corner 3 is not selected: „${await panelTitle(app)}“`);
  assert.equal(germanNumber(await app.fieldValue("X")), 8500);
  assert.equal(germanNumber(await app.fieldValue("Y")), 6000);
  await app.type("gy500");
  await app.keys(Key.Enter);
  await app.waitUntil(async () => germanNumber(await app.fieldValue("Y")) === 6500, `the corner did not move: Y is ${await app.fieldValue("Y")}`);
  assert.equal(germanNumber(await app.fieldValue("X")), 8500, "the Y lock moved X too");

  // Escape in the middle of a grab puts the corner back.
  await app.type("gx700");
  await app.waitUntil(async () => germanNumber(await app.fieldValue("X")) === 9200, "the running grab does not show its move");
  await app.keys(Key.Escape);
  await app.waitUntil(async () => germanNumber(await app.fieldValue("X")) === 8500, "Escape did not cancel the grab");

  // A room needs three corners: deleting all of them is refused and changes nothing.
  await app.keys("a");
  await app.keys(Key.Delete);
  await app.waitToast(/Diese Ecken lassen sich nicht löschen/);
  assert.equal((await roomHandles(app)).length, 4);

  await app.keys(Key.Escape);
  const doc = await saveAs(app, "Raum.kplan");
  assert.deepEqual(doc.room.points, [
    { x: 0, y: 0 },
    { x: 8500, y: 0 },
    { x: 8500, y: 6500 },
    { x: 0, y: 6000 },
  ]);
});
