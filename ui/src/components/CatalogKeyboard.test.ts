import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// No WebGL in happy-dom: thumbnails stay loading.
vi.mock("../three/thumbnails", () => ({
  PRIORITY: { preview: 0, visible: 1, prefetch: 2 },
  prefetchThumbnails: () => {},
  useThumbnail: () => ({ status: "loading", url: null }),
}));

const { CatalogPanel, rovingTarget } = await import("./CatalogPanel");
const { setLang } = await import("../lib/i18n");

describe("rovingTarget", () => {
  const rows = ["a", "b", "c"];
  it("moves down, up, to the first and the last, and stops at the ends", () => {
    expect(rovingTarget(rows, "a", "ArrowDown")).toBe("b");
    expect(rovingTarget(rows, "b", "ArrowUp")).toBe("a");
    expect(rovingTarget(rows, "b", "Home")).toBe("a");
    expect(rovingTarget(rows, "a", "End")).toBe("c");
    expect(rovingTarget(rows, "c", "ArrowDown")).toBeNull();
    expect(rovingTarget(rows, "a", "ArrowUp")).toBeNull();
    expect(rovingTarget(rows, "a", "Enter")).toBeNull();
  });
});

describe("CatalogPanel with the keyboard", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setLang("de");
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(createElement(CatalogPanel)));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const rows = () => [...host.querySelectorAll<HTMLButtonElement>(".cat-row")];
  const stops = () => rows().filter((r) => r.tabIndex === 0);
  const key = (el: Element, k: string) => {
    const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
    act(() => void el.dispatchEvent(e));
    return e;
  };
  const search = (q: string) => {
    const input = host.querySelector<HTMLInputElement>("input[type=search]")!;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      set.call(input, q);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  it("makes all rows one tab stop, moved with the arrows, Home and End", () => {
    expect(rows().length).toBeGreaterThan(100);
    expect(stops()).toEqual([rows()[0]]);
    act(() => rows()[0].focus());
    const e = key(rows()[0], "ArrowDown");
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(rows()[1]);
    expect(stops()).toEqual([rows()[1]]);
    key(rows()[1], "End");
    expect(document.activeElement).toBe(rows().at(-1));
    key(document.activeElement!, "Home");
    expect(document.activeElement).toBe(rows()[0]);
  });

  it("offers to clear a search without hits, and reads out how many it found", () => {
    const status = () => host.querySelector("[role=status]")!.textContent;
    expect(status()).toBe("");
    search("fritteuse");
    expect(status()).toMatch(/^\d+ Geräte gefunden$/);
    search("zzzz-nichts");
    expect(status()).toBe("0 Geräte gefunden");
    const clear = [...host.querySelectorAll<HTMLButtonElement>(".empty button")].find((b) => b.textContent === "Suche löschen")!;
    expect(clear).toBeTruthy();
    expect(host.querySelector<HTMLButtonElement>(".search button[aria-label='Suche löschen']")).not.toBeNull();
    act(() => clear.click());
    expect(host.querySelector<HTMLInputElement>("input[type=search]")!.value).toBe("");
    expect(document.activeElement).toBe(host.querySelector("input[type=search]"));
    expect(rows().length).toBeGreaterThan(100);
    expect(stops()).toHaveLength(1);
  });
});
