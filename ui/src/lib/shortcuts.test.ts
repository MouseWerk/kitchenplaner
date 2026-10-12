import { afterEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
vi.mock("./actions", () => ({
  saveFile: () => calls.push("save"),
  openFile: () => calls.push("open"),
  newFile: () => calls.push("new"),
}));

const { handleShortcut, isMac } = await import("./shortcuts");

afterEach(() => {
  calls.length = 0;
  document.body.innerHTML = "";
});

describe("file shortcuts", () => {
  it.each(["s", "o", "n"])("let a focused field apply its edit before Mod+%s runs", (k) => {
    const field = document.createElement("input");
    document.body.append(field);
    field.addEventListener("blur", () => calls.push("blur"));
    field.focus();
    const e = new KeyboardEvent("keydown", { key: k, ctrlKey: !isMac, metaKey: isMac, bubbles: true });
    field.dispatchEvent(e);
    expect(handleShortcut(e, () => {})).toBe(true);
    expect(calls).toEqual(["blur", k === "s" ? "save" : k === "o" ? "open" : "new"]);
  });
});
