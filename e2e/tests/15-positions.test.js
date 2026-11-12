// Position numbers („Pos.“) are stable: deleting an item leaves a gap and never renumbers the
// others, and a copy made with Shift+D gets the next free number, like a new item.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, hover, inspectorName, place, planOnly, planRect, pressOnViews, saveAs, selectedPos, waitItemCount } from "../lib/kitchen.js";

appTest("deleting and duplicating with Shift+D keep every other position number", async (app) => {
  const [a] = await place(app, "Arbeitstisch an der Wand");
  const ab = await place(app, "Spültisch, 1 Becken");
  const b = ab.find((id) => id !== a);
  const abc = await place(app, "Handwaschbecken");
  const c = abc.find((id) => id !== a && id !== b);
  assert.equal(await selectedPos(app), 3);
  await planOnly(app);

  // Pos. 2 by the keyboard (N from nothing selected: 1, then 2), then Delete.
  await pressOnViews(app, Key.Escape);
  await app.keys("n");
  await app.waitUntil(async () => (await selectedPos(app)) === 1, "N did not select Pos. 1");
  await app.keys("n");
  await app.waitUntil(async () => (await selectedPos(app)) === 2, "N did not select Pos. 2");
  assert.match(await inspectorName(app), /Spültisch/);
  await app.keys(Key.Delete);
  await waitItemCount(app, 2);
  assert.deepEqual((await app.planItems()).sort(), [a, c].sort());

  // Pos. 3 (Shift+N from nothing selected starts at the last), copied with Shift+D and moved
  // 1000 mm to the right; Enter places the copy.
  await pressOnViews(app, Key.Escape);
  await app.keys([Key.Shift, "n"]);
  await app.waitUntil(async () => (await selectedPos(app)) === 3, "Shift+N did not select Pos. 3");
  const r = await planRect(app);
  await hover(app, { x: r.cx, y: r.cy });
  await app.keys([Key.Shift, "d"]);
  await app.waitUntil(async () => (await app.planItems()).length === 3, "Shift+D did not make a copy");
  await app.type("x1000");
  await app.keys(Key.Enter);
  await waitItemCount(app, 3);
  // The copy is selected: the next free number, not the gap.
  await app.waitUntil(async () => (await selectedPos(app)) === 4, `the copy has Pos. ${await selectedPos(app)}, expected 4`);
  assert.match(await inspectorName(app), /Handwaschbecken/);

  // A new item after that: Pos. 5.
  await place(app, "Arbeitstisch frei stehend");
  assert.equal(await selectedPos(app), 5);

  const doc = await saveAs(app, "Positionen.kplan");
  const pos = Object.fromEntries(doc.items.map((i) => [i.id, i.pos]));
  assert.equal(pos[a], 1);
  assert.equal(pos[c], 3);
  assert.equal(pos[b], undefined, "the deleted item is still in the file");
  assert.deepEqual(doc.items.map((i) => i.pos).sort((x, y) => x - y), [1, 3, 4, 5]);
  const copy = doc.items.find((i) => i.pos === 4);
  const orig = doc.items.find((i) => i.id === c);
  assert.equal(copy.catalogId, orig.catalogId);
  assert.equal(copy.x - orig.x, 1000, "the copy was not moved by the typed 1000 mm");
  assert.equal(copy.y, orig.y);
});
