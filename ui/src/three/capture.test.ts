import { afterEach, describe, expect, it, vi } from "vitest";
import { canCapture3d, capture3dPng, registerCapture, subscribeCapture } from "./capture";
import { setLang, t } from "../lib/i18n";

afterEach(() => setLang("de"));

describe("3D capture registry", () => {
  it("tells subscribers when a 3D view mounts and unmounts", async () => {
    const seen = vi.fn(() => canCapture3d());
    const off = subscribeCapture(seen);
    const unregister = registerCapture(async () => new Uint8Array([1]));
    expect(seen).toHaveLastReturnedWith(true);
    expect(await capture3dPng()).toEqual(new Uint8Array([1]));
    unregister();
    expect(seen).toHaveLastReturnedWith(false);
    expect(seen).toHaveBeenCalledTimes(2);
    off();
  });

  it.each(["de", "en"] as const)("explains in the display language that no 3D view is shown (%s)", async (lang) => {
    setLang(lang);
    await expect(capture3dPng()).rejects.toThrow(t("export.no3d", undefined, lang));
  });
});
