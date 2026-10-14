import assert from "node:assert/strict";
import { appTest, INSPECTOR, place, setField } from "../lib/kitchen.js";
import { Key } from "../lib/harness.js";

/** The standard width chips of the selected item: the pressed one is its width. */
const pressedWidth = (app) => app.exec((sel) => document.querySelector(`${sel} [role=group][aria-label='Standardbreiten'] [aria-pressed=true]`)?.innerText.trim() ?? null, INSPECTOR);

appTest("a width typed with German digit grouping („1.600“) sets 1600 mm", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  assert.equal(await app.fieldValue("Breite"), "1.200");
  assert.equal(await pressedWidth(app), "1200");
  await setField(app, "Breite", "1.600");
  await app.waitUntil(async () => (await pressedWidth(app)) === "1600", `the item is not 1600 mm wide (chip: ${await pressedWidth(app)})`);
  assert.equal(await app.fieldValue("Breite"), "1.600");
  await setField(app, "Tiefe", "750");
  await app.waitUntil(async () => (await app.fieldValue("Tiefe")) === "750", "depth did not change to 750");
  // One undo step per change: undo brings back the depth, then the width.
  await app.click("Rückgängig", "header");
  await app.waitUntil(async () => (await app.fieldValue("Tiefe")) === "700", "undo did not restore the depth");
  assert.equal(await app.fieldValue("Breite"), "1.600");
});

appTest("focusing and leaving the fields changes nothing", async (app) => {
  await place(app, "Herd, 4 Kochstellen, Backofen");
  const values = () =>
    app.exec((sel) => [...document.querySelectorAll(`${sel} input:not([type=checkbox]), ${sel} select, ${sel} textarea`)].map((e) => e.value), INSPECTOR);
  const before = await values();
  assert.ok(before.length >= 8, `expected the item's fields, got ${before.length}`);

  // Walk through every field with the keyboard (each one selects its text on focus) up to the
  // last one, the note, then leave it.
  const first = await app.field("Bezeichnung");
  const last = await app.field("Bemerkung");
  await first.click();
  for (let i = 0; i < 40 && !(await app.exec((e) => document.activeElement === e, last)); i++) await app.keys(Key.Tab);
  assert.ok(await app.exec((e) => document.activeElement === e, last), "Tab did not reach the note field");
  await app.blur();
  assert.deepEqual(await values(), before);
  // No change was recorded: one undo removes the placement itself.
  await app.click("Rückgängig", "header");
  await app.waitUntil(async () => (await app.planItems()).length === 0, "undo did not remove the item: focusing a field recorded a change");
});
