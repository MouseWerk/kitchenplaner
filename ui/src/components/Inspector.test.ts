import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Inspector } from "./Inspector";
import { setLang } from "../lib/i18n";
import { testItem, testProject } from "../model/testProject";
import type { Opening } from "../model/types";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root | null;
const st = () => useStore.getState();

const labels = () => [...host.querySelectorAll("label")].map((l) => l.textContent);
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const rows = () => [...host.querySelectorAll<HTMLButtonElement>("button.opening-row")];
/** Waits for the focus move, which runs after React has put the new panel in place. */
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));
const focused = () => document.activeElement as HTMLElement | null;
/** The text of the focused panel heading, or null when the focus is anywhere else. */
const onHeading = () => (focused()?.matches(".insp-name, h3") ? focused()!.textContent : null);

function mount() {
  root = createRoot(host);
  act(() => root!.render(createElement(Inspector)));
}

beforeEach(() => {
  setLang("de");
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

describe("inspector opening list", () => {
  it("names the kind first and the width with its unit, the host only where the list spans several", () => {
    st().load(testProject(), "/a.kplan");
    mount();
    expect(rows().map((r) => [...r.children].map((c) => c.textContent))).toEqual([["Tür", "Wand 3 (Süd) · 1.010 mm"]]);
    expect(rows()[0].title).toBe("Tür: Wand 3 (Süd) · 1.010 mm");

    setLang("en");
    act(() => root!.render(createElement(Inspector)));
    expect(rows()[0].textContent).toBe("DoorWall 3 (South) · 1,010 mm");

    // In the wall's own panel the host is the panel itself.
    setLang("de");
    act(() => {
      st().setMode("room");
      st().select({ corners: [2, 3], partitions: [] });
    });
    expect(rows().map((r) => r.textContent)).toEqual(["Tür1.010 mm"]);
  });

  it("moves the focus into the opening's panel when a row is activated", async () => {
    st().load(testProject(), "/a.kplan");
    mount();
    act(() => rows()[0].click());
    await settle();
    expect(st().selection.opening).toBe("door1");
    expect(host.contains(focused())).toBe(true);
    expect(onHeading()).toBe("Tür");
  });
});

describe("inspector opening panel", () => {
  const withOpening = (o: Partial<Opening>) => {
    const p = testProject();
    p.room.openings = [{ ...p.room.openings[0], ...o }];
    st().load(p, "/a.kplan");
    st().select({ corners: [], partitions: [], opening: "door1" });
    mount();
  };

  it("shows no sill for doors, sliding doors and passages, which stand on the floor", () => {
    for (const kind of ["door", "slidingDoor", "passage"] as const) {
      withOpening({ kind, sill: 0 });
      expect(labels(), kind).not.toContain("Brüstungshöhe");
      act(() => root!.unmount());
    }
    root = null;
  });

  it("shows the sill for windows and hatches, and for a door that has one", () => {
    withOpening({ kind: "window", sill: 900 });
    expect(labels()).toContain("Brüstungshöhe");
    act(() => root!.unmount());
    withOpening({ kind: "hatch", sill: 900 });
    expect(labels()).toContain("Brüstungshöhe");
    act(() => root!.unmount());
    // A sill read from a file stays visible, so it can be put back to 0.
    withOpening({ kind: "door", sill: 150 });
    expect(labels()).toContain("Brüstungshöhe");
  });
});

describe("inspector focus after a panel change", () => {
  it("moves the focus to the item's panel when a plan-check finding is activated", async () => {
    st().load(testProject([testItem("a", "table", 3000, 3000), testItem("b", "table", 3000, 3000)]), "/a.kplan");
    st().select({ items: [] });
    mount();
    const finding = [...host.querySelectorAll<HTMLButtonElement>("button.notice.warn")].find((b) => b.textContent?.includes("überschneiden sich"));
    expect(finding).toBeTruthy();
    act(() => finding!.click());
    await settle();
    expect(st().selection.items).toEqual(["a", "b"]);
    expect(host.contains(focused())).toBe(true);
    // Not into the name field: G would type there instead of moving the units.
    expect(onHeading()).toBe("2 Geräte ausgewählt");
  });

  it("keeps the focus in the inspector after „Löschen“", async () => {
    st().load(testProject([testItem("a", "table", 3000, 3000)]), "/a.kplan");
    st().select({ items: ["a"] });
    mount();
    const del = button("Löschen")!;
    del.focus();
    act(() => del.click());
    await settle();
    expect(st().project.items).toEqual([]);
    // The project panel follows; its heading has the focus instead of the page, and not its first
    // field, where Ctrl+Z would undo the field's text instead of the deletion.
    expect(host.contains(focused())).toBe(true);
    expect(onHeading()).toBe("Projekt");
  });

  it("keeps the focus in the inspector after deleting an opening in the room mode", async () => {
    st().load(testProject(), "/a.kplan");
    st().setMode("room");
    st().select({ corners: [], partitions: [], opening: "door1" });
    mount();
    act(() => button("Löschen")!.click());
    await settle();
    expect(st().project.room.openings).toEqual([]);
    expect(host.contains(focused())).toBe(true);
    expect(focused()!.matches("input, select, textarea")).toBe(false);
  });
});
