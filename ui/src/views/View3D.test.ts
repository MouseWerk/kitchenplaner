import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setLang } from "../lib/i18n";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// No WebGL in happy-dom: an engine that does nothing, so the overlay renders.
vi.mock("../three/engine", () => ({
  Engine: class {
    constructor() {
      return new Proxy(this, { get: (o, k) => (k in o ? (o as never)[k] : () => {}) });
    }
  },
}));

const { overlayLayout, View3D } = await import("./View3D");

describe("overlayLayout", () => {
  it("keeps everything in a large pane, compacts a small one and drops the cube in the smallest", () => {
    expect(overlayLayout(0)).toEqual({ compact: false, cube: "full" });
    expect(overlayLayout(900)).toEqual({ compact: false, cube: "full" });
    expect(overlayLayout(520)).toEqual({ compact: false, cube: "full" });
    expect(overlayLayout(519)).toEqual({ compact: true, cube: "small" });
    expect(overlayLayout(360)).toEqual({ compact: true, cube: "small" });
    expect(overlayLayout(359)).toEqual({ compact: true, cube: "none" });
  });
});

describe("View3D overlay", () => {
  let host: HTMLDivElement;
  let root: Root;
  let width = 900;

  beforeEach(() => {
    setLang("de");
    host = document.createElement("div");
    document.body.append(host);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const render = (w: number) => {
    width = w;
    root = createRoot(host);
    act(() => root.render(createElement(View3D, {})));
  };
  const buttons = () => [...host.querySelectorAll(".v3d-toolbar > button")].map((b) => b.getAttribute("aria-label"));
  const cube = () => host.querySelector<HTMLElement>(".v3d-cube-wrap")!;

  it("shows every button and the cube in a large pane", () => {
    render(900);
    expect(buttons()).toHaveLength(9);
    expect(host.querySelector("[aria-haspopup=menu]")).toBeNull();
    expect(cube().hidden).toBe(false);
  });

  it("puts the secondary buttons into a menu in a small pane, and leaves the cube out in the smallest", () => {
    render(480);
    expect(buttons()).toEqual(["Perspektive", "Von oben", "Einpassen"]);
    const more = host.querySelector<HTMLButtonElement>("[aria-haspopup=menu]")!;
    expect(more.title).toBe("Weitere Ansichtsoptionen");
    act(() => more.click());
    const items = [...host.querySelectorAll("[role^=menuitem]")].map((b) => b.textContent);
    expect(items.some((s) => s?.includes("Begehen"))).toBe(true);
    expect(items.some((s) => s?.includes("Von vorne"))).toBe(true);
    expect(host.querySelector(".v3d")!.classList.contains("is-compact")).toBe(true);
    expect(cube().hidden).toBe(false);
    act(() => root.unmount());
    render(320);
    expect(cube().hidden).toBe(true);
  });
});
