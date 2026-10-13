import assert from "node:assert/strict";
import { appTest, panes, pressed } from "../lib/kitchen.js";

appTest("starts with an empty, unnamed project in the plan and no console errors", async (app) => {
  await app.waitUntil(async () => (await app.browser.getTitle()) === "Unbenanntes Projekt – Kitchenplaner", `window title is „${await app.browser.getTitle()}“`);
  // All views at once: plan, 3D and two elevations.
  assert.deepEqual(await panes(app), ["Grundriss", "3D", "Ansicht Nord", "Ansicht Ost"]);
  assert.equal(await pressed(app, "Ansicht wählen"), "Alle Ansichten");
  assert.equal(await pressed(app, "Modus"), "Einrichten");
  assert.deepEqual(await app.planItems(), []);
  assert.match(await app.statusText(), /(^|\s)0 Geräte(\s|$)/);
  // The room is drawn: the plan pane has an SVG with content.
  const shapes = await app.exec(() => document.querySelectorAll("section[aria-label='Grundriss'] svg path, section[aria-label='Grundriss'] svg line").length);
  assert.ok(shapes > 0, "the plan draws nothing");
  assert.deepEqual(await app.consoleErrors(), []);
  assert.deepEqual(await app.consoleWarnings(), []);
  await app.shot("start");
});
