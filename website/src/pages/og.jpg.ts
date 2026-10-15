import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { resolve } from 'node:path';

/** The link preview image (1200 x 630): the overview screenshot of the app, cut to the format. */
export const GET: APIRoute = async () => {
  const src = resolve(process.cwd(), '..', 'pitch', '01-alle-ansichten.png');
  const jpg = await sharp(src).resize(1200, 630, { fit: 'cover', position: 'top' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg));
};
