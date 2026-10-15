import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { ROUTES } from '../../data/site.mjs';

/**
 * The link preview image of each page (1200 x 630 JPEG): a real screenshot of the app that fits
 * the page, cut to the format. The screenshots show the German interface; there are no English
 * ones yet, so both languages share the image.
 */
const SHOTS: Record<keyof typeof ROUTES, string> = {
  home: '01-alle-ansichten',
  example: '05-3d-kochinsel',
  download: '04-3d-uebersicht',
  changelog: '02-grundriss',
  imprint: '01-alle-ansichten',
  privacy: '01-alle-ansichten',
};

export function getStaticPaths() {
  return Object.keys(ROUTES).map((page) => ({ params: { page } }));
}

export const GET: APIRoute = async ({ params }) => {
  const src = resolve(process.cwd(), '..', 'pitch', `${SHOTS[params.page as keyof typeof ROUTES]}.png`);
  const jpg = await sharp(src).resize(1200, 630, { fit: 'cover', position: 'top' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg));
};
