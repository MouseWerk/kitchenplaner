// The English UI. Every other test runs in German; this one switches the language the way a user
// does, in the view menu, and runs a short flow in English: a new project, a unit from the
// catalogue, its fields with English digit grouping, and the equipment list exported as CSV.

import assert from "node:assert/strict";
import { appTest, escapeRe, pressed } from "../lib/kitchen.js";

const CATALOGUE = "aside[aria-label='Catalogue']";
const PROPERTIES = "aside[aria-label='Properties']";

/** The value of the inspector field labelled `label` in the English UI. */
const fieldValue = (app, label) =>
  app.waitUntil(
    () =>
      app.exec(
        (panel, label) => {
          const l = [...(document.querySelector(panel)?.querySelectorAll("label") ?? [])].find((x) => x.textContent.trim() === label);
          return (l && document.getElementById(l.htmlFor)?.value) ?? null;
        },
        PROPERTIES,
        label,
      ),
    `no field „${label}“ in the properties`,
  );

appTest("switched to English, the window and a short flow speak English", async (app) => {
  await app.menu("Darstellung", "English");
  await app.waitUntil(() => app.exec(() => document.documentElement.lang === "en"), "the UI did not switch to English");
  // The toolbar, the panels and the status bar follow at once.
  await app.waitFor(CATALOGUE);
  await app.waitFor(PROPERTIES);
  assert.equal(await pressed(app, "Mode"), "Arrange");
  assert.match(await app.statusText(), /(^|\s)0 items(\s|$)/);

  // A new project is named in English.
  await app.click("New project", "header");
  await app.waitUntil(async () => (await app.browser.getTitle()) === "Untitled project – Kitchenplaner", `title is „${await app.browser.getTitle()}“`);

  await app.click("Wall work table", CATALOGUE);
  await app.waitUntil(async () => (await app.planItems()).length === 1, "the table did not appear in the plan");
  await app.waitUntil(async () => /(^|\s)1 item(\s|$)/.test(await app.statusText()), `the status bar does not count one item: „${await app.statusText()}“`);
  assert.equal(await fieldValue(app, "Description"), "Wall work table");
  assert.equal(await fieldValue(app, "Width"), "1,200");
  assert.equal(await fieldValue(app, "Depth"), "700");
  await app.waitUntil(async () => (await app.browser.getTitle()) === "* Untitled project – Kitchenplaner", "the title does not mark the change");

  // The equipment list in English: comma separated, English headings.
  const name = "list.csv";
  await app.nextPath(app.file(name));
  await app.menu("Export", "Equipment list as CSV…");
  await app.waitToast(new RegExp(`Exported “${escapeRe(name)}”`));
  const bytes = await app.waitFile(name);
  const rows = bytes.toString("utf8").replace(/^﻿/, "").split(/\r\n/).filter(Boolean);
  assert.match(rows[0], /^Pos\.,Description,/);
  assert.ok(rows.some((r) => /^1,.*Wall work table/.test(r)), `no row for the table:\n${rows.join("\n")}`);

  // And back: the German menu entry is named in German in both languages.
  await app.menu("View", "Deutsch");
  await app.waitUntil(() => app.exec(() => document.documentElement.lang === "de"), "the UI did not switch back to German");
  await app.waitFor("aside[aria-label='Katalog']");
});
