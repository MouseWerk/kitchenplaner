// Placing units from the catalogue: by keyboard (search, Tab to the list, arrows, Enter) and by
// dragging an entry into the plan, where it lands at the drop point on the grid, or with its back
// against a wall it was dropped close to.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, CATALOG, dropFromCatalog, germanNumber, inspectorName, planOnly, planToScreen, pressed, waitItemCount } from "../lib/kitchen.js";

const num = async (app, label) => germanNumber(await app.fieldValue(label));

/** The catalogue row with the keyboard focus: its name, or null. */
const focusedRow = (app) => app.exec(() => document.activeElement?.closest(".cat-row")?.querySelector(".cat-name")?.textContent.trim() ?? null);

appTest("the keyboard finds an entry, walks the list with the arrows and places it with Enter", async (app) => {
  const rows = () => app.exec((sel) => document.querySelectorAll(`${sel} .cat-row`).length, CATALOG);
  const all = await rows();
  const search = await app.$(`${CATALOG} input[type=search]`);
  await search.click();
  await app.type("Arbeitstisch");
  await app.waitUntil(async () => {
    const n = await rows();
    return n >= 2 && n < all;
  }, "the search did not narrow the list to the tables");
  const names = await app.exec((sel) => [...document.querySelectorAll(`${sel} .cat-row .cat-name`)].map((e) => e.textContent.trim()), CATALOG);
  assert.notEqual(names[0], names[1], "two entries of the same name");

  // Tab leaves the field (past its clear button and the group heading) for the list: one tab stop.
  for (let i = 0; i < 6 && (await focusedRow(app)) === null; i++) await app.keys(Key.Tab);
  assert.equal(await focusedRow(app), names[0], "Tab did not reach the first entry");
  await app.keys(Key.ArrowDown);
  await app.waitUntil(async () => (await focusedRow(app)) === names[1], "Down did not move to the second entry");
  await app.keys(Key.ArrowUp);
  await app.waitUntil(async () => (await focusedRow(app)) === names[0], "Up did not move back");
  await app.keys(Key.ArrowDown);
  await app.waitUntil(async () => (await focusedRow(app)) === names[1], "Down did not move to the second entry again");
  // Nothing was placed or nudged on the way.
  await waitItemCount(app, 0);

  await app.keys(Key.Enter);
  await waitItemCount(app, 1);
  await app.waitUntil(async () => (await inspectorName(app)) === names[1], `the placed item is „${await inspectorName(app)}“, expected „${names[1]}“`);
  // The focus stays in the list: Enter again places another one.
  assert.equal(await focusedRow(app), names[1]);
  await app.keys(Key.Enter);
  await waitItemCount(app, 2);
});

appTest("an entry dragged into the plan lands at the drop point, or against the wall it was dropped near", async (app) => {
  await planOnly(app);

  // In the open room: the centre on the 50 mm grid where it was dropped.
  const middle = await dropFromCatalog(app, "Arbeitstisch frei stehend", await planToScreen(app, { x: 4000, y: 3000 }));
  assert.deepEqual(middle, { accepted: true, dropped: true });
  await waitItemCount(app, 1);
  await app.waitUntil(async () => /Arbeitstisch frei stehend/.test((await inspectorName(app)) ?? ""), "the dropped table is not selected");
  assert.equal(await num(app, "X"), 4000);
  assert.equal(await num(app, "Y"), 3000);
  assert.equal(await num(app, "Drehung"), 0);

  // Dropped in Raum, 100 mm in front of the north wall: the drop switches to Einrichten, and the
  // table stands with its back on the wall (700 mm deep: its centre 350 mm from the wall).
  await app.click("Raum", "header [role=group][aria-label='Modus']");
  await app.waitUntil(async () => (await pressed(app, "Modus")) === "Raum", "the mode did not switch to Raum");
  const wall = await dropFromCatalog(app, "Arbeitstisch an der Wand", await planToScreen(app, { x: 2000, y: 450 }));
  assert.deepEqual(wall, { accepted: true, dropped: true });
  await waitItemCount(app, 2);
  await app.waitUntil(async () => (await pressed(app, "Modus")) === "Einrichten", "the drop did not switch to Einrichten");
  await app.waitUntil(async () => /Arbeitstisch an der Wand/.test((await inspectorName(app)) ?? ""), "the dropped wall table is not selected");
  assert.equal(await num(app, "X"), 2000);
  assert.equal(await num(app, "Y"), 350);
  assert.equal(await num(app, "Drehung"), 0);

  // One undo step per drop.
  await app.click("Rückgängig", "header");
  await waitItemCount(app, 1);
});
