import { describe, expect, it } from "vitest";
import { safeFileName } from "./platform";

describe("safeFileName", () => {
  it("replaces characters the file systems refuse and trims trailing dots and spaces", () => {
    expect(safeFileName('Küche: "Krone" 1/2')).toBe("Küche_ _Krone_ 1_2");
    expect(safeFileName("Plan. ")).toBe("Plan");
    expect(safeFileName("  ")).toBe("Kitchenplaner");
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
