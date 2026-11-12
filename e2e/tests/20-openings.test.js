// Openings in the outer walls from the inspector: a wall clicked in „Raum“ offers „+ Tür“,
// „+ Fenster“ and „+ Durchreiche“; the new opening sits in the middle of its wall and is selected,
// G with a typed distance slides it along the wall, and the saved file holds all of it.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, clickAt, germanNumber, hover, INSPECTOR, panelTitle, planOnly, planRect, planToScreen, roomMode, saveAs } from "../lib/kitchen.js";

const OFFSET = "Mitte ab Wandanfang";

/** Selects outer wall `n` (1-based, as the inspector counts) by a click on it at plan point `at` (mm). */
async function selectWall(app, n, at) {
  await clickAt(app, await planToScreen(app, at));
  await app.waitUntil(async () => new RegExp(`^Wand ${n} \\(`).test((await panelTitle(app)) ?? ""), `wall ${n} is not selected: „${await panelTitle(app)}“`);
}

/** Adds an opening with the inspector's button „+ {kind}“ and waits for its panel. */
async function addOpening(app, kind) {
  await app.click(`+ ${kind}`, INSPECTOR);
  await app.waitUntil(async () => (await panelTitle(app)) === kind, `the new ${kind} is not selected: „${await panelTitle(app)}“`);
}

appTest("a door, a window and a hatch are added from the inspector; G slides one along its wall", async (app) => {
  await planOnly(app);
  await roomMode(app);

  // The new project's room is 8000 × 6000 mm with 240 mm walls; a click in the middle of a wall's
  // thickness picks the wall. North wall (1): a door.
  await selectWall(app, 1, { x: 2000, y: -120 });
  await addOpening(app, "Tür");
  assert.equal(germanNumber(await app.fieldValue(OFFSET)), 4000, "the door is not in the middle of the north wall");
  // East wall (2): a window, with its sill.
  await selectWall(app, 2, { x: 8120, y: 1500 });
  await addOpening(app, "Fenster");
  assert.equal(germanNumber(await app.fieldValue(OFFSET)), 3000);
  assert.equal(germanNumber(await app.fieldValue("Brüstungshöhe")), 900);
  // West wall (4): a pass-through hatch.
  await selectWall(app, 4, { x: -120, y: 4500 });
  await addOpening(app, "Durchreiche");
  assert.equal(germanNumber(await app.fieldValue(OFFSET)), 3000);

  // The window again, from its wall's list of openings, then G and 1000: 1000 mm further along
  // the wall (the sign follows the mouse, which stays put).
  await selectWall(app, 2, { x: 8120, y: 1500 });
  await app.waitUntil(
    () =>
      app.exec((sel) => {
        const row = [...document.querySelectorAll(`${sel} .list-row`)].find((b) => b.innerText.trim().startsWith("Fenster"));
        row?.click();
        return !!row;
      }, INSPECTOR),
    "the east wall does not list its window",
  );
  await app.waitUntil(async () => (await panelTitle(app)) === "Fenster", "the window's panel did not open from the list");
  const r = await planRect(app);
  await hover(app, { x: r.cx, y: r.cy });
  await app.blur();
  await app.type("g1000");
  await app.waitUntil(async () => germanNumber(await app.fieldValue(OFFSET)) === 4000, `the window did not slide: ${await app.fieldValue(OFFSET)}`);
  await app.keys(Key.Enter);
  await app.waitUntil(async () => !/\[1000\]/.test(await app.statusText()), "G did not end on Enter");
  assert.equal(germanNumber(await app.fieldValue(OFFSET)), 4000);
  // One undo step: back to the middle.
  await app.click("Rückgängig", "header");
  await app.waitUntil(async () => germanNumber(await app.fieldValue(OFFSET)) === 3000, "undo did not take the slide back");
  await app.click("Wiederholen", "header");
  await app.waitUntil(async () => germanNumber(await app.fieldValue(OFFSET)) === 4000, "redo did not slide it again");

  const doc = await saveAs(app, "Oeffnungen.kplan");
  const byKind = (kind) => doc.room.openings.filter((o) => o.kind === kind && !o.partition);
  // The new project's own door in the south wall, and the new one in the north wall.
  assert.deepEqual(byKind("door").map((o) => [o.wall, o.offset]).sort(), [[0, 4000], [2, 6800]]);
  assert.deepEqual(byKind("window").map((o) => [o.wall, o.offset, o.sill]), [[1, 4000, 900]]);
  assert.deepEqual(byKind("hatch").map((o) => [o.wall, o.offset]), [[3, 3000]]);
});
