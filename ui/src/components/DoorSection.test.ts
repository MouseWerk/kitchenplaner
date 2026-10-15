import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Inspector } from "./Inspector";
import { RoomEditLayer } from "../views/RoomEditLayer";
import { setLang } from "../lib/i18n";
import { handleShortcut } from "../lib/shortcuts";
import { testProject } from "../model/testProject";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root | null;
const st = () => useStore.getState();
const door = () => st().project.room.openings[0];

/** The select labelled `label` in the inspector. */
function selectOf(label: string): HTMLSelectElement {
  const l = [...host.querySelectorAll("label")].find((x) => x.textContent === label);
  if (!l) throw new Error(`no field ${label}`);
  return host.querySelector(`#${CSS.escape(l.htmlFor)}`) as HTMLSelectElement;
}

const optionTexts = (s: HTMLSelectElement) => [...s.options].map((o) => o.textContent);

function choose(s: HTMLSelectElement, value: string) {
  act(() => {
    s.value = value;
    s.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  setLang("de");
  host = document.createElement("div");
  document.body.append(host);
  st().load(testProject(), "/a.kplan");
  st().setMode("room");
  st().select({ corners: [], partitions: [], opening: "door1" });
  root = createRoot(host);
  act(() => root!.render(createElement(Inspector)));
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
});

describe("inspector door section", () => {
  it("offers the sliding door among the kinds and the door settings with their defaults", () => {
    expect(optionTexts(selectOf("Art"))).toContain("Schiebetür");
    // The test door is hinged at its start (east) and opens into the room: seen from inside, DIN links.
    expect(selectOf("Anschlag").selectedOptions[0].textContent).toBe("DIN links");
    expect(optionTexts(selectOf("Öffnet"))).toEqual(["nach innen", "nach außen"]);
    expect(selectOf("Flügel").value).toBe("1");
  });

  it("writes the hinge, the opening direction and the leaves, and names the hand from the new side", () => {
    choose(selectOf("Anschlag"), "end");
    expect(door().hinge).toBe("end");
    choose(selectOf("Öffnet"), "out");
    expect(door().swing).toBe("out");
    // Hinged at the west jamb, seen from outside looking north: on the left.
    expect(selectOf("Anschlag").selectedOptions[0].textContent).toBe("DIN links");
    choose(selectOf("Flügel"), "2");
    expect(door().leaves).toBe(2);
    expect(selectOf("Gangflügel")).toBeTruthy();
    // One undo step each.
    act(() => st().undo());
    expect(door().leaves).toBeUndefined();
  });

  it("names a partition door's sides by the compass and a sliding door's settings by what they do", () => {
    act(() => {
      st().change((p) => ({
        ...p,
        room: {
          ...p.room,
          partitions: [{ id: "n", a: { x: 3000, y: 0 }, b: { x: 3000, y: 4000 }, thickness: 100, height: 3000 }],
          openings: [{ ...p.room.openings[0], partition: "n", offset: 2000, width: 900, kind: "slidingDoor" }],
        },
      }));
    });
    expect(optionTexts(selectOf("Läuft auf"))).toEqual(["Ostseite", "Westseite"]);
    // Seen from the east face looking west, the start (north) is on the right.
    expect(optionTexts(selectOf("Öffnet nach"))).toEqual(["rechts", "links"]);
  });
});

describe("room mode door keys", () => {
  it("H flips the selected door's hinge side, Shift+H its opening direction; F still fits", () => {
    const layer = document.createElement("div");
    document.body.append(layer);
    const r = createRoot(layer);
    act(() => r.render(createElement(RoomEditLayer, { vp: { k: 0.1, ox: 0, oy: 0 }, width: 1000, height: 800, setVp: () => {} })));
    const press = (key: string, shiftKey = false) => act(() => void handleShortcut(new KeyboardEvent("keydown", { key, code: `Key${key.toUpperCase()}`, shiftKey, bubbles: true }), () => fits++));
    let fits = 0;
    press("h");
    expect(door().hinge).toBe("end");
    press("H", true);
    expect(door().swing).toBe("out");
    press("h");
    expect(door().hinge).toBe("start");
    press("f");
    expect(fits).toBe(1);
    // Without a door selected H does nothing.
    act(() => st().select({ corners: [], partitions: [], opening: null }));
    const before = st().project;
    press("h");
    expect(st().project).toBe(before);
    act(() => r.unmount());
    layer.remove();
  });
});
