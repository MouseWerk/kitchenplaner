import assert from "node:assert/strict";
import { appTest, inspectorName, place, pressOnViews, waitItemCount } from "../lib/kitchen.js";
import { Key } from "../lib/harness.js";

appTest("a catalog click places the item in the plan and shows it in the inspector", async (app) => {
  const [id] = await place(app, "Arbeitstisch an der Wand");
  assert.ok(id, "the placed item has no data-item id");
  await waitItemCount(app, 1);
  // The new item is selected: the inspector shows it.
  await app.waitUntil(async () => (await inspectorName(app)) !== null, "the inspector does not show the placed item");
  assert.match(await inspectorName(app), /Arbeitstisch/);
  assert.equal(await app.fieldValue("Breite"), "1.200");
  assert.equal(await app.fieldValue("Tiefe"), "700");

  const ids = await place(app, "Spültisch, 1 Becken");
  assert.equal(ids.length, 2);
  await waitItemCount(app, 2);
  assert.match(await inspectorName(app), /Spültisch/);
  // The title shows the unsaved change.
  await app.waitUntil(async () => (await app.browser.getTitle()).startsWith("* "), "the window title does not mark the change");
});

appTest("undo and redo take placements back and bring them again", async (app) => {
  const undo = await app.button("Rückgängig", "header");
  const redo = await app.button("Wiederholen", "header");
  assert.equal(await undo.isEnabled(), false);
  await place(app, "Arbeitstisch an der Wand");
  const two = await place(app, "Handwaschbecken");

  await app.click("Rückgängig", "header");
  await app.waitUntil(async () => (await app.planItems()).length === 1, "undo did not remove the second item");
  await waitItemCount(app, 1);
  // The shortcut does the same from the views.
  await pressOnViews(app, [Key.Ctrl, "z"]);
  await app.waitUntil(async () => (await app.planItems()).length === 0, "Ctrl+Z did not remove the first item");
  await waitItemCount(app, 0);
  assert.equal(await undo.isEnabled(), false);

  await app.click("Wiederholen", "header");
  await app.waitUntil(async () => (await app.planItems()).length === 1, "redo did not bring the first item back");
  await pressOnViews(app, [Key.Ctrl, Key.Shift, "z"]);
  await app.waitUntil(async () => (await app.planItems()).length === 2, "Ctrl+Shift+Z did not bring the second item back");
  // The same items, not copies.
  assert.deepEqual(await app.planItems(), two);
  assert.equal(await redo.isEnabled(), false);
});
