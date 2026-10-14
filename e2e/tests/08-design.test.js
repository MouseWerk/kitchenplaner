// Rendered design guards (AICodeGuidelines design/guard-tests.md): no horizontal overflow at the
// usual window widths, and keyboard focus shown only on :focus-visible with the neutral ring.

import assert from "node:assert/strict";
import { Key } from "../lib/harness.js";
import { appTest, place } from "../lib/kitchen.js";

/** Elements wider than the window, for the failure message. */
const overflow = (app) =>
  app.exec(() => {
    const w = window.innerWidth;
    const wide = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > w + 1 && getComputedStyle(e).position !== "fixed")
      .slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} right=${Math.round(e.getBoundingClientRect().right)}`);
    return { scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth, inner: w, wide };
  });

for (const width of [1000, 1440, 1920]) {
  appTest(`no horizontal overflow at ${width} px`, async (app) => {
    await app.browser.setWindowSize(width, 900);
    await app.waitUntil(async () => Math.abs((await app.exec(() => window.innerWidth)) - width) <= 40, `the window did not take the width ${width}`);
    // With an item selected (the inspector at its fullest) and in every layout.
    await place(app, "Herd, 6 Kochstellen, Backofen");
    for (const layout of ["Grundriss", "Ansichten", "3D", "Alle Ansichten"]) {
      await app.click(layout, "header [role=group][aria-label='Ansicht wählen']");
      const o = await overflow(app);
      assert.ok(o.scroll <= o.inner && o.body <= o.inner, `${layout} at ${width} px overflows: ${JSON.stringify(o)}`);
    }
    await app.shot(`layout-${width}`);
  });
}

/** An `rgb(...)`/`rgba(...)` colour as [r, g, b]. */
const rgb = (s) => (/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(s) ?? []).slice(1, 4).map(Number);

appTest("keyboard focus on a toolbar button is the neutral ring, mouse focus shows none", async (app) => {
  // From one toolbar button to the previous one with the keyboard (Shift+Tab: Tab alone switches
  // the mode when nothing is focused).
  const open = await app.button("Öffnen…", "header");
  await app.exec((e) => e.focus(), open);
  await app.keys([Key.Shift, Key.Tab]);
  const style = await app.exec(() => {
    const e = document.activeElement;
    const cs = getComputedStyle(e);
    const probe = document.createElement("span");
    document.body.append(probe);
    probe.style.color = "var(--border-focus)";
    const focus = getComputedStyle(probe).color;
    probe.style.color = "var(--accent)";
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return {
      label: e.getAttribute("aria-label"),
      focusVisible: e.matches(":focus-visible"),
      outlineStyle: cs.outlineStyle,
      outlineColor: cs.outlineColor,
      outlineWidth: cs.outlineWidth,
      border: cs.borderColor,
      shadow: cs.boxShadow,
      focus,
      accent,
    };
  });
  assert.equal(style.label, "Neues Projekt");
  assert.ok(style.focusVisible, "Shift+Tab focus is not :focus-visible");
  assert.notEqual(style.outlineStyle, "none", "no focus ring");
  assert.deepEqual(rgb(style.outlineColor), rgb(style.focus), `the ring is not --border-focus: ${JSON.stringify(style)}`);
  const accent = rgb(style.accent).join(",");
  const used = [style.outlineColor, style.border, style.shadow].flatMap((s) => s.match(/rgba?\([^)]*\)/g) ?? []).map((c) => rgb(c).join(","));
  assert.ok(!used.includes(accent), `accent colour on focus: ${JSON.stringify(style)}`);

  // A mouse click focuses without a ring.
  const plan = await app.button("Grundriss", "header [role=group][aria-label='Ansicht wählen']");
  await plan.click();
  const mouse = await app.exec((e) => ({ active: document.activeElement === e, visible: e.matches(":focus-visible"), outline: getComputedStyle(e).outlineStyle }), plan);
  if (mouse.active) assert.ok(!mouse.visible || mouse.outline === "none", `a mouse click shows a focus ring: ${JSON.stringify(mouse)}`);
});
