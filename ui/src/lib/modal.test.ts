import { afterEach, describe, expect, it } from "vitest";
import { grabDelta, operatorKey, rotateAngle, startGrab, startRotate, type ModalOp } from "./modal";
import { setLang } from "./i18n";

afterEach(() => setLang("de"));

/** Feeds keys to an operator; returns the final operator or the confirm/cancel result. */
function keys(op: ModalOp, seq: string[]): ModalOp | "confirm" | "cancel" {
  let cur: ModalOp = op;
  for (const k of seq) {
    const r = operatorKey(cur, k);
    if (r === "confirm" || r === "cancel") return r;
    if (r) cur = r.op;
  }
  return cur;
}

describe("grab", () => {
  it("follows the mouse on the grid", () => {
    expect(grabDelta(startGrab({ x: 0, y: 0 }), { x: 123, y: -76 }, 50)).toEqual({ x: 100, y: -100 });
  });

  it("locks to an axis with X and frees it with a second X", () => {
    const op = keys(startGrab({ x: 0, y: 0 }), ["x"]) as ModalOp;
    expect(grabDelta(op as never, { x: 310, y: 900 }, 10)).toEqual({ x: 310, y: 0 });
    const free = keys(op, ["x"]) as ModalOp;
    expect(free.kind === "grab" && free.axis).toBe("free");
  });

  it("moves by a typed distance along the locked axis", () => {
    const op = keys(startGrab({ x: 0, y: 0 }), ["y", "5", "0", "0"]) as never;
    expect(grabDelta(op, { x: 40, y: -3 }, 50)).toEqual({ x: 0, y: 500 });
  });

  it("moves a typed distance the way the mouse pulled when no axis is locked", () => {
    const op = keys(startGrab({ x: 0, y: 0 }), ["5", "0", "0"]) as never;
    expect(grabDelta(op, { x: -80, y: 10 }, 50)).toEqual({ x: -500, y: 0 });
    expect(grabDelta(op, { x: 5, y: 200 }, 50)).toEqual({ x: 0, y: 500 });
  });

  it("reads typed decimals in the display language and toggles the sign", () => {
    setLang("de");
    const op = keys(startGrab({ x: 0, y: 0 }), ["x", "1", "2", ",", "5", "-"]) as never;
    expect(grabDelta(op, { x: 1, y: 0 }, 0)).toEqual({ x: -12.5, y: 0 });
  });

  it("edits the typed value with Backspace and ends with Enter or Escape", () => {
    const op = keys(startGrab({ x: 0, y: 0 }), ["x", "4", "5", "Backspace"]) as never;
    expect(grabDelta(op, { x: 1, y: 0 }, 0)).toEqual({ x: 4, y: 0 });
    expect(keys(op, ["Enter"])).toBe("confirm");
    expect(keys(op, ["Escape"])).toBe("cancel");
  });

  it("ignores keys that are not the operator's", () => {
    expect(operatorKey(startGrab({ x: 0, y: 0 }), "q")).toBeNull();
  });
});

describe("rotate", () => {
  const pivot = { x: 0, y: 0 };

  it("turns in 15 degree steps, clockwise on the plan", () => {
    const op = startRotate(pivot, { x: 100, y: 0 });
    // Down on screen (south) from east is a quarter turn clockwise.
    expect(rotateAngle(op, { x: 0, y: 100 }, false)).toBe(90);
    expect(rotateAngle(op, { x: 100, y: 30 }, false)).toBe(15);
    expect(rotateAngle(op, { x: 100, y: 30 }, true)).toBeCloseTo(16.7, 1);
  });

  it("uses a typed angle", () => {
    const op = keys(startRotate(pivot, { x: 100, y: 0 }), ["4", "5", "-"]) as never;
    expect(rotateAngle(op, { x: 0, y: 100 }, false)).toBe(-45);
  });

  it("does not lock axes", () => {
    expect(operatorKey(startRotate(pivot, { x: 1, y: 0 }), "x")).toBeNull();
  });
});
