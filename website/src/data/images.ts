import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

/** Widths offered for whole screenshots and for phone crops. */
export const DESKTOP_WIDTHS = [480, 800, 1200, 1600, 2400];
export const PHONE_WIDTHS = [480, 720, 1080, 1440];
/** Below 960 px a screenshot spans the whole column: phones and tablets get the crop. */
export const PHONE = '(max-width: 959px)';
export const PHONE_SIZES = '(min-width: 720px) calc(100vw - 64px), calc(100vw - 32px)';

export interface Variant { avif: string; webp: string; src: string; w: number; h: number }

/**
 * AVIF and WebP srcsets of a screenshot (captured at device scale 2: width and height are half the
 * pixel size and only give the aspect ratio). Shot.astro and the hero preload in Base.astro call it
 * with the same arguments, so they name the same files.
 */
export async function variant(src: ImageMetadata, widths: number[], fallbackWidth: number): Promise<Variant> {
  const ws = [...new Set(widths.filter((w) => w < src.width).concat(Math.min(src.width, widths.at(-1)!)))];
  const set = async (format: 'avif' | 'webp') =>
    (await Promise.all(ws.map(async (w) => `${(await getImage({ src, format, width: w, quality: format === 'avif' ? 60 : 78 })).src} ${w}w`))).join(', ');
  const fallback = await getImage({ src, format: 'webp', width: Math.min(src.width, fallbackWidth), quality: 78 });
  return { avif: await set('avif'), webp: await set('webp'), src: fallback.src, w: Math.round(src.width / 2), h: Math.round(src.height / 2) };
}
