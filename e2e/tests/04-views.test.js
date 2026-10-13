import assert from "node:assert/strict";
import { appTest, panes, pressed, pressOnViews } from "../lib/kitchen.js";
import { Key } from "../lib/harness.js";

const ELEVATIONS = ["Ansicht Nord", "Ansicht Ost", "Ansicht Süd", "Ansicht West"];

async function waitPanes(app, check, what) {
  await app.waitUntil(async () => check(await panes(app)), `${what}: panes are ${JSON.stringify(await panes(app))}`);
}

appTest("the keys 1 to 4 switch the layout of the views", async (app) => {
  await pressOnViews(app, "2");
  await waitPanes(app, (p) => JSON.stringify(p) === JSON.stringify(ELEVATIONS), "2 shows the four elevations");
  assert.equal(await pressed(app, "Ansicht wählen"), "Ansichten");

  await pressOnViews(app, "3");
  await waitPanes(app, (p) => JSON.stringify(p) === JSON.stringify(["3D"]), "3 shows the 3D view");
  assert.equal(await pressed(app, "Ansicht wählen"), "3D");

  await pressOnViews(app, "4");
  await waitPanes(app, (p) => p.length === 4 && p.includes("Grundriss") && p.includes("3D"), "4 shows plan, 3D and two elevations");
  assert.equal(await pressed(app, "Ansicht wählen"), "Alle Ansichten");

  await pressOnViews(app, "1");
  await waitPanes(app, (p) => JSON.stringify(p) === JSON.stringify(["Grundriss"]), "1 shows the plan");
  assert.equal(await pressed(app, "Ansicht wählen"), "Grundriss");
});

appTest("the layout buttons switch the views", async (app) => {
  await app.click("Ansichten", "header [role=group][aria-label='Ansicht wählen']");
  await waitPanes(app, (p) => p.length === 4 && p.every((x) => x.startsWith("Ansicht ")), "the elevations button");
  await app.click("Alle Ansichten", "header [role=group][aria-label='Ansicht wählen']");
  await waitPanes(app, (p) => p.length === 4 && p.includes("Grundriss"), "the all-views button");
  await app.click("Grundriss", "header [role=group][aria-label='Ansicht wählen']");
  await waitPanes(app, (p) => p.length === 1 && p[0] === "Grundriss", "the plan button");
});

appTest("Tab switches between Einrichten and Raum, shown in the status bar", async (app) => {
  const modeCell = () => app.exec(() => document.querySelector("footer .mode")?.innerText.trim() ?? document.querySelector("footer")?.innerText ?? "");
  assert.equal(await pressed(app, "Modus"), "Einrichten");
  assert.match(await modeCell(), /Einrichten/);

  await pressOnViews(app, Key.Tab);
  await app.waitUntil(async () => (await pressed(app, "Modus")) === "Raum", "Tab did not switch to Raum");
  await app.waitUntil(async () => /Raum/.test(await modeCell()), `the status bar does not show Raum: „${await modeCell()}“`);
  // The room tools appear with the mode.
  assert.ok(await app.exec(() => !!document.querySelector("header [role=group][aria-label='Werkzeug']")), "no room tools in Raum mode");

  await pressOnViews(app, Key.Tab);
  await app.waitUntil(async () => (await pressed(app, "Modus")) === "Einrichten", "Tab did not switch back to Einrichten");
  await app.waitUntil(async () => /Einrichten/.test(await modeCell()), "the status bar does not show Einrichten");

  // In a text field Tab moves the focus and keeps the mode.
  const name = await app.field("Projekt");
  await name.click();
  await app.keys(Key.Tab);
  assert.equal(await pressed(app, "Modus"), "Einrichten");
});
