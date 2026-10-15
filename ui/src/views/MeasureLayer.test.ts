import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MeasureLayer } from "./MeasureLayer";
import { setLang } from "../lib/i18n";
import { isMeasuring, setMeasuring } from "../lib/measureTool";
import { handleShortcut } from "../lib/shortcuts";
import { registerOperator } from "../lib/commands";
import { testItem, testProject } from "../model/testProject";
import { useStore } from "../store/store";
import type { Viewport } from "../lib/viewport";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom puts the layer at 0, 0: with this viewport a client pixel is 10 mm on the plan.
const VP = { k: 0.1, ox: 0, oy: 0 };

let host: HTMLDivElement;
let root: Root | null = null;
let panned: Viewport[] = [];
const st = () => useStore.getState();
const svg = () => host.querySelector("svg")!;

function pointer(type: string, x: number, y: number, opts: { button?: number; shiftKey?: boolean; altKey?: boolean } = {}) {
  act(() => void svg().dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x * VP.k, clientY: y * VP.k, button: opts.button ?? 0, shiftKey: opts.shiftKey, altKey: opts.altKey, pointerId: 1 })));
}
const click = (x: number, y: number, opts = {}) => {
  pointer("pointermove", x, y, opts);
  pointer("pointerdown", x, y, opts);
  pointer("pointerup", x, y, opts);
};
const key = (k: string) => act(() => void handleShortcut(new KeyboardEvent("keydown", { key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, bubbles: true }), () => {}));

beforeEach(() => {
  setLang("de");
  Element.prototype.setPointerCapture ??= () => {};
  st().load(testProject([testItem("t", "table", 1600, 300, 0, { width: 1200, depth: 600 })]), null);
  st().setLayout("plan");
  st().setPrefs({ grid: 50 });
  panned = [];
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  act(() => setMeasuring(false));
});

function mount() {
  root = createRoot(host);
  act(() => root!.render(createElement(MeasureLayer, { vp: VP, width: 1000, height: 800, setVp: (v: Viewport) => void panned.push(v) })));
}

describe("the M key", () => {
  it("switches the measure tool where a plan is shown", () => {
    key("m");
    expect(isMeasuring()).toBe(true);
    key("m");
    expect(isMeasuring()).toBe(false);
    act(() => st().setLayout("3d"));
    key("m");
    expect(isMeasuring()).toBe(false);
  });

  it("ends a running operator first, and the tool when the plan goes", () => {
    let cancelled = 0;
    registerOperator(() => cancelled++);
    key("m");
    expect(cancelled).toBe(1);
    act(() => st().setLayout("elevations"));
    expect(isMeasuring()).toBe(false);
  });
});

describe("measuring", () => {
  beforeEach(() => {
    act(() => setMeasuring(true));
    mount();
  });

  it("measures between two snapped points and tells the result", () => {
    expect(st().status).toMatch(/ersten Punkt/);
    // The table's south-east corner, then the east wall.
    click(2210, 590);
    expect(st().status).toMatch(/Endpunkt/);
    click(7990, 2577);
    expect(st().status).toMatch(/^6\.127,7 mm \(ΔX 5\.800, ΔY 1\.977\)/);
    expect(host.querySelector(".plan-readout")!.textContent).toContain("ΔX 5.800");
    // The dimension line is drawn.
    expect(host.querySelectorAll("line").length).toBeGreaterThan(0);
    // The next click starts a new measurement.
    click(4000, 4000);
    expect(st().status).toMatch(/Endpunkt/);
  });

  it("holds 45° steps with Shift and snaps nothing with Alt", () => {
    click(1000, 3000, { altKey: true });
    click(7990, 3170, { shiftKey: true });
    expect(st().status).toMatch(/^7\.000 mm \(ΔX 7\.000, ΔY 0\)/);
    click(1234, 4321, { altKey: true });
    click(2345, 4321, { altKey: true });
    expect(st().status).toMatch(/^1\.111 mm/);
  });

  it("changes nothing in the project", () => {
    const before = st().project;
    click(2210, 590);
    click(7990, 2577);
    expect(st().project).toBe(before);
    expect(st().past.length).toBe(0);
  });

  it("ends with Escape, keeps the layout keys and holds the editing keys", () => {
    key("g");
    key("Delete");
    expect(isMeasuring()).toBe(true);
    key("2");
    expect(st().layout).toBe("elevations");
    act(() => st().setLayout("plan"));
    act(() => setMeasuring(true));
    key("Escape");
    expect(isMeasuring()).toBe(false);
    expect(st().status).toBeNull();
  });

  it("pans on a right drag and ends on a right click", () => {
    pointer("pointerdown", 1000, 1000, { button: 2 });
    pointer("pointermove", 2000, 1000, { button: 2 });
    pointer("pointerup", 2000, 1000, { button: 2 });
    expect(panned.length).toBeGreaterThan(0);
    expect(isMeasuring()).toBe(true);
    pointer("pointerdown", 1000, 1000, { button: 2 });
    pointer("pointerup", 1000, 1000, { button: 2 });
    expect(isMeasuring()).toBe(false);
  });
});
