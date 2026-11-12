import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DateField, NumberField, parseNumber, TextField } from "./Fields";
import { formatDate, parseDate, setLang } from "../lib/i18n";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setLang("de");
});

const input = () => host.querySelector("input")!;

/** Types `text` into the input as the browser does: sets the value and fires `input`. */
function type(text: string) {
  const el = input();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, text);
  act(() => void el.dispatchEvent(new Event("input", { bubbles: true })));
}

const key = (k: string) => act(() => void input().dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
const focus = () => act(() => input().focus());
const blur = () => act(() => input().blur());

describe("NumberField", () => {
  it.each(["de", "en"] as const)("keeps the value when focused and left without typing (%s)", (lang) => {
    setLang(lang);
    const onChange = vi.fn();
    act(() => root.render(createElement(NumberField, { label: "Breite", value: 1200, onChange })));
    expect(input().value).toBe(lang === "de" ? "1.200" : "1,200");
    focus();
    blur();
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe(lang === "de" ? "1.200" : "1,200");
  });

  it("keeps a value with more decimals than shown when left untouched", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(NumberField, { label: "Breite", value: 600.25, onChange })));
    focus();
    blur();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies a typed value on Enter", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(NumberField, { label: "Breite", value: 1200, onChange })));
    focus();
    type("1.500");
    key("Enter");
    expect(onChange).toHaveBeenCalledWith(1500);
  });

  it("reverts the typed text on Escape", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(NumberField, { label: "Breite", value: 1200, onChange })));
    focus();
    type("700");
    key("Escape");
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("1.200");
    // The next edit commits normally again.
    focus();
    type("800");
    blur();
    expect(onChange).toHaveBeenCalledWith(800);
  });

  // A switch used to leave „3.200“ in an English field; leaving it read 3.2 and clamped to the minimum.
  it.each([
    ["de", "en", "3,200"],
    ["en", "de", "3.200"],
  ] as const)("shows the value in the new language after a switch (%s to %s) and changes nothing when left", (from, to, shown) => {
    setLang(from);
    const onChange = vi.fn();
    act(() => root.render(createElement(NumberField, { label: "Raumhöhe", value: 3200, min: 2000, onChange })));
    act(() => setLang(to));
    expect(input().value).toBe(shown);
    focus();
    blur();
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe(shown);
  });

  it("keeps the focus on Enter and shows the applied value", () => {
    let value = 1200;
    const onChange = vi.fn((v: number) => (value = v));
    const render = () => act(() => root.render(createElement(NumberField, { label: "Breite", value, max: 3000, onChange })));
    render();
    focus();
    type("5000");
    key("Enter");
    render();
    expect(onChange).toHaveBeenCalledWith(3000);
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("3.000");
    // Leaving afterwards applies nothing more.
    blur();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("leaves an Enter that confirms an input method's composition alone", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(NumberField, { label: "Breite", value: 1200, onChange })));
    focus();
    type("800");
    act(() => void input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true })));
    expect(onChange).not.toHaveBeenCalled();
    key("Enter");
    expect(onChange).toHaveBeenCalledWith(800);
  });

  it("steps from the shown value with the arrow keys", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(NumberField, { label: "Höhe", value: 1.234, digits: 3, step: 1, onChange })));
    focus();
    key("ArrowUp");
    expect(onChange).toHaveBeenCalledWith(2.234);
  });
});

describe("parseNumber", () => {
  it("reads the typographic minus as a minus", () => {
    expect(parseNumber("−500", "de")).toBe(-500);
    expect(parseNumber("−1.250,5", "de")).toBe(-1250.5);
  });

  it.each(["0x10", "1e3", "Infinity", "12abc", "-", "."])("refuses %j, which is no plain decimal", (text) => {
    expect(parseNumber(text, "en")).toBeNull();
  });
});

describe("TextField", () => {
  it("applies on Enter and keeps the focus", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(TextField, { label: "Name", value: "Küche", onChange })));
    focus();
    type("Bar");
    key("Enter");
    expect(onChange).toHaveBeenCalledWith("Bar");
    expect(document.activeElement).toBe(input());
  });

  it("reverts the typed text on Escape and applies nothing when left", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(TextField, { label: "Name", value: "Küche", onChange })));
    focus();
    type("Bar");
    key("Escape");
    expect(input().value).toBe("Küche");
    blur();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("DateField", () => {
  it.each([
    ["de", "13.10.2026", "TT.MM.JJJJ"],
    ["en", "2026-10-13", "YYYY-MM-DD"],
  ] as const)("shows the ISO date in the display language, not the system's (%s)", (lang, shown, placeholder) => {
    setLang(lang);
    act(() => root.render(createElement(DateField, { label: "Datum", value: "2026-10-13", onChange: () => {} })));
    expect(input().type).toBe("text");
    expect(input().value).toBe(shown);
    expect(input().placeholder).toBe(placeholder);
  });

  it("reads a typed date tolerantly and stores it as ISO", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(DateField, { label: "Datum", value: "2026-10-13", onChange })));
    focus();
    type("1.2.27");
    key("Enter");
    expect(onChange).toHaveBeenLastCalledWith("2027-02-01");
    act(() => root.render(createElement(DateField, { label: "Datum", value: "2027-02-01", onChange })));
    expect(input().value).toBe("01.02.2027");
  });

  it("puts the shown date back on Escape and for a text that is no date", () => {
    const onChange = vi.fn();
    act(() => root.render(createElement(DateField, { label: "Datum", value: "2026-10-13", onChange })));
    focus();
    type("14.10.2026");
    key("Escape");
    expect(input().value).toBe("13.10.2026");
    expect(onChange).not.toHaveBeenCalled();
    focus();
    type("31.02.2026");
    blur();
    expect(input().value).toBe("13.10.2026");
    expect(onChange).not.toHaveBeenCalled();
    // Left untouched: nothing changes. Emptied: no date.
    focus();
    blur();
    expect(onChange).not.toHaveBeenCalled();
    focus();
    type("");
    blur();
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("formatDate and parseDate", () => {
  it("formats per language and leaves anything else as it is", () => {
    expect(formatDate("2026-10-13", "de")).toBe("13.10.2026");
    expect(formatDate("2026-10-13", "en")).toBe("2026-10-13");
    expect(formatDate("", "de")).toBe("");
    expect(formatDate("Herbst", "de")).toBe("Herbst");
  });

  it.each([
    ["13.10.2026", "2026-10-13"],
    ["13.10.26", "2026-10-13"],
    [" 3. 1. 2027 ", "2027-01-03"],
    ["13/10/2026", "2026-10-13"],
    ["2026-10-13", "2026-10-13"],
    ["2026/1/3", "2026-01-03"],
    ["29.02.2028", "2028-02-29"],
    ["", ""],
  ])("reads %j as %j", (text, iso) => expect(parseDate(text)).toBe(iso));

  it.each(["29.02.2027", "32.01.2026", "13.13.2026", "10/13/2026", "13.10", "heute", "1.2.3.4"])("refuses %j", (text) => expect(parseDate(text)).toBeNull());
});
