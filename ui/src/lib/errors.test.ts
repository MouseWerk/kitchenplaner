// errorText against the error JSON of the Rust commands (src-tauri/src/lib.rs, `CmdError`). The
// kind names are a contract with kitchen_core::ErrorKind; this keeps the UI side of it honest.

import { afterEach, describe, expect, it } from "vitest";
import { ProjectError } from "../model/serialize";
import { errorText } from "./errors";
import { setLang, t, type TKey } from "./i18n";

const cmd = (kind: string, path: string | null = "Küche.kplan", detail: string | null = null) => ({ kind, path, detail });

describe("errorText", () => {
  afterEach(() => setLang("de"));

  it("maps every command error kind to its own text with the file name", () => {
    const cases: [string, TKey][] = [
      ["tooLarge", "error.tooLarge"],
      ["notUtf8", "error.notProjectFile"],
      ["notProject", "error.notProjectFile"],
      ["readOnly", "error.readOnly"],
      ["notFound", "error.notFound"],
      ["permissionDenied", "error.permissionDenied"],
      ["badExtension", "error.badExtension"],
      ["badPath", "error.badPath"],
    ];
    for (const [kind, key] of cases) {
      const text = errorText(cmd(kind));
      expect(text, kind).toBe(t(key, { name: "Küche.kplan" }));
      expect(text, kind).toContain("„Küche.kplan“");
    }
  });

  it("uses the language the user chose", () => {
    setLang("en");
    expect(errorText(cmd("readOnly"))).toBe("“Küche.kplan” is read-only. Save it under a different name.");
  });

  it("shows the OS text for the generic kind", () => {
    expect(errorText(cmd("io", "a.svg", "Das Gerät ist nicht bereit."))).toBe(t("error.generic", { message: "Das Gerät ist nicht bereit." }));
  });

  it("falls back to the generic text for unknown kinds and missing names", () => {
    expect(errorText(cmd("somethingNew", "a.kplan", "x"))).toBe(t("error.generic", { message: "x" }));
    expect(errorText(cmd("readOnly", null))).toBe(t("error.generic", { message: "readOnly" }));
  });

  it("keeps project parser errors and plain errors working", () => {
    expect(errorText(new ProjectError("error.tooNew", "version 9"))).toBe(t("error.tooNew"));
    expect(errorText(new Error("kaputt"))).toBe(t("error.generic", { message: "kaputt" }));
    expect(errorText("Zeichenkette")).toBe(t("error.generic", { message: "Zeichenkette" }));
  });
});
