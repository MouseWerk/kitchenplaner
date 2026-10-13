import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, panes, place, pressOnViews } from "../lib/kitchen.js";

/** Runs an entry of the „Exportieren“ menu into `name` and returns the file's bytes. */
async function exportTo(app, entry, name) {
  await app.nextPath(app.file(name));
  await app.menu("Exportieren", entry);
  await app.waitToast(new RegExp(`„${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}“ exportiert`));
  return app.waitFile(name);
}

appTest("the plan exports as SVG with its true size in millimetres", async (app) => {
  const [id] = await place(app, "Arbeitstisch an der Wand");
  const svg = (await exportTo(app, "Grundriss als SVG…", "plan.svg")).toString("utf8");
  assert.match(svg, /<svg[\s>]/);
  assert.match(svg, /<svg[^>]* width="[\d.]+mm" height="[\d.]+mm"/);
  assert.match(svg, /viewBox="/);
  assert.ok(svg.trimEnd().endsWith("</svg>"), "the SVG is cut off");
  assert.ok(id);
});

appTest("the plan exports as DXF with the wall layer and an end marker", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  const dxf = (await exportTo(app, "Grundriss als DXF…", "plan.dxf")).toString("utf8");
  const lines = dxf.split(/\r?\n/).map((l) => l.trim());
  assert.ok(lines.includes("WAENDE"), "no layer WAENDE");
  assert.ok(lines.includes("SECTION") && lines.includes("ENTITIES"), "no ENTITIES section");
  const tail = lines.filter(Boolean).slice(-2);
  assert.deepEqual(tail, ["0", "EOF"]);
});

appTest("the equipment list exports as CSV for Excel", async (app) => {
  await place(app, "Arbeitstisch an der Wand");
  await place(app, "Spültisch, 1 Becken");
  const bytes = await exportTo(app, "Geräteliste als CSV…", "liste.csv");
  // UTF-8 byte order mark, so Excel reads the umlauts.
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = bytes.toString("utf8").slice(1);
  const rows = text.split(/\r\n/).filter(Boolean);
  assert.match(rows[0], /^Pos\.;Bezeichnung;/);
  assert.ok(rows.some((r) => /^1;.*Arbeitstisch/.test(r)), `no row for the table:\n${text}`);
  assert.ok(rows.some((r) => /^2;.*Spültisch/.test(r)), `no row for the sink:\n${text}`);
});

appTest("the 3D view exports as PNG when it is shown", async (app, t) => {
  await place(app, "Kombidämpfer 20 × GN 1/1");
  // Without a 3D pane there is nothing to capture: the entry is disabled.
  await app.click("Exportieren", "header");
  const entry = await app.button("3D-Ansicht als PNG…", "[role=menu]");
  assert.equal(await entry.isEnabled(), false);
  await app.keys(Key.Escape);
  await app.waitUntil(() => app.exec(() => !document.querySelector("[role=menu]")), "Escape did not close the menu");

  await pressOnViews(app, "3");
  await app.waitUntil(async () => (await panes(app)).includes("3D"), "no 3D pane");
  await app.waitUntil(
    () => app.exec(() => !!document.querySelector("section[aria-label='3D'] canvas") || /WebGL/.test(document.querySelector("section[aria-label='3D']")?.innerText ?? "")),
    "the 3D view neither rendered nor reported a missing WebGL",
    30000,
  );
  if (!(await app.exec(() => !!document.querySelector("section[aria-label='3D'] canvas")))) {
    // The app shows its message; three.js also logs the failed context, which is expected here.
    await app.exec(() => (window.__E2E_ERRORS__ = window.__E2E_ERRORS__.filter((e) => !/WebGL/i.test(e))));
    t.skip("no WebGL in this environment");
    return;
  }
  const png = await exportTo(app, "3D-Ansicht als PNG…", "3d.png");
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length > 10_000, `the PNG is suspiciously small (${png.length} bytes)`);
});
