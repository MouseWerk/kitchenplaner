import type { ImageMetadata } from 'astro';

/**
 * The screenshots of pitch/ (made from the real app by e2e/pitch/shots.js, 3840 x 2160 at device
 * scale 2). They are converted to AVIF and WebP in several widths at build time; the PNGs are not
 * published.
 */
const files = import.meta.glob<ImageMetadata>('../../../pitch/*.png', { eager: true, import: 'default' });

export type ShotName =
  | '01-alle-ansichten' | '02-grundriss' | '03-grundriss-kochinsel-auswahl' | '04-3d-uebersicht'
  | '05-3d-kochinsel' | '06-3d-begehen' | '07-3d-von-oben' | '08-ansichten' | '09-ansicht-nord'
  | '10-katalog-vorschau' | '11-operator-verschieben' | '12-raum-wand' | '13-inspektor-kombidaempfer'
  | '14-hell-alle-ansichten' | '15-hell-3d' | '16-ansicht-schnitttiefe';

export function shot(name: ShotName): ImageMetadata {
  const hit = Object.entries(files).find(([path]) => path.endsWith(`/${name}.png`));
  if (!hit) throw new Error(`Screenshot pitch/${name}.png is missing`);
  return hit[1];
}
