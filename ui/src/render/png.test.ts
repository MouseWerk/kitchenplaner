import { afterEach, describe, expect, it, vi } from "vitest";
import { errorText, UserError } from "../lib/errors";
import { setLang } from "../lib/i18n";
import { svgToPng } from "./png";

/** An image that never loads, as when the webview rejects the SVG. */
class BrokenImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_: string) {
    setTimeout(() => this.onerror?.(), 0);
  }
}

describe("svgToPng", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setLang("de");
  });

  it("fails with a message in the display language that says what to do next", async () => {
    vi.stubGlobal("Image", BrokenImage);
    const failed = await svgToPng("<svg/>", 100).catch((e: unknown) => e);
    expect(failed).toBeInstanceOf(UserError);
    expect((failed as UserError).key).toBe("error.pngFailed");

    setLang("de");
    const de = errorText(failed);
    expect(de).toContain("Exportiere stattdessen als SVG oder DXF");
    expect(de).not.toMatch(/PNG export|could not be loaded/);
    setLang("en");
    expect(errorText(failed)).toContain("Export as SVG or DXF instead");
  });
});
