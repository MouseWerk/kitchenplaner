import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BRUSH_LEVEL_ROWS, brushedSteelPixels, floorTilePixels, granitePixels, GROUT, MAX_ANISOTROPY, periodicNoise, random, TILE, TILES_PER_TEXTURE, toTexture, wallPaintPixels, woodPixels, type Pixels } from "./textures";

const at = (p: Pixels, x: number, y: number, ch = 1) => p.data[(y * p.width + x) * 4 + ch];

describe("procedural textures", () => {
  it("have the requested size, RGBA and full alpha", () => {
    for (const p of [brushedSteelPixels(64), floorTilePixels(128).color, floorTilePixels(128).rough, wallPaintPixels(32), granitePixels(32), woodPixels(32)]) {
      expect(p.data.length).toBe(p.width * p.height * 4);
      for (let i = 3; i < p.data.length; i += 4) expect(p.data[i]).toBe(255);
    }
    expect(brushedSteelPixels(64)).toMatchObject({ width: 64, height: 64 });
    expect(floorTilePixels(128).color).toMatchObject({ width: 128, height: 128 });
  });

  it("are deterministic: the same seed gives the same pixels", () => {
    expect(brushedSteelPixels(32, 3).data).toEqual(brushedSteelPixels(32, 3).data);
    expect(brushedSteelPixels(32, 3).data).not.toEqual(brushedSteelPixels(32, 4).data);
    expect(granitePixels(32, 3).data).toEqual(granitePixels(32, 3).data);
    expect(woodPixels(32, 3).data).toEqual(woodPixels(32, 3).data);
    const r = random(9);
    const s = random(9);
    expect([r(), r(), r()]).toEqual([s(), s(), s()]);
  });

  it("tile without seams: periodic noise repeats at its period", () => {
    const n = periodicNoise(8, 1);
    for (const [u, v] of [
      [0.3, 0.7],
      [2.5, 5.25],
      [7.9, 0.1],
    ]) {
      expect(n(u + 8, v)).toBeCloseTo(n(u, v), 10);
      expect(n(u, v + 8)).toBeCloseTo(n(u, v), 10);
    }
  });

  it("brushed steel varies more across the stroke than along it", () => {
    const p = brushedSteelPixels(128);
    let along = 0;
    let across = 0;
    for (let y = 0; y < 127; y++) {
      for (let x = 0; x < 127; x++) {
        along += Math.abs(at(p, x + 1, y) - at(p, x, y));
        across += Math.abs(at(p, x, y + 1) - at(p, x, y));
      }
    }
    expect(across).toBeGreaterThan(along * 3);
  });

  it("brushed steel has no slow bands across the stroke, which read as planks on a hood", () => {
    const size = 256;
    const p = brushedSteelPixels(size);
    const rowMean = Array.from({ length: size }, (_, y) => {
      let sum = 0;
      for (let x = 0; x < size; x++) sum += at(p, x, y);
      return sum / size;
    });
    // Means over bands of 16 rows (16 mm on a panel) stay within a few levels of each other.
    const bands = Array.from({ length: size / 16 }, (_, b) => rowMean.slice(b * 16, b * 16 + 16).reduce((a, v) => a + v, 0) / 16);
    expect(Math.max(...bands) - Math.min(...bands)).toBeLessThan(12);
    // The hairlines themselves stay faint: no row far from the mean roughness.
    const mean = rowMean.reduce((a, v) => a + v, 0) / size;
    for (const m of rowMean) expect(Math.abs(m - mean)).toBeLessThan(255 * 0.15);
  });

  it("brushed steel averages to an even value at every mip level a front is seen at from afar", () => {
    // The GPU's mipmaps box-filter 2^k × 2^k texels. Variation that neighbouring rows share (a 2D
    // noise across the stroke) survives that and shows as broad horizontal bands on a front seen
    // straight on; variation that is each row's own averages away.
    const size = 256;
    const p = brushedSteelPixels(size);
    for (let n = BRUSH_LEVEL_ROWS; n <= size / 4; n *= 2) {
      const level: number[] = [];
      for (let ty = 0; ty < size; ty += n) {
        for (let tx = 0; tx < size; tx += n) {
          let sum = 0;
          for (let y = ty; y < ty + n; y++) for (let x = tx; x < tx + n; x++) sum += at(p, x, y);
          level.push(sum / (n * n));
        }
      }
      // One level of 255 in the map is a roughness change of under 0.003; a grain with a 2D noise
      // across the stroke spreads 4 to 6 levels here.
      expect(Math.max(...level) - Math.min(...level), `${n} rows per texel`).toBeLessThan(3);
    }
  });

  it("floor tiles are 300 mm with darker grout lines on the tile grid", () => {
    expect(TILE).toBe(300);
    const size = 600;
    const { color, rough } = floorTilePixels(size);
    const pxPerMm = size / (TILE * TILES_PER_TEXTURE);
    const tileMid = Math.round((TILE / 2) * pxPerMm);
    const groutPx = 0;
    // The grout at a tile edge is darker than the middle of the tile, and rougher.
    expect(at(color, groutPx, tileMid, 0)).toBeLessThan(at(color, tileMid, tileMid, 0) - 40);
    expect(at(rough, groutPx, tileMid)).toBeGreaterThan(at(rough, tileMid, tileMid));
    // The second tile starts one tile width further.
    const second = Math.round(TILE * pxPerMm);
    expect(at(color, second, tileMid, 0)).toBeLessThan(at(color, tileMid, tileMid, 0) - 40);
    expect(GROUT * pxPerMm).toBeGreaterThan(1);
  });

  it("wraps into repeating, mipmapped textures: colour as sRGB, data linear", () => {
    const c = toTexture(floorTilePixels(64).color, true);
    const d = toTexture(brushedSteelPixels(16), false);
    expect(c.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(d.colorSpace).toBe(THREE.NoColorSpace);
    expect(c.wrapS).toBe(THREE.RepeatWrapping);
    expect(c.generateMipmaps).toBe(true);
    expect(c.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(d.anisotropy).toBe(MAX_ANISOTROPY);
    c.dispose();
    d.dispose();
  });

  it("granite is a dark ground with light grains; wood runs in staves along the grain", () => {
    const g = granitePixels(64);
    const values = Array.from({ length: 64 * 64 }, (_, i) => g.data[i * 4]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeLessThan(80);
    expect(Math.max(...values)).toBeGreaterThan(150);
    // Wood changes less along a row (the grain) than down a column (across the staves).
    const w = woodPixels(64);
    let along = 0;
    let across = 0;
    for (let y = 0; y < 63; y++) {
      for (let x = 0; x < 63; x++) {
        along += Math.abs(at(w, x + 1, y, 0) - at(w, x, y, 0));
        across += Math.abs(at(w, x, y + 1, 0) - at(w, x, y, 0));
      }
    }
    expect(across).toBeGreaterThan(along * 2);
  });
});
