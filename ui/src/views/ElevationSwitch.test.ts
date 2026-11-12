import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setLang } from "../lib/i18n";
import { resolveElevation, wallElevation, type ElevationId } from "../model/elevation";
import { testProject } from "../model/testProject";
import { useStore } from "../store/store";
import { ElevationSwitch } from "./ElevationView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ElevationSwitch", () => {
  let host: HTMLDivElement;
  let root: Root;
  let chosen: ElevationId[];

  const mount = (value: ElevationId) => {
    act(() => root.render(createElement(ElevationSwitch, { value, onChange: (id: ElevationId) => chosen.push(id) })));
  };
  const menuButton = () => host.querySelector<HTMLButtonElement>("[aria-haspopup=menu]")!;
  const open = () => {
    act(() => menuButton().click());
    return [...document.querySelectorAll<HTMLElement>("[role=menu] > *")].map((e) => (e.getAttribute("role") === "separator" ? "—" : `${e.getAttribute("aria-checked") === "true" ? "* " : ""}${e.querySelector(".menu-label")?.textContent}`));
  };
  const entry = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]")].find((e) => e.querySelector(".menu-label")?.textContent === label)!;

  beforeEach(() => {
    setLang("de");
    const p = testProject();
    // The north-east corner chamfered: wall 2 („Wand 2“) is the 45° chamfer.
    p.room.points = [
      { x: 0, y: 0 },
      { x: 7000, y: 0 },
      { x: 8000, y: 1000 },
      { x: 8000, y: 6000 },
      { x: 0, y: 6000 },
    ];
    p.room.openings = [];
    useStore.getState().load(p, null);
    chosen = [];
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("is one menu button with the four compass views and every wall", () => {
    mount("north");
    expect(host.querySelectorAll("button")).toHaveLength(1);
    expect(menuButton().textContent).toBe("Nord");
    expect(menuButton().title).toBe("Blickrichtung");
    expect(open()).toEqual(["* Nord", "Ost", "Süd", "West", "—", "Wand 1 (Nord, 7.000 mm)", "Wand 2 (Nordost, 1.414 mm)", "Wand 3 (Ost, 5.000 mm)", "Wand 4 (Süd, 8.000 mm)", "Wand 5 (West, 6.000 mm)"]);
    act(() => entry("Wand 2 (Nordost, 1.414 mm)").click());
    expect(chosen).toEqual(["wall-1"]);
  });

  it("shows a chosen wall on the button and checks it in the menu", () => {
    mount("wall-1");
    expect(menuButton().textContent).toBe("Wand 2");
    expect(open().filter((e) => e.startsWith("* "))).toEqual(["* Wand 2 (Nordost, 1.414 mm)"]);
    act(() => entry("Ost").click());
    expect(chosen).toEqual(["east"]);
  });

  it("shows the north view for a wall that no longer exists", () => {
    mount("wall-9");
    expect(menuButton().textContent).toBe("Nord");
  });

  it("lists only the walls an elevation can draw", () => {
    // A doubled corner makes a wall shorter than the geometry's tolerance: no view of its own.
    const p = useStore.getState().project;
    useStore.getState().load({ ...p, room: { ...p.room, points: [{ x: 0, y: 0 }, { x: 0, y: 1e-7 }, { x: 8000, y: 0 }, { x: 8000, y: 6000 }, { x: 0, y: 6000 }] } }, null);
    mount("north");
    const walls = open().filter((e) => e.startsWith("Wand"));
    expect(walls.map((w) => w.split(" (")[0])).toEqual(["Wand 2", "Wand 3", "Wand 4", "Wand 5"]);
    // Each listed wall is a view of its own, never the north fallback.
    const room = useStore.getState().project.room;
    for (const i of [1, 2, 3, 4]) expect(resolveElevation(room, wallElevation(i))).toBe(wallElevation(i));
    expect(resolveElevation(room, wallElevation(0))).toBe("north");
  });
});
