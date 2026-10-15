// Cuts the phone crops of src/data/crops.mjs out of the screenshots in pitch/ into
// src/assets/crops/ (lossless PNG; Astro turns them into AVIF and WebP). Runs before every build
// and dev start (npm prebuild/predev); a crop is only cut again when its screenshot or the
// list of regions is newer.
import { mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';
import { CROPS } from '../src/data/crops.mjs';

const PITCH = fileURLToPath(new URL('../../pitch/', import.meta.url));
const OUT = fileURLToPath(new URL('../src/assets/crops/', import.meta.url));
await mkdir(OUT, { recursive: true });
const listChanged = (await stat(fileURLToPath(new URL('../src/data/crops.mjs', import.meta.url)))).mtimeMs;
let made = 0;
for (const [name, region] of Object.entries(CROPS)) {
  const src = join(PITCH, `${name}.png`);
  const dst = join(OUT, `${name}.png`);
  const [a, b] = await Promise.all([stat(src), stat(dst).catch(() => null)]);
  if (b && b.mtimeMs >= a.mtimeMs && b.mtimeMs >= listChanged) continue;
  const meta = await sharp(src).metadata();
  if (region.left + region.width > meta.width || region.top + region.height > meta.height) {
    throw new Error(`crop ${name} lies outside the ${meta.width} x ${meta.height} screenshot`);
  }
  await sharp(src).extract(region).png({ compressionLevel: 6 }).toFile(dst);
  made++;
}
console.log(`[crops] ${made} of ${Object.keys(CROPS).length} phone crops cut (src/assets/crops/).`);
