// Procedural textures for the 3D view: brushed steel, floor tiles and wall paint, generated as
// pixel data (no canvas, no image files), so they are deterministic, tileable, testable without
// a browser and cost nothing to load. Each generator returns RGBA bytes; `toTexture` wraps them
// in a repeating, mipmapped three.js texture.

import * as THREE from "three";

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, row by row from the top, 4 bytes per pixel. */
  data: Uint8Array;
}

/** A small deterministic random generator (mulberry32): the same seed gives the same texture. */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Smooth value noise that repeats every `period` lattice cells in both directions, so a texture
 * built from it tiles without seams. Returns a function of (u, v) in lattice units, 0..1.
 */
export function periodicNoise(period: number, seed: number): (u: number, v: number) => number {
  const rnd = random(seed);
  const lattice = Array.from({ length: period * period }, () => rnd());
  const at = (i: number, j: number) => lattice[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (u, v) => {
    const i = Math.floor(u);
    const j = Math.floor(v);
    const fu = smooth(u - i);
    const fv = smooth(v - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
    return a + (b - a) * fv;
  };
}

const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function pixels(width: number, height: number, f: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = f(x, y);
      const o = (y * width + x) * 4;
      data[o] = clampByte(r);
      data[o + 1] = clampByte(g);
      data[o + 2] = clampByte(b);
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

/**
 * Brushed stainless steel as a roughness map (three reads the green channel): fine streaks
 * along x, each row a little smoother or rougher, slowly changing along the stroke. The
 * streaks make the reflection smear sideways like real grain, without an anisotropic shader.
 */
export function brushedSteelPixels(size = 256, seed = 7): Pixels {
  const rnd = random(seed);
  // One value per row (the stroke), plus a gentle variation along it.
  const rows = Array.from({ length: size }, () => rnd());
  const along = periodicNoise(8, seed + 1);
  const across = periodicNoise(16, seed + 2);
  return pixels(size, size, (x, y) => {
    const streak = rows[y] * 0.6 + rows[(y + 1) % size] * 0.4;
    const v = 0.5 + (streak - 0.5) * 0.55 + (along((x / size) * 8, (y / size) * 8) - 0.5) * 0.25 + (across(0, (y / size) * 16) - 0.5) * 0.2;
    const g = 255 * v;
    return [g, g, g];
  });
}

/** Size of one floor tile and the grout between tiles (mm). */
export const TILE = 300;
export const GROUT = 4;
/** Tiles per texture edge: the texture repeats every `TILES_PER_TEXTURE * TILE` mm. */
export const TILES_PER_TEXTURE = 2;

/**
 * Anti-slip quarry tiles (300 × 300 mm) with grout, as a colour map and a matching
 * roughness/bump map. Each tile has its own slight shade, the surface a fine grain.
 * `size` pixels cover `TILES_PER_TEXTURE` tiles in each direction.
 */
export function floorTilePixels(size = 512, seed = 11): { color: Pixels; rough: Pixels } {
  const rnd = random(seed);
  const shade = Array.from({ length: TILES_PER_TEXTURE * TILES_PER_TEXTURE }, () => rnd() - 0.5);
  const grain = random(seed + 1);
  const cloud = periodicNoise(16, seed + 2);
  const mmPerPx = (TILES_PER_TEXTURE * TILE) / size;
  const grain2 = new Float32Array(size * size).map(() => grain());
  const groutAt = (x: number, y: number) => {
    const gx = (x * mmPerPx) % TILE;
    const gy = (y * mmPerPx) % TILE;
    const half = GROUT / 2;
    return gx < half || gx > TILE - half || gy < half || gy > TILE - half;
  };
  const tileOf = (x: number, y: number) => Math.floor((y * mmPerPx) / TILE) * TILES_PER_TEXTURE + Math.floor((x * mmPerPx) / TILE);
  // Warm light gray tiles, darker gray grout (sRGB values).
  const color = pixels(size, size, (x, y) => {
    if (groutAt(x, y)) return [118, 116, 112];
    const c = cloud((x / size) * 16, (y / size) * 16) - 0.5;
    const n = grain2[y * size + x] - 0.5;
    const v = 192 + shade[tileOf(x, y)] * 14 + c * 10 + n * 8;
    return [v + 2, v, v - 4];
  });
  // Grout is rough and sits lower; the tile surface is a little rough with a fine grain.
  const rough = pixels(size, size, (x, y) => {
    if (groutAt(x, y)) return [40, 245, 0];
    const n = grain2[y * size + x];
    return [200 + n * 55, 150 + n * 60, 0];
  });
  return { color, rough };
}

/** Matt wall paint: a faint roller texture for the bump map, otherwise flat. */
export function wallPaintPixels(size = 128, seed = 23): Pixels {
  const fine = periodicNoise(32, seed);
  const coarse = periodicNoise(8, seed + 1);
  return pixels(size, size, (x, y) => {
    const u = x / size;
    const v = y / size;
    const g = 128 + (fine(u * 32, v * 32) - 0.5) * 70 + (coarse(u * 8, v * 8) - 0.5) * 40;
    return [g, g, g];
  });
}

/**
 * A repeating, mipmapped texture from pixel data. Colour maps are sRGB, data maps (roughness,
 * bump) linear. The caller owns it and disposes it.
 */
export function toTexture(p: Pixels, colour: boolean): THREE.DataTexture {
  const tex = new THREE.DataTexture(p.data, p.width, p.height, THREE.RGBAFormat);
  tex.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  // Floors seen at a grazing angle stay sharp; the renderer clamps to what the GPU offers.
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
