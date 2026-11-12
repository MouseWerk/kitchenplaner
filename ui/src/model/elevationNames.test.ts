import { describe, expect, it } from "vitest";
import { compassPoint, elevationName, elevationTitle, wallEntryLabel } from "./elevationNames";
import { testProject } from "./testProject";

describe("elevation names", () => {
  it("points to the nearest of eight compass points, north up on the plan", () => {
    expect(compassPoint({ x: 0, y: -1 })).toBe("north");
    expect(compassPoint({ x: 1, y: -1 })).toBe("northEast");
    expect(compassPoint({ x: 1, y: 0.1 })).toBe("east");
    expect(compassPoint({ x: -1, y: 1 })).toBe("southWest");
    expect(compassPoint({ x: -1, y: -1 })).toBe("northWest");
  });

  it("names a compass view by its direction and a wall view by the wall's number", () => {
    expect(elevationName("east", "de")).toBe("Ost");
    expect(elevationTitle("north", "de")).toBe("Ansicht Nord");
    expect(elevationTitle("wall-4", "de")).toBe("Ansicht Wand 5");
    expect(elevationTitle("wall-0", "en")).toBe("Elevation Wall 1");
  });

  it("lists a wall with the side it stands on and its length, a chamfer on its diagonal", () => {
    const room = testProject().room;
    expect(wallEntryLabel(room, 0, "de")).toBe("Wand 1 (Nord, 8.000 mm)");
    expect(wallEntryLabel(room, 1, "en")).toBe("Wall 2 (East, 6,000 mm)");
    room.points = [
      { x: 0, y: 0 },
      { x: 7000, y: 0 },
      { x: 8000, y: 1000 },
      { x: 8000, y: 6000 },
      { x: 0, y: 6000 },
    ];
    expect(wallEntryLabel(room, 1, "de")).toBe("Wand 2 (Nordost, 1.414 mm)");
  });
});
