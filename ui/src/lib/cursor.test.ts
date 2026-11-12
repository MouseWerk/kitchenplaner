import { afterEach, describe, expect, it, vi } from "vitest";
import { getCursor, setCursor, subscribeCursor } from "./cursor";

afterEach(() => setCursor(null));

describe("cursor", () => {
  it("tells its subscribers when it moves, and only then", () => {
    const f = vi.fn();
    const off = subscribeCursor(f);
    setCursor({ x: 100, y: 200 });
    expect(getCursor()).toEqual({ x: 100, y: 200 });
    expect(f).toHaveBeenCalledTimes(1);
    // The same place again (a new object from the next pointer event) changes nothing.
    setCursor({ x: 100, y: 200 });
    expect(f).toHaveBeenCalledTimes(1);
    setCursor(null);
    expect(getCursor()).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
    off();
    setCursor({ x: 1, y: 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });
});
