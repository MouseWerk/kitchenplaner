/**
 * The exports of the example kitchen in pitch/exports/ (written by the app's "Exportieren" menu),
 * published unchanged under /beispiel/. Width and height of SVGs come from their viewBox, so the
 * page reserves the right space.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const EXPORTS_DIR = resolve(process.cwd(), '..', 'pitch', 'exports');

/** @type {{ name: string, path: string, size: number, width: number | null, height: number | null }[]} */
export const EXPORTS = readdirSync(EXPORTS_DIR)
  // grundriss.png repeats grundriss.svg; the site offers the vector file.
  .filter((name) => /\.(svg|dxf|csv|png)$/.test(name) && name !== 'grundriss.png')
  .sort()
  .map((name) => {
    const path = join(EXPORTS_DIR, name);
    let width = null;
    let height = null;
    if (name.endsWith('.svg')) {
      const vb = readFileSync(path, 'utf8').slice(0, 2000).match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);
      if (vb) {
        // Scaled to a 1200 px wide box; only the ratio matters.
        width = 1200;
        height = Math.round((1200 * Number(vb[2])) / Number(vb[1]));
      }
    }
    return { name, path, size: statSync(path).size, width, height };
  });
