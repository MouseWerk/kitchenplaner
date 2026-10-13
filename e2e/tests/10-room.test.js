// The room mode: drawing a partition with a typed length, adding a pass-through hatch to it, and
// what the saved project file then holds.

import assert from "node:assert/strict";
import { formatVersion, Key } from "../lib/harness.js";
import { appTest, clickAt, hover, panes, planRect, pressed, pressOnViews } from "../lib/kitchen.js";

appTest("a partition drawn with a typed length is saved with that length, a hatch in it too", async (app) => {
  await pressOnViews(app, "1");
  await app.waitUntil(async () => JSON.stringify(await panes(app)) === '["Grundriss"]', "the plan layout did not open");
  await pressOnViews(app, Key.Tab);
  await app.waitUntil(async () => (await pressed(app, "Modus")) === "Raum", "Tab did not switch to Raum");
  await app.click("Trennwand", "header [role=group][aria-label='Werkzeug']");
  await app.waitUntil(async () => (await pressed(app, "Werkzeug")) === "Trennwand", "the partition tool is not active");

  // Start a bit left of the middle of the room, point to the right, type the length.
  const r = await planRect(app);
  const start = { x: r.cx - r.width * 0.15, y: r.cy };
  await clickAt(app, start);
  await hover(app, { x: start.x + 120, y: start.y });
  await app.type("3000");
  await app.waitUntil(async () => /\[3000\]/.test(await app.statusText()), `the status bar does not show the typed length: „${await app.statusText()}“`);
  await app.keys(Key.Enter);

  // The new partition is selected: the inspector shows its panel with the length.
  await app.waitUntil(async () => (await app.fieldValue("Länge").catch(() => null)) === "3.000", "the inspector does not show a 3000 mm partition");
  await app.click("Durchreiche", "aside[aria-label='Eigenschaften']");

  await app.nextPath(app.file("Trennwand.kplan"));
  await app.menu("Datei", "Speichern unter…");
  const doc = JSON.parse((await app.waitFile("Trennwand.kplan")).toString("utf8"));
  assert.equal(doc.format, "kitchenplaner");
  assert.equal(doc.version, formatVersion());
  assert.equal(doc.room.partitions.length, 1);
  const [w] = doc.room.partitions;
  assert.equal(Math.round(Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)), 3000);
  assert.equal(w.a.y, w.b.y, "the partition is not horizontal");
  const hatch = doc.room.openings.find((o) => o.kind === "hatch");
  assert.ok(hatch, `no hatch in ${JSON.stringify(doc.room.openings)}`);
  assert.equal(hatch.partition, w.id);
});
