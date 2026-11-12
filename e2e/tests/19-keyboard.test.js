// Working without the mouse: A selects everything and Delete removes it, the arrow keys nudge the
// selection (Shift: in larger steps), N and Shift+N walk through the units by position number,
// Shift+F10 opens the plan's context menu, and F6 jumps between the window's regions.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { announced, appTest, germanNumber, INSPECTOR, panelTitle, place, planOnly, pressOnViews, selectedPos, waitItemCount } from "../lib/kitchen.js";

const num = async (app, label) => germanNumber(await app.fieldValue(label));

/** Focuses the plan as a click into it or F6 does. */
const focusPlan = (app) => app.exec(() => document.querySelector("section[aria-label='Grundriss'] [data-drawing]").focus());

/** Which region of the window has the keyboard focus. */
const focusRegion = (app) =>
  app.exec(() => {
    const a = document.activeElement;
    for (const [sel, name] of [
      ["header.toolbar", "toolbar"],
      ["aside.sidebar", "catalog"],
      ["main.views", "views"],
      ["aside.inspector", "inspector"],
    ]) {
      if (a?.closest(sel)) return name;
    }
    return null;
  });

appTest("A selects all, Delete removes them in one step; the arrows nudge by 10 and Shift+arrows by 100 mm", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  await place(app, "Spültisch, 1 Becken");
  await planOnly(app);

  await pressOnViews(app, "a");
  await app.waitUntil(async () => (await panelTitle(app)) === "2 Geräte ausgewählt", `A did not select both: „${await panelTitle(app)}“`);
  await app.keys(Key.Delete);
  await waitItemCount(app, 0);
  assert.equal(await panelTitle(app), null, "the inspector still shows an item");
  await pressOnViews(app, [Key.Ctrl, "z"]);
  await waitItemCount(app, 2);

  // Pos. 1 alone, then nudged: one key at a time (a list of keys is one chord to WebDriver).
  await pressOnViews(app, Key.Escape);
  await app.keys("n");
  await app.waitUntil(async () => (await selectedPos(app)) === 1, "N did not select Pos. 1");
  const x0 = await num(app, "X");
  const y0 = await num(app, "Y");
  await app.keys(Key.ArrowRight);
  await app.waitUntil(async () => (await num(app, "X")) === x0 + 10, `Right did not nudge by 10: X is ${await app.fieldValue("X")}`);
  await app.keys(Key.ArrowRight);
  await app.waitUntil(async () => (await num(app, "X")) === x0 + 20, "a second Right did not nudge again");
  await app.keys([Key.Shift, Key.ArrowDown]);
  await app.waitUntil(async () => (await num(app, "Y")) === y0 + 100, `Shift+Down did not nudge by 100: Y is ${await app.fieldValue("Y")}`);
  await app.keys(Key.ArrowUp);
  await app.waitUntil(async () => (await num(app, "Y")) === y0 + 90, "Up did not nudge back by 10");
  await app.keys(Key.ArrowLeft);
  await app.waitUntil(async () => (await num(app, "X")) === x0 + 10, "Left did not nudge back by 10");
  // Every press is its own undo step.
  await pressOnViews(app, [Key.Ctrl, "z"]);
  await app.waitUntil(async () => (await num(app, "X")) === x0 + 20, "undo did not take back the last nudge alone");
  assert.equal(await num(app, "Y"), y0 + 90);

  // In a field the arrows stay with the field.
  const field = await app.field("Breite");
  await field.click();
  await app.keys(Key.ArrowLeft);
  assert.equal(await num(app, "X"), x0 + 20, "an arrow in a field nudged the item");
});

appTest("N and Shift+N walk through the units by number and say which one; Shift+F10 opens the menu", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  await place(app, "Spültisch, 1 Becken");
  await place(app, "Handwaschbecken");
  await planOnly(app);
  await pressOnViews(app, Key.Escape);
  await focusPlan(app);

  for (const [key, pos] of [
    ["n", 1],
    ["n", 2],
    ["n", 3],
    ["n", 1],
  ]) {
    await app.keys(key);
    await app.waitUntil(async () => (await selectedPos(app)) === pos, `N did not select Pos. ${pos}: Pos. ${await selectedPos(app)}`);
  }
  await app.keys([Key.Shift, "n"]);
  await app.waitUntil(async () => (await selectedPos(app)) === 3, "Shift+N from Pos. 1 did not wrap to Pos. 3");
  await app.waitUntil(async () => (await announced(app)).some((t) => /^Pos\. 3 Handwaschbecken ausgewählt, 3 von 3$/.test(t)), `not announced: ${JSON.stringify(await announced(app))}`);
  await app.keys([Key.Shift, "n"]);
  await app.waitUntil(async () => (await selectedPos(app)) === 2, "Shift+N did not go back to Pos. 2");

  // Shift+F10 on the plan: the context menu of the selection, with the keyboard focus in it.
  await app.keys([Key.Shift, Key.F10]);
  await app.waitFor("[role=menu]");
  await app.waitUntil(() => app.exec(() => document.activeElement?.getAttribute("role") === "menuitem"), "the menu did not take the focus");
  const first = await app.exec(() => document.activeElement.querySelector(".menu-label")?.textContent.trim());
  assert.equal(first, "Duplizieren");
  // Escape closes it and gives the focus back to the plan.
  await app.keys(Key.Escape);
  await app.waitUntil(() => app.exec(() => !document.querySelector("[role=menu]")), "Escape did not close the menu");
  assert.ok(await app.exec(() => document.activeElement?.matches("section[aria-label='Grundriss'] [data-drawing]")), "the focus did not go back to the plan");
  // Again, and Enter on „Duplizieren“: a copy with the next number.
  await app.keys([Key.Shift, Key.F10]);
  await app.waitUntil(() => app.exec(() => document.activeElement?.getAttribute("role") === "menuitem"), "the menu did not open again");
  await app.keys(Key.Enter);
  await waitItemCount(app, 4);
  await app.waitUntil(async () => (await selectedPos(app)) === 4, "the copy is not selected with Pos. 4");
  assert.equal(await app.exec(() => !!document.querySelector("[role=menu]")), false, "the menu stayed open");
});

appTest("F6 and Shift+F6 jump between toolbar, catalogue, views and inspector", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  await planOnly(app);
  await focusPlan(app);
  assert.equal(await focusRegion(app), "views");

  // From the views onwards in reading order, round to the start; also out of a field.
  for (const region of ["inspector", "toolbar", "catalog", "views"]) {
    await app.keys(Key.F6);
    await app.waitUntil(async () => (await focusRegion(app)) === region, `F6 did not reach the ${region}: the focus is in ${await focusRegion(app)}`);
  }
  // In the views F6 lands on the drawing itself, where the plan's keys work.
  assert.ok(await app.exec(() => document.activeElement?.matches("[data-drawing]")), "F6 did not focus the plan");
  for (const region of ["catalog", "toolbar", "inspector"]) {
    await app.keys([Key.Shift, Key.F6]);
    await app.waitUntil(async () => (await focusRegion(app)) === region, `Shift+F6 did not reach the ${region}: the focus is in ${await focusRegion(app)}`);
  }
  // The inspector's first control has the focus; nothing changed on the way.
  assert.ok(await app.exec((sel) => document.querySelector(sel).contains(document.activeElement) && document.activeElement !== document.body, INSPECTOR));
  assert.equal(await app.exec(() => document.querySelector("header button[aria-label='Wiederholen']").disabled), true);
  await waitItemCount(app, 1);
});
