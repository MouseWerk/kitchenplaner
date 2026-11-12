// The installation plan end to end: a combi oven's electric point raised in the inspector shows
// with its new height in the plan once the trade filter is on, and the connection list and the
// installation plan as SVG and DXF carry it, filtered like the plan.

import assert from "node:assert/strict";
import { appTest, exportFile, INSPECTOR, place, setField } from "../lib/kitchen.js";

/** The texts of the floor plan's drawing (position numbers, point ids, heights). */
const planTexts = (app) =>
  app.exec(() => {
    // Named by the UI language, like `planItems`.
    const pane = document.querySelector("section[aria-label='Grundriss'], section[aria-label='Floor plan']");
    return [...(pane?.querySelectorAll("svg text") ?? [])].map((e) => e.textContent.trim());
  });

/** DXF is pairs of lines: a group code and its value. */
function dxfPairs(text) {
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  assert.equal(lines.length % 2, 0, "the DXF has an odd number of lines");
  const pairs = [];
  for (let i = 0; i < lines.length; i += 2) pairs.push([Number(lines[i].trim()), lines[i + 1].trim()]);
  return pairs;
}

appTest("a connection point edited in the inspector shows in the filtered plan and in the exports", async (app) => {
  await place(app, "Kombidämpfer 20 × GN 1/1");

  // The plan shows no points while the filter is off.
  await app.waitUntil(async () => (await planTexts(app)).includes("1"), "the plan does not show Pos. 1");
  assert.ok(!(await planTexts(app)).includes("1.E"), "the plan shows points with the filter off");

  // Open the electric point and set its height above the finished floor.
  await app.click("1.E Elektro", INSPECTOR);
  await setField(app, "Höhe ü. FFB", "650");
  await app.waitUntil(async () => (await app.fieldValue("Höhe ü. FFB")) === "650", "the height did not change to 650");

  await app.menu("Darstellung", "Nur Elektro");
  await app.waitUntil(
    async () => {
      const texts = await planTexts(app);
      return texts.includes("1.E") && texts.includes("+650");
    },
    "the plan does not label the electric point „1.E“ with „+650“",
  );
  const shown = await planTexts(app);
  // Only the electric group: the combi's water and drain points stay hidden.
  assert.ok(!shown.some((s) => /^1\.(KW|WW|EW|AW)$/.test(s)), `the plan shows other trades: ${shown.join(" ")}`);

  // The connection list: the electric point only, at its height.
  const csv = await exportFile(app, "Anschlussliste als CSV…", "anschluesse.csv");
  assert.deepEqual([...csv.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const rows = csv.toString("utf8").slice(1).split(/\r\n/).filter(Boolean);
  assert.match(rows[0], /^Nr\.;Pos\.;Bezeichnung;Gewerk;/);
  const point = rows.filter((r) => /^1\.\w+;/.test(r));
  assert.equal(point.length, 1, `expected one point row:\n${rows.join("\n")}`);
  const cells = point[0].split(";");
  assert.equal(cells[0], "1.E");
  assert.equal(cells[1], "1");
  assert.equal(cells[3], "Elektro");
  assert.equal(cells[10], "650", `the height column is „${cells[10]}“`);

  // The installation plan as SVG: titled for the group, the point labelled with its height.
  const svg = (await exportFile(app, "Installationsplan als SVG…", "installation.svg")).toString("utf8");
  assert.match(svg, /<svg[^>]* width="[\d.]+mm" height="[\d.]+mm"/);
  assert.ok(svg.trimEnd().endsWith("</svg>"), "the SVG is cut off");
  assert.ok(svg.includes("Installationsplan Elektro"), "the SVG does not name the installation plan");
  assert.ok(svg.includes(">1.E<"), "the SVG does not label the point");
  assert.ok(svg.includes(">+650<"), "the SVG does not show the point's height");
  assert.ok(!svg.includes(">1.KW<"), "the SVG shows the cold water point although the filter is electric");
  assert.ok(svg.includes("Legende"), "the SVG has no legend");

  // The installation plan as DXF: complete, with the electric layer and the point.
  const dxf = (await exportFile(app, "Installationsplan als DXF…", "installation.dxf")).toString("utf8");
  const pairs = dxfPairs(dxf);
  assert.deepEqual(pairs.slice(-1), [[0, "EOF"]]);
  assert.ok(pairs.some(([code, v]) => code === 8 && v === "ANSCHLUSS_ELEKTRO"), "nothing on the layer ANSCHLUSS_ELEKTRO");
  assert.ok(pairs.some(([, v]) => v === "1.E"), "the DXF does not name the point „1.E“");
  assert.ok(pairs.some(([, v]) => v === "650" || v === "+650"), "the DXF does not carry the point's height");

  // Back off: the plan draws no points again.
  await app.menu("Darstellung", "Anschlüsse aus");
  await app.waitUntil(async () => !(await planTexts(app)).includes("1.E"), "the points stayed in the plan with the filter off");
});
