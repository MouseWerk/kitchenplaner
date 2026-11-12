import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary, installErrorHandlers, thrownText } from "./ErrorBoundary";
import { setLang } from "../lib/i18n";
import { askUnsaved } from "../lib/unsaved";
import { newProject } from "../model/project";
import { useStore } from "../store/store";

const toast = vi.hoisted(() => vi.fn());
vi.mock("../lib/toast", () => ({ toast }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Broken(): never {
  throw new Error("kaputt");
}

describe("ErrorBoundary", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    setLang("de");
    useStore.getState().load(newProject(), null);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    // React reports the caught error on the console as well.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  const buttons = () => [...host.querySelectorAll("button")].map((b) => b.textContent);

  it("shows what happened and a reload instead of an empty window", () => {
    act(() => root.render(createElement(ErrorBoundary, null, createElement(Broken))));
    expect(host.querySelector("[role=alertdialog]")).not.toBeNull();
    expect(host.textContent).toContain("Hier ist etwas schiefgegangen");
    expect(host.textContent).toContain("Meldung: kaputt");
    expect(buttons()).toEqual(["Fenster neu laden"]);
  });

  it("offers to save unsaved changes first", () => {
    useStore.getState().updateRoom(() => ({ height: 2800 }));
    expect(useStore.getState().dirty).toBe(true);
    act(() => root.render(createElement(ErrorBoundary, null, createElement(Broken))));
    expect(host.textContent).toContain("ungespeicherte Änderungen");
    expect(buttons()).toEqual(["Speichern", "Fenster neu laden"]);
  });

  it("still asks about unsaved changes when the window closes after the crash", async () => {
    useStore.getState().updateRoom(() => ({ height: 2800 }));
    act(() => root.render(createElement(ErrorBoundary, null, createElement(Broken))));
    // The close guard (lib/closeGuard.ts) asks through the store of questions; the app that
    // showed them is gone.
    let answer: Promise<string> = Promise.resolve("");
    act(() => {
      answer = askUnsaved("Küche");
    });
    const question = host.querySelector("[role=dialog]");
    expect(question?.textContent).toContain("Küche");
    act(() => [...question!.querySelectorAll("button")].find((b) => b.textContent === "Abbrechen")!.click());
    expect(await answer).toBe("cancel");
    expect(host.querySelector("[role=dialog]")).toBeNull();
  });

  it("renders its children while nothing failed", () => {
    act(() => root.render(createElement(ErrorBoundary, null, createElement("p", null, "Grundriss"))));
    expect(host.textContent).toBe("Grundriss");
  });
});

describe("installErrorHandlers", () => {
  beforeEach(() => {
    setLang("de");
    toast.mockClear();
  });

  it("shows a rejected promise or a thrown handler nobody caught, each message once in a row", () => {
    const target = new EventTarget();
    const off = installErrorHandlers(target as unknown as Window);
    const rejection = (reason: unknown) => target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason }));
    rejection(new Error("Netz weg"));
    expect(toast).toHaveBeenCalledWith("Ein unerwarteter Fehler ist aufgetreten. Meldung: Netz weg", "danger");
    rejection(new Error("Netz weg"));
    expect(toast).toHaveBeenCalledTimes(1);
    target.dispatchEvent(Object.assign(new Event("error"), { error: new TypeError("x is undefined") }));
    expect(toast).toHaveBeenCalledTimes(2);
    // A notice without an error object (ResizeObserver loop) is no failure.
    target.dispatchEvent(Object.assign(new Event("error"), { error: null, message: "ResizeObserver loop completed with undelivered notifications." }));
    expect(toast).toHaveBeenCalledTimes(2);
    off();
    rejection(new Error("später"));
    expect(toast).toHaveBeenCalledTimes(2);
  });

  it("names what was thrown", () => {
    expect(thrownText(new Error("a"))).toBe("a");
    expect(thrownText("b")).toBe("b");
    expect(thrownText({ kind: "io", path: "/x.kplan", detail: "disk full" })).toBe("disk full");
    expect(thrownText(42)).toBe("42");
  });
});
