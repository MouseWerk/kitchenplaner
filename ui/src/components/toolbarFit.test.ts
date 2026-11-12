import { describe, expect, it } from "vitest";
import { TOOLBAR_LEVELS, toolbarLevel } from "./toolbarFit";

describe("toolbarLevel", () => {
  it("tries the full bar first, then each step it has not measured yet", () => {
    expect(toolbarLevel([], 500)).toBe(0);
    expect(toolbarLevel([966], 500)).toBe(1);
    expect(toolbarLevel([966, 814], 500)).toBe(2);
    expect(toolbarLevel([966, 814, 664, 544], 500)).toBe(4);
  });

  it("takes the least compact step that fits", () => {
    // Room mode at 1280 px: only the layout buttons give way.
    expect(toolbarLevel([966, 814, 664], 830)).toBe(1);
    // The window grows again: back to the full bar without trying anything.
    expect(toolbarLevel([966, 814, 664], 1000)).toBe(0);
    expect(toolbarLevel([966, 814, 664, 544], 600)).toBe(3);
  });

  it("stays at the most compact step when nothing fits", () => {
    expect(toolbarLevel([966, 814, 664, 544, 480], 100)).toBe(TOOLBAR_LEVELS);
  });
});
