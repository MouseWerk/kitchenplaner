import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PlanView } from "./PlanView";
import { setLang } from "../lib/i18n";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the floor plan with the keyboard", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLang("de");
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(createElement(PlanView, { fitSignal: 0 })));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useStore.getState().setMode("arrange");
  });

  const plan = () => host.querySelector<HTMLElement>("[role=application]")!;
  const press = (el: Element, key: string, init: KeyboardEventInit = {}) => act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })));

  it("is a tab stop of its own, marked as the drawing, and says which keys it takes", () => {
    expect(plan().tabIndex).toBe(0);
    expect(plan().hasAttribute("data-drawing")).toBe(true);
    expect(plan().getAttribute("aria-description")).toContain("Umschalt+F10");
  });

  it("opens the context menu with Shift+F10 and the menu key, and gives the focus back when it closes", () => {
    act(() => plan().focus());
    // A browser does not focus an element under `visibility: hidden` (the menu while it is
    // measured); happy-dom does, so the test records where the focus was asked to go.
    const hiddenFocus: string[] = [];
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, o?: FocusOptions) {
      const m = this.closest<HTMLElement>("[role=menu]");
      if (m && m.style.visibility === "hidden") hiddenFocus.push(this.textContent ?? "");
      focus.call(this, o);
    };
    try {
      press(plan(), "F10", { shiftKey: true });
    } finally {
      HTMLElement.prototype.focus = focus;
    }
    expect(hiddenFocus).toEqual([]);
    const menu = host.querySelector("[role=menu]");
    expect(menu).not.toBeNull();
    expect(menu!.contains(document.activeElement)).toBe(true);
    press(document.activeElement!, "Escape");
    expect(host.querySelector("[role=menu]")).toBeNull();
    expect(document.activeElement).toBe(plan());

    press(plan(), "ContextMenu");
    expect(host.querySelector("[role=menu]")).not.toBeNull();
    press(document.activeElement!, "Escape");
  });

  it("opens the room mode's menu in the room mode", () => {
    act(() => useStore.getState().setMode("room"));
    act(() => plan().focus());
    press(plan(), "ContextMenu");
    const labels = [...host.querySelectorAll("[role=menuitem]")].map((b) => b.textContent);
    expect(labels.some((l) => l?.includes("Messen"))).toBe(true);
    press(document.activeElement!, "Escape");
  });
});
