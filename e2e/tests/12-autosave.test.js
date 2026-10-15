// Autosave and recovery against the real app: the backup is written while the changes are unsaved,
// survives the app being killed, and the next start offers it (ui/src/lib/autosave.ts,
// crates/kitchen-core/src/autosave.rs).

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launch } from "../lib/harness.js";
import { appTest, inspectorName, place, pressOnViews, setField, waitItemCount } from "../lib/kitchen.js";

const NAME = "Bräter vom Absturz";

/** The project texts of the backups in a run's data folder. */
function backups(dir) {
  const folder = path.join(dir, "data", "autosave");
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".kplan"))
    .map((f) => fs.readFileSync(path.join(folder, f), "utf8"));
}

appTest(
  "after a crash the next start offers the unsaved changes and restores them as an unsaved project",
  async (app) => {
    await place(app, "Arbeitstisch an der Wand");
    await setField(app, "Bezeichnung", NAME);
    // The backup follows a few seconds after the last change; the status bar says so.
    await app.waitUntil(async () => /Automatisch gesichert/.test(await app.statusText()), "the status bar does not show a backup", 20000);
    await app.waitUntil(() => backups(app.dir).some((t) => t.includes(NAME)), "no backup with the edit in the data folder", 10000);

    await app.crash();
    const again = await launch({ reuse: app.dir });
    try {
      const dialog = await again.waitFor("[role=dialog][aria-labelledby='recovery-title']", 15000);
      assert.match(await again.textOf(dialog), /Unbenanntes Projekt/);
      // The introduction was seen in the first run: it does not stack on the question.
      assert.equal(await again.exec(() => document.querySelectorAll("[role=dialog]").length), 1);
      await again.click("Wiederherstellen", "[role=dialog]");
      await again.waitUntil(() => again.exec(() => !document.querySelector("[role=dialog]")), "the recovery dialog stayed open");
      await again.waitToast(/wiederhergestellt/);

      // The edit is back, and the project still needs saving.
      await waitItemCount(again, 1);
      assert.ok((await again.browser.getTitle()).startsWith("* "), "the restored project is not marked as unsaved");
      await pressOnViews(again, "a");
      await again.waitUntil(async () => (await inspectorName(again)) === NAME, "the restored item lost its name");
      assert.equal(await again.exec(() => !!document.querySelector(".intro[role=dialog]")), false);
      const errors = await again.consoleErrors();
      assert.deepEqual(errors, []);
    } catch (e) {
      await again.shot("FAIL-recovery-restart").catch(() => {});
      throw e;
    } finally {
      await again.close();
    }
  },
  { appGone: true, timeout: 180000 },
);
