// Doors: in the room mode H flips the selected door's hinge side and Shift+H its opening
// direction; the inspector names the hand by DIN and the saved project file holds both.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, INSPECTOR, panes, pressed, pressOnViews } from "../lib/kitchen.js";

appTest("H and Shift+H flip the selected door, the inspector follows, the file keeps it", async (app) => {
  await pressOnViews(app, "1");
  await app.waitUntil(async () => JSON.stringify(await panes(app)) === '["Grundriss"]', "the plan layout did not open");
  await pressOnViews(app, Key.Tab);
  await app.waitUntil(async () => (await pressed(app, "Modus")) === "Raum", "Tab did not switch to Raum");

  // The new project's door, from the inspector's list of openings.
  await app.waitUntil(
    () =>
      app.exec((sel) => {
        const row = [...document.querySelectorAll(`${sel} .list-row`)].find((b) => b.innerText.trim().startsWith("Tür"));
        row?.click();
        return !!row;
      }, INSPECTOR),
    "no door in the inspector's list of openings",
  );
  await app.waitUntil(async () => (await app.fieldValue("Anschlag").catch(() => null)) === "start", "the door panel does not show its hinge side");
  const hand = () => app.exec(() => {
    const l = [...document.querySelectorAll("aside[aria-label='Eigenschaften'] label")].find((x) => x.textContent.trim() === "Anschlag");
    return document.getElementById(l.htmlFor).selectedOptions[0].textContent;
  });
  const before = await hand();

  await pressOnViews(app, "h");
  await app.waitUntil(async () => (await app.fieldValue("Anschlag")) === "end", "H did not flip the hinge side");
  assert.notEqual(await hand(), before, "the DIN hand did not change with the hinge side");
  await pressOnViews(app, [Key.Shift, "h"]);
  await app.waitUntil(async () => (await app.fieldValue("Öffnet")) === "out", "Shift+H did not flip the opening direction");

  await app.nextPath(app.file("Tuer.kplan"));
  await app.menu("Datei", "Speichern unter…");
  const doc = JSON.parse((await app.waitFile("Tuer.kplan")).toString("utf8"));
  const door = doc.room.openings.find((o) => o.kind === "door");
  assert.ok(door, `no door in ${JSON.stringify(doc.room.openings)}`);
  assert.equal(door.hinge, "end");
  assert.equal(door.swing, "out");
});
