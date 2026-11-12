// Rendered design guards (AICodeGuidelines design/guard-tests.md): no horizontal overflow at the
// usual window widths, a top bar whose buttons all stay inside the window and never overlap, pane
// heads whose buttons stay inside their pane, no cut text without a tooltip, and keyboard focus
// shown only on :focus-visible with the neutral ring.

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

/**
 * The top bar's problems: buttons that end outside the window, and parts drawn over each other
 * (the page itself never scrolls sideways, base.css hides the overflow, so only positions tell).
 * The title's contents count as far as the title shows them.
 */
const toolbarProblems = (app) =>
  app.exec(() => {
    const w = window.innerWidth;
    const header = document.querySelector("header");
    const shown = (e) => e.getClientRects().length > 0;
    const name = (e) => (e.getAttribute("aria-label") || e.innerText || e.getAttribute("title") || e.className).trim();
    const problems = [];
    for (const b of [...header.querySelectorAll("button")].filter(shown)) {
      const r = b.getBoundingClientRect();
      if (r.left < -0.5 || r.right > w + 0.5) problems.push(`„${name(b)}“ outside the window (${Math.round(r.left)}–${Math.round(r.right)} of ${w})`);
    }
    const title = header.querySelector(".toolbar-title");
    const clips = title && getComputedStyle(title).overflowX !== "visible";
    const t = title?.getBoundingClientRect();
    const box = (e) => {
      const r = e.getBoundingClientRect();
      if (!clips || !title.contains(e)) return r;
      return { left: Math.max(r.left, t.left), right: Math.min(r.right, t.right), top: Math.max(r.top, t.top), bottom: Math.min(r.bottom, t.bottom) };
    };
    const parts = [...header.querySelectorAll(".toolbar-group > *, .toolbar-title > *")].filter(shown);
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const [a, b] = [box(parts[i]), box(parts[j])];
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) {
          problems.push(`„${name(parts[i])}“ and „${name(parts[j])}“ overlap`);
        }
      }
    }
    // The project name gives way, but never disappears.
    const doc = header.querySelector(".doc-name");
    if (!doc || box(doc).right - box(doc).left < 40) problems.push(`the project name is ${doc ? Math.round(box(doc).right - box(doc).left) : 0} px wide`);
    return problems;
  });

/** Text cut by its box (ellipsis or hidden overflow) with no title on itself or an ancestor. */
const cutWithoutTooltip = (app) =>
  app.exec(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => e.getClientRects().length > 0 && [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()))
      .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible")
      .filter((e) => !e.closest("[title], svg, .sr-only"))
      .slice(0, 8)
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}: „${e.textContent.trim().slice(0, 40)}“`),
  );

/**
 * Pane heads whose buttons do not wholly show: every visible button in a `.pane-head` lies inside
 * its pane (a quarter of a narrow window clips the rest, and a clipped menu cannot be opened).
 */
const paneHeadProblems = (app) =>
  app.exec(() => {
    const problems = [];
    for (const pane of document.querySelectorAll("main section.pane")) {
      const p = pane.getBoundingClientRect();
      for (const b of [...pane.querySelectorAll(".pane-head button")].filter((e) => e.getClientRects().length > 0)) {
        const r = b.getBoundingClientRect();
        if (r.left < p.left - 0.5 || r.right > p.right + 0.5 || r.top < p.top - 0.5 || r.bottom > p.bottom + 0.5 || r.width < 1) {
          const name = (b.getAttribute("aria-label") || b.innerText || b.getAttribute("title") || "").trim();
          problems.push(`„${name}“ in „${pane.getAttribute("aria-label")}“ at ${Math.round(r.left)}–${Math.round(r.right)}, the pane ${Math.round(p.left)}–${Math.round(p.right)}`);
        }
      }
    }
    return problems;
  });

/** Waits briefly for the bar to settle after a change, then asserts it has no problems. */
async function assertToolbar(app, where) {
  let last = [];
  await app
    .waitUntil(async () => (last = await toolbarProblems(app)).length === 0, "", 2000)
    .catch(() => {});
  assert.deepEqual(last, [], `top bar ${where}`);
}

const MODES = "header [role=group][aria-label='Modus']";
const LAYOUTS = "header [role=group][aria-label='Aufteilung wählen']";

for (const width of [1000, 1280, 1440, 1920]) {
  appTest(`no overflow, overlap or cut text without a tooltip at ${width} px`, async (app) => {
    await app.browser.setWindowSize(width, 900);
    await app.waitUntil(async () => Math.abs((await app.exec(() => window.innerWidth)) - width) <= 40, `the window did not take the width ${width}`);
    // Both modes (the room tools widen the bar), saved and with unsaved changes.
    for (const mode of ["Raum", "Einrichten"]) {
      await app.click(mode, MODES);
      await assertToolbar(app, `in „${mode}“ at ${width} px`);
    }
    // With an item selected (the inspector at its fullest) and in every layout.
    await place(app, "Herd, 6 Kochstellen, Backofen");
    for (const layout of ["Grundriss", "Ansichten", "3D", "Übersicht"]) {
      await app.click(layout, LAYOUTS);
      const o = await overflow(app);
      assert.ok(o.scroll <= o.inner && o.body <= o.inner, `${layout} at ${width} px overflows: ${JSON.stringify(o)}`);
      assert.deepEqual(await cutWithoutTooltip(app), [], `cut text without a tooltip in „${layout}“ at ${width} px`);
      let heads = [];
      await app.waitUntil(async () => (heads = await paneHeadProblems(app)).length === 0, "", 2000).catch(() => {});
      assert.deepEqual(heads, [], `pane head buttons outside their pane in „${layout}“ at ${width} px`);
    }
    await app.shot(`layout-${width}`);
    for (const mode of ["Raum", "Einrichten"]) {
      await app.click(mode, MODES);
      await assertToolbar(app, `in „${mode}“ with unsaved changes at ${width} px`);
    }
    assert.deepEqual(await cutWithoutTooltip(app), [], `cut text without a tooltip at ${width} px`);
  });
}

/** An `rgb(...)`/`rgba(...)` colour as [r, g, b]. */
const rgb = (s) => (/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(s) ?? []).slice(1, 4).map(Number);

appTest("keyboard focus on a toolbar button is the neutral ring, mouse focus shows none", async (app) => {
  // From one toolbar button to the previous one with the keyboard (Shift+Tab). Tab switches the
  // mode only while a drawing has the focus; on a toolbar button it moves the focus as well.
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
  const plan = await app.button("Grundriss", "header [role=group][aria-label='Aufteilung wählen']");
  await plan.click();
  const mouse = await app.exec((e) => ({ active: document.activeElement === e, visible: e.matches(":focus-visible"), outline: getComputedStyle(e).outlineStyle }), plan);
  if (mouse.active) assert.ok(!mouse.visible || mouse.outline === "none", `a mouse click shows a focus ring: ${JSON.stringify(mouse)}`);
});
