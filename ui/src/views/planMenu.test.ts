import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PlanView } from "./PlanView";
import { RoomEditLayer } from "./RoomEditLayer";
import { arrangeMenu, roomMenu } from "./planMenu";
import { ContextMenu, type ContextEntry } from "../components/ContextMenu";
import { setLang } from "../lib/i18n";
import { isMeasuring, setMeasuring } from "../lib/measureTool";
import { handleShortcut } from "../lib/shortcuts";
import type { RoomHit } from "../model/roomEdit";
import { testItem, testProject } from "../model/testProject";
import type { Vec2 } from "../model/types";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root | null = null;
const st = () => useStore.getState();
const menu = () => document.querySelector<HTMLElement>("[role=menu]");
const items = () => [...(menu()?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
const labels = (entries: ContextEntry[]) => entries.map((e) => (e === "sep" ? "—" : e.label));
const entry = (entries: ContextEntry[], label: string) => entries.find((e) => e !== "sep" && e.label === label) as Exclude<ContextEntry, "sep">;
const run = (e: Exclude<ContextEntry, "sep">) => act(() => ("onSelect" in e ? e.onSelect() : undefined));

function render(el: ReactElement) {
  root = createRoot(host);
  act(() => root!.render(el));
}

function pointer(target: Element, type: string, x: number, y: number, button: number) {
  act(() => void target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button, pointerId: 1 })));
}

beforeEach(() => {
  setLang("de");
  Element.prototype.setPointerCapture ??= () => {};
  st().load(
    testProject([testItem("a", "table", 1000, 1000, 0, { width: 600, depth: 600 }), testItem("b", "table", 3000, 2000, 0, { width: 1200, depth: 700 }), testItem("c", "table", 2000, 1500, 0, { width: 400, depth: 400 })]),
    null,
  );
  st().setMode("arrange");
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  act(() => setMeasuring(false));
});

describe("the arrange menu", () => {
  it("offers select all and measuring with nothing selected", () => {
    expect(labels(arrangeMenu())).toEqual(["Alles auswählen", "Messen"]);
    run(entry(arrangeMenu(), "Alles auswählen"));
    expect(st().selection.items).toEqual(["a", "b", "c"]);
    act(() => st().select({ items: [] }));
    run(entry(arrangeMenu(), "Messen"));
    expect(isMeasuring()).toBe(true);
  });

  it("offers the commands for the selection, aligning only for two or more", () => {
    act(() => st().select({ items: ["a"] }));
    expect(labels(arrangeMenu())).not.toContain("Ausrichten und verteilen");
    run(entry(arrangeMenu(), "90° nach rechts drehen"));
    expect(st().project.items[0].rotation).toBe(90);
    act(() => st().select({ items: ["a", "b"] }));
    const align = entry(arrangeMenu(), "Ausrichten und verteilen") as { children: ContextEntry[] };
    // Two items have one gap: nothing to distribute.
    expect(entry(align.children, "Waagrecht gleichmäßig verteilen")).toMatchObject({ disabled: true });
    const past = st().past.length;
    run(entry(align.children, "Oben ausrichten"));
    expect(st().past.length).toBe(past + 1);
    run(entry(arrangeMenu(), "Löschen"));
    expect(st().project.items.map((i) => i.id)).toEqual(["c"]);
  });
});

describe("the room menu", () => {
  it("inserts a corner where the wall was clicked", () => {
    const hit: RoomHit = { kind: "wall", index: 0 };
    const menuEntries = roomMenu({ x: 3020, y: 5 }, hit);
    expect(labels(menuEntries)[0]).toBe("Ecke einfügen");
    run(entry(menuEntries, "Ecke einfügen"));
    expect(st().project.room.points).toHaveLength(5);
    expect(st().project.room.points[1]).toEqual({ x: 3000, y: 0 });
    expect(st().past.length).toBe(1);
  });

  it("flips a selected door's hinge and swing", () => {
    act(() => st().setMode("room"));
    act(() => st().select({ opening: "door1" }));
    const m = roomMenu({ x: 1200, y: 6000 }, { kind: "opening", id: "door1" } as RoomHit);
    run(entry(m, "Anschlag wechseln"));
    expect(st().project.room.openings[0].hinge).toBe("end");
    run(entry(m, "Aufschlagrichtung wechseln"));
    expect(st().project.room.openings[0].swing).toBe("out");
    run(entry(roomMenu({ x: 0, y: 0 }, null), "Löschen"));
    expect(st().project.room.openings).toHaveLength(0);
  });

  it("opens from a right click without moving in the room mode; a right drag pans", () => {
    act(() => st().setMode("room"));
    const opened: { at: Vec2; world: Vec2; hit: RoomHit | null }[] = [];
    const pans: unknown[] = [];
    const VP = { k: 0.1, ox: 0, oy: 0 };
    render(createElement(RoomEditLayer, { vp: VP, width: 1000, height: 800, setVp: (v) => void pans.push(v), onMenu: (at, world, hit) => void opened.push({ at, world, hit }) }));
    const svg = host.querySelector("svg")!;
    // On the east wall (x 8000 mm = 800 px).
    pointer(svg, "pointerdown", 800, 300, 2);
    pointer(svg, "pointerup", 800, 300, 2);
    expect(opened).toHaveLength(1);
    expect(opened[0].hit).toEqual({ kind: "wall", index: 1 });
    // The wall under the pointer is selected first: both its corners.
    expect(st().selection.corners).toEqual([1, 2]);
    pointer(svg, "pointerdown", 400, 300, 2);
    pointer(svg, "pointermove", 450, 300, 2);
    pointer(svg, "pointerup", 450, 300, 2);
    expect(opened).toHaveLength(1);
    expect(pans.length).toBeGreaterThan(0);
  });
});

describe("the plan", () => {
  const rect = HTMLElement.prototype.getBoundingClientRect;
  const observer = globalThis.ResizeObserver;
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = rect;
    globalThis.ResizeObserver = observer;
  });

  beforeEach(() => {
    // happy-dom lays nothing out: the plan pane gets a size, and its observer fires once.
    globalThis.ResizeObserver = class {
      constructor(private cb: ResizeObserverCallback) {}
      observe() {
        this.cb([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) });
    // One big unit in the middle of the room, under the middle of the pane.
    st().load(testProject([testItem("big", "table", 4000, 3000, 0, { width: 6000, depth: 4000 })]), null);
  });

  it("opens the menu on a right click on an item, selecting it; a right drag only pans", () => {
    render(createElement(PlanView, { fitSignal: 0 }));
    const svg = host.querySelector(".view2d svg")!;
    pointer(svg, "pointerdown", 500, 400, 2);
    pointer(svg, "pointermove", 560, 400, 2);
    pointer(svg, "pointerup", 560, 400, 2);
    expect(menu()).toBeNull();
    pointer(svg, "pointerdown", 500, 400, 2);
    pointer(svg, "pointerup", 500, 400, 2);
    expect(menu()).not.toBeNull();
    expect(st().selection.items).toEqual(["big"]);
    expect(items()[0].textContent).toContain("Duplizieren");
    // The shortcuts wait while the menu is open; Escape closes it.
    act(() => void handleShortcut(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }), () => {}));
    expect(st().project.items).toHaveLength(1);
    act(() => void menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(menu()).toBeNull();
  });

  it("shows the measure layer while the tool is on", () => {
    render(createElement(PlanView, { fitSignal: 0 }));
    expect(host.querySelector(".measure-layer")).toBeNull();
    act(() => setMeasuring(true));
    expect(host.querySelector(".measure-layer")).not.toBeNull();
  });
});

describe("ContextMenu", () => {
  it("moves with the arrows, opens a sub-list and goes back, picks with a click", () => {
    const picked: string[] = [];
    let closed = 0;
    const entries: ContextEntry[] = [
      { label: "Eins", onSelect: () => picked.push("eins") },
      { label: "Mehr", children: [{ label: "Zwei", onSelect: () => picked.push("zwei") }] },
    ];
    render(createElement(ContextMenu, { at: { x: 10, y: 10 }, entries, label: "Menü", backLabel: "Zurück", onClose: () => closed++ }));
    expect(document.activeElement).toBe(items()[0]);
    act(() => void menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(document.activeElement).toBe(items()[1]);
    act(() => items()[1].click());
    expect(items().map((b) => b.textContent)).toEqual(["Zurück", "Zwei"]);
    act(() => void menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(items().map((b) => b.textContent)).toEqual(["Eins", "Mehr"]);
    act(() => items()[0].click());
    expect(picked).toEqual(["eins"]);
    expect(closed).toBe(1);
  });
});
