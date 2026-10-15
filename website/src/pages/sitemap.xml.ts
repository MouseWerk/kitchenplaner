import type { APIRoute } from 'astro';
import { ROUTES, absolute } from '../data/site.mjs';
import { missingLegal } from '../data/legal.mjs';

/** Every indexable page with its language versions; the legal pages only once they are complete. */
export const GET: APIRoute = () => {
  const legalReady = missingLegal().length === 0;
  const keys = (Object.keys(ROUTES) as (keyof typeof ROUTES)[]).filter((k) => legalReady || (k !== 'imprint' && k !== 'privacy'));
  const urls = keys.flatMap((k) =>
    (['de', 'en'] as const).map((lang) => {
      const alt = (['de', 'en'] as const).map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${absolute(ROUTES[k][l])}"/>`).join('');
      return `<url><loc>${absolute(ROUTES[k][lang])}</loc>${alt}<xhtml:link rel="alternate" hreflang="x-default" href="${absolute(ROUTES[k].de)}"/></url>`;
    }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
