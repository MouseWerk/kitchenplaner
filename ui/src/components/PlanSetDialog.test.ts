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
    for (const label of ["Grundriss", "Ansicht Nord", "Ansicht Ost", "Ansicht Süd", "Ansicht West", "Geräteliste"]) act(() => check(dialog, label).click());
    expect(dialog.textContent).toContain("Wähle mindestens ein Blatt.");
    expect(button(dialog, "Exportieren…")!.disabled).toBe(true);
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
    localStorage.setItem(KEY, JSON.stringify({ plan: true, elevations: [], list: false }));
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
