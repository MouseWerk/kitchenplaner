import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setLang } from "../lib/i18n";
import { parseProject } from "../model/serialize";
import { useStore } from "../store/store";
import { readPdf } from "../render/testPdf";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The save dialog and the write command: what would be written.
const disk = vi.hoisted(() => ({ written: new Map<string, Uint8Array>() }));
vi.mock("../lib/platform", async (orig) => ({
  ...(await orig<typeof import("../lib/platform")>()),
  saveBinary: async (name: string, filter: { extensions: string[] }, data: Uint8Array) => {
    expect(filter.extensions).toEqual(["pdf"]);
    disk.written.set(`/${name}`, data);
    return `/${name}`;
  },
}));

const { PlanSetDialog } = await import("./PlanSetDialog");

const KEY = "kitchenplaner.planSet.v1";
/** The drawing and list sheets on by default, and the trade groups with points in the example. */
const SHEETS = ["Grundriss", "Ansicht Nord", "Ansicht Ost", "Ansicht Süd", "Ansicht West", "Geräteliste"];
const GROUPS = ["Elektro", "Sanitär", "Lüftung"];
const example = () => parseProject(readFileSync(resolve(__dirname, "../../../examples/Beispielkueche-Restaurant.kplan"), "utf8"));

describe("PlanSetDialog", () => {
  let host: HTMLDivElement;
  let root: Root;
  let closed: number;

  const mount = () => {
    act(() => root.render(createElement(PlanSetDialog, { onClose: () => closed++ })));
    return document.querySelector<HTMLElement>("[role=dialog]")!;
  };
  const select = (dialog: HTMLElement, label: string) => {
    const l = [...dialog.querySelectorAll("label")].find((x) => x.textContent === label)!;
    return dialog.querySelector<HTMLSelectElement>(`#${CSS.escape(l.htmlFor)}`)!;
  };
  const choose = (el: HTMLSelectElement, value: string) =>
    act(() => {
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  const button = (dialog: HTMLElement, text: string) => [...dialog.querySelectorAll("button")].find((b) => b.textContent === text);
  const check = (dialog: HTMLElement, text: string) => [...dialog.querySelectorAll<HTMLLabelElement>("label.check")].find((l) => l.textContent === text)!.querySelector("input")!;

  beforeEach(() => {
    setLang("de");
    localStorage.removeItem(KEY);
    disk.written.clear();
    useStore.getState().load(example(), null);
    closed = 0;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("is a labelled modal dialog that takes the focus and closes on Escape", () => {
    const dialog = mount();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe("Plansatz als PDF");
    expect(dialog.contains(document.activeElement)).toBe(true);
    act(() => dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(closed).toBe(1);
  });

  it("says when a fixed scale does not fit, offers one that does, and only then exports", () => {
    const dialog = mount();
    choose(select(dialog, "Papierformat"), "A4");
    choose(select(dialog, "Maßstab"), "20");
    expect(dialog.textContent).toContain("Grundriss passt bei 1:20 nicht auf A4.");
    expect(button(dialog, "Exportieren…")!.disabled).toBe(true);
    const use = [...dialog.querySelectorAll("button")].find((b) => /^1:\d+ verwenden$/.test(b.textContent ?? ""))!;
    expect(use).toBeDefined();
    const scale = use.textContent!.match(/1:(\d+)/)![1];
    act(() => use.click());
    expect(select(dialog, "Maßstab").value).toBe(scale);
    expect(dialog.textContent).not.toContain("nicht auf A4");
    expect(button(dialog, "Exportieren…")!.disabled).toBe(false);
  });

  it("needs at least one sheet and leaves the 3D page out without a 3D view", () => {
    const dialog = mount();
    expect(check(dialog, "3D").disabled).toBe(true);
    expect(dialog.textContent).toContain("Blende die 3D-Ansicht ein");
    for (const label of [...SHEETS, ...GROUPS]) act(() => check(dialog, label).click());
    expect(dialog.textContent).toContain("Wähle mindestens ein Blatt.");
    expect(button(dialog, "Exportieren…")!.disabled).toBe(true);
  });

  it("adds the elevations of single walls by a rule and remembers it", () => {
    let dialog = mount();
    const walls = select(dialog, "Ansichten einzelner Wände");
    // The example kitchen has no slanted wall: no extra sheet, no hint about them.
    expect(walls.value).toBe("slanted");
    expect([...walls.options].map((o) => o.textContent)).toEqual(["Keine", "Schräge Wände (0 Blätter)", "Jede Wand (6 Blätter)"]);
    expect(dialog.textContent).not.toContain("Schräge Wände sieht keine");
    for (const label of [...SHEETS, ...GROUPS]) act(() => check(dialog, label).click());
    expect(dialog.textContent).toContain("Wähle mindestens ein Blatt.");
    choose(walls, "all");
    expect(dialog.textContent).toContain("Ansicht Wand 6");
    expect(dialog.textContent).toContain("6 Blätter");
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ wallSheets: "all", elevations: [] });
    act(() => root.unmount());
    root = createRoot(host);
    // A chamfered corner: one slanted wall, and the hint why it gets a sheet of its own.
    const p = example();
    const [a, ...rest] = p.room.points;
    p.room.points = [{ x: a.x, y: a.y + 1000 }, { x: a.x + 1000, y: a.y }, ...rest];
    p.room.openings = [];
    useStore.getState().load(p, null);
    dialog = mount();
    expect(select(dialog, "Ansichten einzelner Wände").value).toBe("all");
    expect([...select(dialog, "Ansichten einzelner Wände").options].map((o) => o.textContent)).toContain("Schräge Wand (1 Blatt)");
    expect(dialog.textContent).toContain("Schräge Wände sieht keine der vier Ansichten von vorn");
  });

  it("remembers the choices on this computer", () => {
    let dialog = mount();
    choose(select(dialog, "Papierformat"), "A2");
    choose(select(dialog, "Ausrichtung"), "portrait");
    act(() => check(dialog, "Ansicht Ost").click());
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ paper: "A2", orientation: "portrait", elevations: ["north", "south", "west"] });
    act(() => root.unmount());
    root = createRoot(host);
    dialog = mount();
    expect(select(dialog, "Papierformat").value).toBe("A2");
    expect(select(dialog, "Ausrichtung").value).toBe("portrait");
    expect(check(dialog, "Ansicht Ost").checked).toBe(false);
  });

  it("prints names in the plan only when the dialog asks for them, whatever the view shows", async () => {
    const names = useStore.getState().project.items.map((i) => i.name);
    // Only the plan sheet; the view shows names, the plan set leaves them out by default.
    localStorage.setItem(KEY, JSON.stringify({ plan: true, installation: [], elevations: [], list: false }));
    useStore.getState().setPrefs({ showNames: true });
    const exportPlan = async (dialog: HTMLElement) => {
      await act(async () => button(dialog, "Exportieren…")!.click());
      await vi.waitFor(() => expect(closed).toBe(1));
      closed = 0;
      const texts = readPdf([...disk.written.values()][0]).pages[0].texts;
      disk.written.clear();
      return texts;
    };
    const without = await exportPlan(mount());
    expect(without.some((s) => names.includes(s))).toBe(false);

    act(() => root.unmount());
    root = createRoot(host);
    useStore.getState().setPrefs({ showNames: false });
    const dialog = mount();
    act(() => check(dialog, "Bezeichnungen im Grundriss").click());
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ names: true });
    const withNames = await exportPlan(dialog);
    expect(withNames.filter((s) => names.includes(s)).length).toBeGreaterThan(10);
  });

  it("offers an installation plan for each trade group with points, with its table, and remembers the choice", () => {
    let dialog = mount();
    // The example kitchen is all-electric, without steam or remote refrigeration.
    for (const g of GROUPS) expect(check(dialog, g)).toMatchObject({ checked: true, disabled: false });
    for (const g of ["Gas", "Kälte und Dampf"]) expect(check(dialog, g)).toMatchObject({ checked: false, disabled: true });
    expect(dialog.textContent).toContain("Gewerke ohne Anschlusspunkte bekommen kein Blatt.");
    expect(check(dialog, "Anschlusstabellen").checked).toBe(true);
    expect(dialog.textContent).toContain("Installationsplan Elektro: 1:");
    const sheets = () => Number(/(\d+) Blätter$/.exec(dialog.querySelector(".plan-set-status")!.textContent!)![1]);
    const all = sheets();

    act(() => check(dialog, "Elektro").click());
    expect(dialog.textContent).not.toContain("Installationsplan Elektro");
    const withoutElectric = sheets();
    expect(withoutElectric).toBeLessThan(all - 1);
    // The groups without points keep their choice for the next project.
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ installation: ["sanitary", "gas", "ventilation", "special"], pointTables: true });
    act(() => check(dialog, "Anschlusstabellen").click());
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ pointTables: false });
    // Two sheets left (Sanitär, Lüftung), each without its table pages now.
    expect(sheets()).toBeLessThan(withoutElectric);
    for (const g of ["Sanitär", "Lüftung"]) act(() => check(dialog, g).click());
    expect(dialog.textContent).not.toContain("Installationsplan");
    expect([...dialog.querySelectorAll("label.check")].some((l) => l.textContent === "Anschlusstabellen")).toBe(false);

    act(() => root.unmount());
    root = createRoot(host);
    dialog = mount();
    expect(check(dialog, "Elektro").checked).toBe(false);
    expect(check(dialog, "Sanitär").checked).toBe(false);
    act(() => check(dialog, "Sanitär").click());
    expect(check(dialog, "Anschlusstabellen").checked).toBe(false);
  });

  it("exports the installation plan and the connection table of a group", async () => {
    localStorage.setItem(KEY, JSON.stringify({ plan: false, installation: ["sanitary"], pointTables: true, elevations: [], wallSheets: "none", list: false }));
    const dialog = mount();
    expect(dialog.textContent).toContain("Installationsplan Sanitär: 1:");
    await act(async () => button(dialog, "Exportieren…")!.click());
    await vi.waitFor(() => expect(closed).toBe(1));
    const pages = readPdf([...disk.written.values()][0]).pages.map((p) => p.texts);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0]).toContain("Installationsplan Sanitär");
    expect(pages[0]).toContain("Legende");
    for (const p of pages.slice(1)) expect(p).toContain("Anschlusstabelle Sanitär");
  });

  it("writes the plan set as PDF and closes", async () => {
    const dialog = mount();
    act(() => check(dialog, "Ansicht Ost").click());
    await act(async () => button(dialog, "Exportieren…")!.click());
    await vi.waitFor(() => expect(closed).toBe(1));
    const [path, bytes] = [...disk.written][0];
    expect(path).toBe("/Beispielküche Restaurant Lindenhof - Plansatz.pdf");
    const pdf = readPdf(bytes);
    const titles = pdf.pages.map((p) => p.texts.join("\n"));
    expect(titles[0]).toContain("Grundriss");
    // Plan, three elevations, the list pages.
    expect(titles.filter((s) => s.includes("Ansicht ")).length).toBe(3);
    expect(titles.some((s) => s.includes("Ansicht Ost"))).toBe(false);
    expect(titles[titles.length - 1]).toContain("Geräteliste");
  });
});
