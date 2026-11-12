import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Inspector } from "./Inspector";
import { formatCurrent } from "./PointsSection";
import { num, setLang } from "../lib/i18n";
import { estimateHeat } from "../model/heat";
import { itemPoints, setPoint } from "../model/points";
import { testItem, testProject } from "../model/testProject";
import type { Connections, Item } from "../model/types";
import { useStore } from "../store/store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root | null;
const st = () => useStore.getState();
const item = () => st().project.items[0];

/** An electric combi oven with cold water, softened water and a drain, unless `c` says otherwise. */
const COMBI: Connections = { electricKw: 18.9, voltage: 400, coldWater: true, softWater: true, drain: true };

function mountWith(it: Item) {
  st().load(testProject([it]), "/a.kplan");
  st().select({ items: [it.id] });
  root = createRoot(host);
  act(() => root!.render(createElement(Inspector)));
}
const combi = (over: Partial<Item> = {}) => testItem("c", "combi-10", 1000, 1000, 0, { connections: { ...COMBI }, ...over });

const rows = () => [...host.querySelectorAll<HTMLButtonElement>("button.point-row")];
const codes = () => rows().map((r) => r.querySelector(".point-code")!.textContent);
const row = (code: string) => rows().find((r) => r.querySelector(".point-code")!.textContent === code)!;
const button = (text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
/** The control a visible label names, or an input named by its aria-label. */
function control<T extends HTMLElement = HTMLInputElement>(name: string, within: ParentNode = host): T {
  const label = [...within.querySelectorAll("label")].find((l) => l.textContent === name);
  // A check box sits inside its label.
  const el = label ? (label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector("input")) : within.querySelector(`[aria-label="${name}"]`);
  if (!el) throw new Error(`no control „${name}“`);
  return el as T;
}
const panelOf = (r: HTMLButtonElement) => document.getElementById(r.getAttribute("aria-controls")!)!;

/** Types into a text input as the browser does and confirms with Enter. */
function enter(el: HTMLInputElement, text: string) {
  act(() => el.focus());
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, text);
  act(() => void el.dispatchEvent(new Event("input", { bubbles: true })));
  act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
}
function choose(el: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(el, value);
  act(() => void el.dispatchEvent(new Event("change", { bubbles: true })));
}
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

beforeEach(() => {
  setLang("de");
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host.remove();
  setLang("de");
});

describe("connection points in the inspector", () => {
  it("shows a row per active point, with trade, values in short and height", () => {
    mountWith(combi());
    expect(codes()).toEqual(["1.E", "1.KW", "1.EW", "1.AW"]);
    const e = row("1.E");
    expect(e.textContent).toContain("Elektro");
    expect(e.querySelector(".point-summary")!.textContent).toBe("400 V 3N~ · 27,3 A · 32 A · Festanschluss");
    const z = itemPoints(item()).find((p) => p.trade === "electric")!.z;
    expect(e.querySelector(".muted")!.textContent).toBe(`+${num(z)}`);
    expect(row("1.AW").querySelector(".point-summary")!.textContent).toMatch(/^DN \d+/);

    setLang("en");
    act(() => root!.render(createElement(Inspector)));
    expect(codes()).toEqual(["1.E", "1.CW", "1.SW", "1.WD"]);
  });

  it("shows no section for a unit without connections", () => {
    mountWith(testItem("t", "table", 1000, 1000, 0, { connections: {} }));
    expect(rows()).toEqual([]);
    expect(host.textContent).not.toContain("Anschlusspunkte");
  });

  it("shows the derived values as placeholders and a set value as the value, in a heavier weight", () => {
    mountWith(combi());
    act(() => row("1.E").click());
    const panel = panelOf(row("1.E"));
    const derived = itemPoints(item()).find((p) => p.trade === "electric")!;
    const left = control("Abstand links", panel);
    expect(left.value).toBe("");
    expect(left.placeholder).toBe(num(derived.fromLeft));
    expect(control("Strom", panel).placeholder).toBe("27,3");
    const fuse = control<HTMLSelectElement>("Absicherung", panel);
    expect(fuse.value).toBe("");
    expect(fuse.selectedOptions[0].textContent).toBe("32 A");
    expect(fuse.classList.contains("is-derived")).toBe(true);
    expect(left.closest(".num-input")!.classList.contains("is-set")).toBe(false);

    enter(left, "200");
    expect(left.value).toBe("200");
    expect(left.closest(".num-input")!.classList.contains("is-set")).toBe(true);
    expect(left.closest(".field")!.classList.contains("is-set")).toBe(true);
    expect(row("1.E").classList.contains("has-set")).toBe(true);
  });

  it("follows an overridden current with the derived fuse", () => {
    mountWith(combi({ points: { electric: { currentA: 40 } } }));
    act(() => row("1.E").click());
    const panel = panelOf(row("1.E"));
    expect(control("Strom", panel).value).toBe("40,0");
    // The fuse derives from the planner's current, not from the catalog's.
    expect(control<HTMLSelectElement>("Absicherung", panel).selectedOptions[0].textContent).toBe("40 A");
    // The current's own placeholder is still what the load derives to.
    expect(control("Strom", panel).placeholder).toBe("27,3");
  });

  it("writes an edit as an override in one undo step", () => {
    mountWith(combi());
    act(() => row("1.E").click());
    const steps = st().past.length;
    enter(control("Abstand links", panelOf(row("1.E"))), "200");
    expect(item().points).toEqual({ electric: { x: 200 } });
    expect(st().past.length).toBe(steps + 1);

    choose(control<HTMLSelectElement>("Absicherung", panelOf(row("1.E"))), "50");
    expect(item().points).toEqual({ electric: { x: 200, fuseA: 50 } });
    expect(st().past.length).toBe(steps + 2);
    // The first option gives the value back to the derivation.
    choose(control<HTMLSelectElement>("Absicherung", panelOf(row("1.E"))), "");
    expect(item().points).toEqual({ electric: { x: 200 } });

    act(() => st().undo());
    expect(item().points).toEqual({ electric: { x: 200, fuseA: 50 } });
    act(() => st().undo());
    act(() => st().undo());
    expect(item().points).toBeUndefined();
  });

  it("gives a field back to the derivation when it is emptied", () => {
    mountWith(combi({ points: { coldWater: { z: 600, dn: 20 } } }));
    act(() => row("1.KW").click());
    enter(control("Höhe ü. FFB", panelOf(row("1.KW"))), "");
    expect(item().points).toEqual({ coldWater: { dn: 20 } });
  });

  it("marks a greasy drain only where it differs from the catalog, and keeps the note", () => {
    mountWith(combi());
    act(() => row("1.AW").click());
    const panel = panelOf(row("1.AW"));
    const greasy = control("fetthaltig", panel);
    const derived = greasy.checked;
    act(() => greasy.click());
    expect(item().points?.drain?.greasy).toBe(!derived);
    act(() => control("fetthaltig", panelOf(row("1.AW"))).click());
    expect(item().points).toBeUndefined();

    const note = control("Bemerkung", panelOf(row("1.AW")));
    enter(note, "über Bodenrinne");
    expect(item().points).toEqual({ drain: { note: "über Bodenrinne" } });
  });

  it("resets one point, then all points, each in one undo step", async () => {
    const it0 = combi();
    mountWith({ ...it0, ...setPoint({ points: { electric: { x: 100, fuseA: 50 } } }, "coldWater", { z: 700 }) });
    act(() => row("1.E").click());
    const steps = st().past.length;
    const reset = [...panelOf(row("1.E")).querySelectorAll("button")].find((b) => b.textContent === "Zurücksetzen")!;
    act(() => reset.click());
    await settle();
    expect(item().points).toEqual({ coldWater: { z: 700 } });
    expect(st().past.length).toBe(steps + 1);
    // The reset button went with the overrides; the focus is back on the point's row.
    expect(document.activeElement).toBe(row("1.E"));
    expect([...panelOf(row("1.E")).querySelectorAll("button")].some((b) => b.textContent === "Zurücksetzen")).toBe(false);

    act(() => button("Alle Anschlusspunkte zurücksetzen")!.click());
    await settle();
    expect(item().points).toBeUndefined();
    expect(st().past.length).toBe(steps + 2);
    expect(button("Alle Anschlusspunkte zurücksetzen")).toBeUndefined();
    expect(host.contains(document.activeElement)).toBe(true);
  });

  it("opens and closes a point with a button the keyboard reaches", () => {
    mountWith(combi());
    const e = row("1.E");
    // A native button: Tab reaches it, Enter and Space press it.
    expect(e.tagName).toBe("BUTTON");
    expect(e.type).toBe("button");
    expect(e.tabIndex).toBe(0);
    expect(e.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(e.getAttribute("aria-controls")!)).toBeNull();
    act(() => e.focus());
    act(() => e.click());
    expect(e.getAttribute("aria-expanded")).toBe("true");
    const panel = panelOf(e);
    expect(panel.getAttribute("role")).toBe("group");
    // The panel follows its row, so Tab goes on from the row into the point's fields.
    expect(e.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.querySelector("input")).not.toBeNull();
    expect(document.activeElement).toBe(e);
    act(() => e.click());
    expect(e.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(e.getAttribute("aria-controls")!)).toBeNull();
  });
});

describe("connection values in the inspector", () => {
  it("adds the softened water point when „Enthärtetes Wasser“ is ticked, in one undo step", () => {
    mountWith(combi({ connections: { electricKw: 18.9, voltage: 400, coldWater: true, drain: true } }));
    expect(codes()).toEqual(["1.E", "1.KW", "1.AW"]);
    const steps = st().past.length;
    act(() => control("Enthärtetes Wasser").click());
    expect(item().connections.softWater).toBe(true);
    expect(codes()).toEqual(["1.E", "1.KW", "1.EW", "1.AW"]);
    expect(st().past.length).toBe(steps + 1);
  });

  it("drops a point's overrides with its connection, in the same undo step", () => {
    mountWith(combi({ points: { coldWater: { z: 700 }, electric: { x: 100 } } }));
    const steps = st().past.length;
    act(() => control("Kaltwasser").click());
    expect(item().points).toEqual({ electric: { x: 100 } });
    expect(st().past.length).toBe(steps + 1);
    act(() => st().undo());
    expect(item().points).toEqual({ coldWater: { z: 700 }, electric: { x: 100 } });
  });

  it("keeps supply air, steam and remote refrigeration behind a disclosure, open when one is set", () => {
    mountWith(combi());
    const more = button("Weitere Anschlüsse")!;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(() => control("Dampf (kg/h)")).toThrow();
    act(() => more.click());
    expect(more.getAttribute("aria-expanded")).toBe("true");
    enter(control("Dampf (kg/h)"), "12");
    expect(item().connections.steamKgH).toBe(12);
    expect(codes()).toContain("1.D");
    enter(control("Zuluft (m³/h)"), "400");
    enter(control("Kälte (Verbund, kW)"), "2");
    expect(codes()).toEqual(["1.E", "1.KW", "1.EW", "1.AW", "1.ZU", "1.D", "1.K"]);

    // Another unit with steam opens with the disclosure open.
    act(() => root!.unmount());
    mountWith(combi({ connections: { ...COMBI, steamKgH: 5 } }));
    expect(button("Weitere Anschlüsse")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the estimated heat release as placeholders and stores what the planner types", () => {
    mountWith(combi());
    const est = estimateHeat(item());
    const sensible = control("Wärmeabgabe sensibel (kW)");
    const latent = control("Wärmeabgabe latent (kW)");
    expect(sensible.value).toBe("");
    expect(sensible.placeholder).toBe(num(est.sensibleKw, 1));
    expect(latent.placeholder).toBe(num(est.latentKw, 1));
    enter(latent, "3,5");
    expect(item().heat).toEqual({ latentKw: 3.5 });
    expect(latent.closest(".num-input")!.classList.contains("is-set")).toBe(true);
    enter(control("Wärmeabgabe latent (kW)"), "");
    expect(item().heat).toBeUndefined();
  });
});

describe("tiny loads", () => {
  it("reads „< 0,1 A“, not „0 A“", () => {
    expect(formatCurrent(0, 0.01)).toBe("< 0,1 A");
    expect(formatCurrent(0, 0)).toBe("0,0 A");
    expect(formatCurrent(22.9, 15.9)).toBe("22,9 A");
    setLang("en");
    expect(formatCurrent(0, 0.01)).toBe("< 0.1 A");
  });

  it("shows the exit sign's 10 W as „< 0,1 A“ in its row and its current field", () => {
    mountWith(testItem("x", "exit-sign", 1000, 240));
    expect(row("1.E").querySelector(".point-summary")!.textContent).toBe("230 V 1N~ · < 0,1 A · 10 A · Festanschluss");
    act(() => row("1.E").click());
    expect(control("Strom", panelOf(row("1.E"))).placeholder).toBe("< 0,1");
  });
});
