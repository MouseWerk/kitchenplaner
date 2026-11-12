import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Menu, menuPosition } from "./Menu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const view = { width: 800, height: 600 };
const size = { width: 220, height: 200 };
const button = (left: number, top: number) => ({ left, top, right: left + 28, bottom: top + 28 });

describe("menuPosition", () => {
  it("opens below the button, at its start or its end edge", () => {
    expect(menuPosition(button(100, 40), size, view, "start")).toEqual({ left: 100, top: 72, maxHeight: 600 - 8 - 72 });
    expect(menuPosition(button(400, 40), size, view, "end")).toEqual({ left: 428 - 220, top: 72, maxHeight: 520 });
  });

  it("shifts back into the window at the right and the left edge", () => {
    // A button at the right edge of the window (the overflow menu of a small 3D pane).
    expect(menuPosition(button(760, 40), size, view, "start").left).toBe(800 - 8 - 220);
    expect(menuPosition(button(10, 40), size, view, "end").left).toBe(8);
  });

  it("flips above the button when it does not fit below and there is more room above", () => {
    const p = menuPosition(button(100, 500), size, view, "start");
    expect(p.top).toBe(500 - 4 - 200);
    expect(p.top + 200).toBeLessThanOrEqual(500);
    // Not enough room on either side: the larger side, limited to it (the menu scrolls).
    const tall = menuPosition(button(100, 400), { width: 220, height: 900 }, view, "start");
    expect(tall).toEqual({ left: 100, top: 8, maxHeight: 400 - 4 - 8 });
    // Room below: stays below even if there is more room above.
    expect(menuPosition(button(100, 300), size, view, "start").top).toBe(332);
  });
});

describe("Menu", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("places the open popup fixed inside the window", () => {
    act(() => root.render(createElement(Menu, { label: "More", title: "More", align: "end", entries: [{ label: "One", onSelect: () => {} }] })));
    act(() => host.querySelector("button")!.click());
    const menu = host.querySelector<HTMLElement>("[role=menu]")!;
    expect(menu.style.position).toBe("fixed");
    expect(parseFloat(menu.style.left)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(menu.style.left) + menu.offsetWidth).toBeLessThanOrEqual(window.innerWidth - 8);
  });
  it("offers choices as radio items, opens on the current one and picks with the keyboard", () => {
    const picked: string[] = [];
    const entries = ["Wall", "Half", "Room"].map((label) => ({ label, checked: label === "Half", radio: true, onSelect: () => picked.push(label) }));
    act(() => root.render(createElement(Menu, { label: "Half", title: "Cut", className: "tb-btn pane-menu", entries })));
    const button = host.querySelector<HTMLButtonElement>("button")!;
    expect(button.className).toBe("tb-btn pane-menu");
    act(() => button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    const items = [...host.querySelectorAll<HTMLButtonElement>("[role=menu] button")];
    expect(items.map((b) => b.getAttribute("role"))).toEqual(["menuitemradio", "menuitemradio", "menuitemradio"]);
    expect(items.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(items[1].querySelector(".menu-check")!.textContent).toBe("✓");
    expect(document.activeElement).toBe(items[1]);
    act(() => items[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement).toBe(items[2]);
    act(() => items[2].click());
    expect(picked).toEqual(["Room"]);
    expect(host.querySelector("[role=menu]")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("opens a menu of commands, switches and choices on its first entry", () => {
    const entries = [
      { label: "Dimensions", checked: true, onSelect: () => {} },
      { label: "Grid 10", checked: false, radio: true, onSelect: () => {} },
      { label: "Grid 50", checked: true, radio: true, onSelect: () => {} },
    ];
    act(() => root.render(createElement(Menu, { label: "Display", title: "Display", entries })));
    act(() => host.querySelector<HTMLButtonElement>("button")!.click());
    const items = [...host.querySelectorAll<HTMLButtonElement>("[role=menu] button")];
    expect(items.map((b) => b.getAttribute("role"))).toEqual(["menuitemcheckbox", "menuitemradio", "menuitemradio"]);
    expect(document.activeElement).toBe(items[0]);
  });

  it("moves the focus into the popup only once it is placed (never while it is hidden)", () => {
    // happy-dom focuses hidden elements, browsers do not: record the popup's visibility at
    // every focus call instead.
    const focus = HTMLElement.prototype.focus;
    const seen: string[] = [];
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      const menu = this.closest<HTMLElement>("[role=menu]");
      if (menu) seen.push(menu.style.visibility);
      focus.call(this, options);
    };
    try {
      act(() => root.render(createElement(Menu, { label: "View", title: "View", entries: [{ label: "One", onSelect: () => {} }, { label: "Two", onSelect: () => {} }] })));
      act(() => host.querySelector<HTMLButtonElement>("button")!.click());
      expect(seen).toEqual([""]);
      expect(document.activeElement).toBe(host.querySelector("[role=menuitem]"));
    } finally {
      HTMLElement.prototype.focus = focus;
    }
  });

  it("names an icon-only button and lays the popup out fixed before it is placed", () => {
    act(() => root.render(createElement(Menu, { label: createElement("svg"), ariaLabel: "Export", title: "Export", entries: [{ label: "One", onSelect: () => {} }] })));
    const button = host.querySelector<HTMLButtonElement>("button")!;
    expect(button.getAttribute("aria-label")).toBe("Export");
    act(() => button.click());
    // Never measured inside the narrow anchor: that would cut the labels to the button's width.
    expect(host.querySelector<HTMLElement>("[role=menu]")!.style.position).toBe("fixed");
  });

  it("gives a cut label its full text as a tooltip", () => {
    const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get() { return this.textContent.length > 10 ? 300 : 50; } });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 200; } });
    try {
      act(() => root.render(createElement(Menu, { label: "View", title: "View", entries: [{ label: "Short", onSelect: () => {} }, { label: "A label much too long", onSelect: () => {} }] })));
      act(() => host.querySelector<HTMLButtonElement>("button")!.click());
      const labels = [...host.querySelectorAll<HTMLElement>(".menu-label")];
      expect(labels.map((l) => l.getAttribute("title"))).toEqual([null, "A label much too long"]);
    } finally {
      if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollWidth", scroll);
      else delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
      if (client) Object.defineProperty(HTMLElement.prototype, "clientWidth", client);
      else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });
});
