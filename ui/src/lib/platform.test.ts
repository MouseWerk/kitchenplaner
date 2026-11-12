import { describe, expect, it } from "vitest";
import { MAX_FILE_STEM, mimeOf, PDF_FILTER, safeFileName } from "./platform";

describe("safeFileName", () => {
  it("replaces characters the file systems refuse and trims trailing dots and spaces", () => {
    expect(safeFileName('Küche: "Krone" 1/2')).toBe("Küche_ _Krone_ 1_2");
    expect(safeFileName("Plan. ")).toBe("Plan");
    expect(safeFileName("  ")).toBe("Kitchenplaner");
  });

  it("keeps the name short enough for every file system, without a trailing dot or space", () => {
    expect(safeFileName("K".repeat(300))).toBe("K".repeat(MAX_FILE_STEM));
    // Cut where a dot or space follows: those go too, as at the end of any name.
    expect(safeFileName(`${"K".repeat(MAX_FILE_STEM - 2)}. Kantine`)).toBe("K".repeat(MAX_FILE_STEM - 2));
    // A no-break space after the dot no longer keeps the dot.
    expect(safeFileName("Plan. ")).toBe("Plan");
    // Characters outside the BMP are not split in half.
    expect(safeFileName("\u{1d538}".repeat(200))).toBe("\u{1d538}".repeat(MAX_FILE_STEM));
  });

  it("keeps clear of the device names Windows reserves", () => {
    expect(safeFileName("CON")).toBe("CON_");
    expect(safeFileName("prn")).toBe("prn_");
    expect(safeFileName("Aux")).toBe("Aux_");
    expect(safeFileName("COM1")).toBe("COM1_");
    expect(safeFileName("LPT9")).toBe("LPT9_");
    expect(safeFileName("com¹")).toBe("com¹_");
    expect(safeFileName("CONIN$")).toBe("CONIN$_");
    expect(safeFileName("conout$")).toBe("conout$_");
    // The extension does not help: the stem before the first dot counts.
    expect(safeFileName("nul.txt")).toBe("nul_.txt");
    expect(safeFileName("nul.tar.gz")).toBe("nul_.tar.gz");
    expect(safeFileName("con .kplan")).toBe("con _.kplan");
  });

  it("leaves names that only contain a device name alone", () => {
    expect(safeFileName("Console")).toBe("Console");
    expect(safeFileName("COM10")).toBe("COM10");
    expect(safeFileName("Küche CON")).toBe("Küche CON");
    expect(safeFileName("my.con")).toBe("my.con");
  });
});

describe("file filters", () => {
  it("offers the plan set as PDF, downloaded in the browser as a PDF", () => {
    expect(PDF_FILTER.extensions).toEqual(["pdf"]);
    expect(mimeOf(PDF_FILTER)).toBe("application/pdf");
  });
});
