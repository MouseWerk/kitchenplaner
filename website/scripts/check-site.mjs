// After `astro build`: checks every page in dist/ without network access and prints the page
// weights. Fails (exit 1) with a list of problems when
// - an internal link, image or stylesheet points to a missing file, or a #fragment to a missing id;
// - a page loads anything from another origin, has an inline script (JSON-LD excepted), an inline
//   style or a style attribute, or lacks the Content-Security-Policy (script files of this site are
//   fine: script-src 'self');
// - a title (15 to 60 characters) or description (110 to 160) is missing or used twice;
// - a page has not exactly one h1, skips a heading level, or lacks lang;
// - an <img> lacks alt, width, height or loading;
// - an indexable page lacks its canonical or reciprocal hreflang (de, en, x-default), or the
//   sitemap does not list exactly the indexable pages;
// - og:image is not a 1200 x 630 JPEG of this site, the Twitter card tags are missing, or the
//   JSON-LD lacks WebSite and Organization (SoftwareApplication on the start pages) or has ratings;
// - CNAME, robots.txt, the preview image, menu.js or 404.html are missing;
// - a page is heavier than its budget (see BUDGET).
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL } from '../src/data/site.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const ORIGIN = new URL(SITE_URL).origin;

/**
 * Budgets in bytes, measured as a browser at the given width would load the page: HTML, CSS, the
 * preloaded font and, of every image, the candidate it picks from srcset and sizes. "first" counts
 * eager images only (what the first view needs), "full" every image after scrolling to the end.
 */
const BUDGET = { first: 350 * 1024, full: 2600 * 1024 };
const VIEWPORTS = [
  { name: 'phone 360 @2x', width: 360, dpr: 2 },
  { name: 'phone 430 @3x', width: 430, dpr: 3 },
  { name: 'tablet 768 @2x', width: 768, dpr: 2 },
  { name: 'desktop 1440 @1x', width: 1440, dpr: 1 },
  { name: 'desktop 1440 @2x', width: 1440, dpr: 2 },
];

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const exists = (p) => stat(p).then((s) => s, () => null);
const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html) => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

/** The file a site path is served from, or null. */
async function resolve(pathname) {
  const p = decodeURIComponent(pathname);
  const file = join(DIST, p);
  const s = await exists(file);
  if (s?.isFile()) return file;
  if (s?.isDirectory()) return (await exists(join(file, 'index.html'))) ? join(file, 'index.html') : null;
  return null;
}

/** Width and height of a JPEG, or null. */
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

const sitePath = (file) => '/' + relative(DIST, file).split('\\').join('/').replace(/index\.html$/, '');
const sizeOf = async (sitePathname) => {
  const f = await resolve(sitePathname);
  return f ? (await stat(f)).size : 0;
};

/** Evaluates a `sizes` attribute for a viewport width: px, vw and calc(a vw - b px). */
function slotWidth(sizes, vw) {
  for (const part of sizes.split(',').map((s) => s.trim())) {
    const m = part.match(/^\(min-width:\s*(\d+)px\)\s+(.+)$/);
    if (m && vw < Number(m[1])) continue;
    const v = (m ? m[2] : part).trim();
    let r;
    if ((r = v.match(/^(\d+(?:\.\d+)?)px$/))) return Number(r[1]);
    if ((r = v.match(/^(\d+(?:\.\d+)?)vw$/))) return (Number(r[1]) * vw) / 100;
    if ((r = v.match(/^calc\((\d+(?:\.\d+)?)vw\s*-\s*(\d+)px\)$/))) return (Number(r[1]) * vw) / 100 - Number(r[2]);
    return vw;
  }
  return vw;
}

/** The srcset candidate a browser picks: the smallest at least as wide as the slot times dpr. */
function pick(srcset, need) {
  const c = srcset.split(',').map((s) => s.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w, 10) })).sort((a, b) => a.w - b.w);
  return (c.find((x) => x.w >= need) ?? c.at(-1)).u;
}

const files = await walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const idCache = new Map();
async function ids(file) {
  if (!idCache.has(file)) idCache.set(file, new Set([...(await readFile(file, 'utf8')).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idCache.get(file);
}

const titles = new Map();
const descs = new Map();
const indexable = new Map();
const weights = [];
let links = 0;

for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const path = sitePath(file).replace(/\.html$/, '');
  const pageUrl = new URL(sitePath(file), ORIGIN);
  const [head, body = ''] = html.split(/<\/head>/i);

  // Links and resources
  for (const m of html.matchAll(/\s(href|src|srcset|imagesrcset)="([^"]*)"/g)) {
    const values = m[1].endsWith('srcset') ?decode(m[2]).split(',').map((c) => c.trim().split(/\s+/)[0]) : [decode(m[2])];
    for (const v of values) {
      links++;
      if (/^(mailto|tel):/.test(v)) continue;
      let u;
      try {
        u = new URL(v, pageUrl);
      } catch {
        fail(path, `invalid URL ${v}`);
        continue;
      }
      if (u.origin !== ORIGIN) {
        if (u.protocol !== 'https:') fail(path, `external link is not https: ${v}`);
        continue;
      }
      const target = await resolve(u.pathname);
      if (!target) fail(path, `missing file: ${v}`);
      else if (u.hash && target.endsWith('.html') && !(await ids(target)).has(decodeURIComponent(u.hash.slice(1)))) fail(path, `missing anchor: ${v}`);
    }
  }
  for (const m of html.matchAll(/<(script|link|img|source|iframe|video|audio|embed|object)\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (m[1] === 'link' && !/\b(stylesheet|preload|icon|apple-touch-icon|manifest)\b/.test(a.rel ?? '')) continue;
    for (const u of [a.src, a.href, ...(a.srcset ?? '').split(',').map((x) => x.trim().split(/\s+/)[0])]) {
      if (u && new URL(u, pageUrl).origin !== ORIGIN) fail(path, `<${m[1]}> loads from another origin: ${u}`);
    }
  }
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.href && /^https?:/.test(a.href) && new URL(a.href).origin !== ORIGIN && !/noopener/.test(a.rel ?? '')) fail(path, `external link without rel="noopener": ${a.href}`);
  }

  // Content-Security-Policy: nothing inline that it would block.
  if (!/<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self';/.test(head)) fail(path, 'no Content-Security-Policy meta tag');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = m[1].match(/\ssrc="([^"]+)"/)?.[1];
    if (src) {
      // Script files of this site are allowed (script-src 'self'); inline code is not.
      if (m[2].trim()) fail(path, `script with src and inline code: ${src}`);
      if (new URL(src, pageUrl).origin !== ORIGIN) fail(path, `script from another origin: ${src}`);
    } else if (!/type="application\/ld\+json"/.test(m[1])) fail(path, 'inline script other than JSON-LD (the CSP forbids it)');
    else {
      try {
        const doc = JSON.parse(m[2]);
        const types = (doc['@graph'] ?? []).map((n) => n['@type']);
        for (const need of ['WebSite', 'Organization']) if (!types.includes(need)) fail(path, `JSON-LD without ${need}`);
        if (/^\/(en\/)?$/.test(path) && !types.includes('SoftwareApplication')) fail(path, 'start page without SoftwareApplication in the JSON-LD');
        if (JSON.stringify(doc).includes('aggregateRating') || JSON.stringify(doc).includes('"review"')) fail(path, 'JSON-LD with ratings or reviews');
      } catch (e) {
        fail(path, `JSON-LD does not parse: ${e.message}`);
      }
    }
  }
  if (/<style\b/i.test(html)) fail(path, 'inline <style> (the CSP forbids it)');
  if (/\sstyle="/i.test(html)) fail(path, 'style attribute (the CSP forbids it)');

  // Title, description, lang
  const title = text(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
  const desc = decode(head.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  const lang = html.match(/<html[^>]*\blang="([^"]+)"/)?.[1];
  if (!lang) fail(path, 'no lang on <html>');
  else if (lang !== (path.startsWith('/en/') ? 'en' : 'de')) fail(path, `lang="${lang}" does not match the path`);
  if (title.length < 15 || title.length > 60) fail(path, `title has ${title.length} characters (15 to 60): ${title}`);
  if (desc.length < 110 || desc.length > 160) fail(path, `description has ${desc.length} characters (110 to 160): ${desc}`);
  if (titles.has(title)) fail(path, `title also on ${titles.get(title)}`);
  if (descs.has(desc)) fail(path, `description also on ${descs.get(desc)}`);
  titles.set(title, path);
  descs.set(desc, path);
  for (const p of ['og:title', 'og:description', 'og:image', 'og:image:alt']) if (!head.includes(`property="${p}"`)) fail(path, `missing ${p}`);
  for (const p of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) if (!head.includes(`name="${p}"`)) fail(path, `missing ${p}`);
  const meta = (k) => decode(head.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`))?.[1] ?? '');
  if (meta('twitter:image') !== meta('og:image')) fail(path, 'twitter:image differs from og:image');
  if (meta('og:title') !== title || meta('twitter:title') !== title) fail(path, 'og:title or twitter:title differs from the title');
  const og = meta('og:image');
  if (og) {
    const f = og.startsWith(ORIGIN) ? await resolve(new URL(og).pathname) : null;
    if (!f) fail(path, `og:image is not a file of this site: ${og}`);
    else {
      const size = jpegSize(await readFile(f));
      if (!size || size.w !== 1200 || size.h !== 630) fail(path, `og:image is not a 1200 x 630 JPEG: ${og}`);
    }
  }

  // Headings and images
  const levels = [...body.matchAll(/<h([1-6])\b/g)].map((x) => Number(x[1]));
  if (levels.filter((l) => l === 1).length !== 1) fail(path, `${levels.filter((l) => l === 1).length} h1 elements`);
  if (levels[0] !== 1) fail(path, `first heading is h${levels[0]}`);
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) fail(path, `heading skips from h${levels[i - 1]} to h${levels[i]}`);
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.alt === undefined) fail(path, `img without alt: ${a.src}`);
    if (!a.width || !a.height) fail(path, `img without width and height: ${a.src}`);
    if (!['lazy', 'eager'].includes(a.loading)) fail(path, `img without loading: ${a.src}`);
  }
  if ([...body.matchAll(/fetchpriority="high"/g)].length > 1) fail(path, 'more than one image with fetchpriority="high"');

  // Canonical and hreflang
  const noindex = /<meta name="robots" content="noindex"/.test(head);
  if (!noindex) {
    const self = new URL(path, ORIGIN).href;
    const canon = [...head.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((x) => x[1]);
    if (canon.length !== 1 || canon[0] !== self) fail(path, `canonical is ${canon.join(', ') || 'missing'}, not ${self}`);
    const alts = Object.fromEntries([...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((x) => [x[1], x[2]]));
    for (const k of ['de', 'en', 'x-default']) if (!alts[k]) fail(path, `missing hreflang ${k}`);
    if (alts[lang] !== self) fail(path, `hreflang ${lang} is not the page itself`);
    if (alts['x-default'] !== alts.de) fail(path, 'hreflang x-default is not the German page');
    indexable.set(self, { path, alts });
  }

  // Weight
  const css = [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((x) => x[1]);
  const fonts = [...head.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map((x) => x[1]);
  const scripts = [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((x) => x[1]);
  let base = Buffer.byteLength(html);
  for (const u of [...css, ...fonts, ...scripts]) base += await sizeOf(new URL(u, pageUrl).pathname);
  const row = { path };
  for (const vp of VIEWPORTS) {
    let first = base;
    let full = base;
    // One <picture> or <img> at a time: the crop's AVIF <source> where its max-width applies, otherwise the
    // one without a media query (the dark design, the default), or the <img> itself.
    for (const m of body.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>|<img\b[^>]*>/g)) {
      const block = m[0];
      const img = attrs(block.match(/<img\b[^>]*>/)[0]);
      const sources = [...block.matchAll(/<source\b[^>]*>/g)].map((s) => attrs(s[0])).filter((s) => s.type === 'image/avif');
      const narrow = sources.find((s) => Number(s.media?.match(/max-width: (\d+)px/)?.[1] ?? 0) >= vp.width);
      const source = narrow || sources.find((s) => !s.media);
      const srcset = source?.srcset ?? img.srcset;
      const sizes = source?.sizes ?? img.sizes;
      const url = srcset ? pick(srcset, slotWidth(sizes ?? '100vw', vp.width) * vp.dpr) : img.src;
      const bytes = await sizeOf(new URL(url, pageUrl).pathname);
      full += bytes;
      if (img.loading === 'eager') first += bytes;
    }
    row[vp.name] = { first, full };
    if (first > BUDGET.first) fail(path, `${vp.name}: first view ${Math.round(first / 1024)} KB > ${BUDGET.first / 1024} KB`);
    if (full > BUDGET.full) fail(path, `${vp.name}: whole page ${Math.round(full / 1024)} KB > ${BUDGET.full / 1024} KB`);
  }
  weights.push(row);
}

// Reciprocal hreflang
for (const [self, pg] of indexable) {
  for (const [hl, href] of Object.entries(pg.alts)) {
    const other = indexable.get(href);
    if (!other) fail(pg.path, `hreflang ${hl} points to ${href}, which is not an indexable page`);
    else if (!Object.values(other.alts).includes(self)) fail(pg.path, `${other.path} does not link back via hreflang`);
  }
}

// Sitemap: exactly the indexable pages
const sitemap = await readFile(join(DIST, 'sitemap.xml'), 'utf8').catch(() => '');
const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
for (const self of indexable.keys()) if (!locs.has(self)) fail('/sitemap.xml', `missing ${self}`);
for (const loc of locs) if (!indexable.has(loc)) fail('/sitemap.xml', `lists ${loc}, which is not an indexable page`);

// Files the host and crawlers need
const cname = (await readFile(join(DIST, 'CNAME'), 'utf8').catch(() => '')).trim();
if (cname !== new URL(SITE_URL).host && !process.env.SITE_URL) fail('/CNAME', `is "${cname}", not ${new URL(SITE_URL).host}`);
const robots = await readFile(join(DIST, 'robots.txt'), 'utf8').catch(() => '');
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) fail('/robots.txt', 'does not point to the sitemap');
for (const f of ['404.html', 'og/home.jpg', 'menu.js']) if (!(await exists(join(DIST, f)))) fail(`/${f}`, 'missing');

const kb = (n) => `${Math.round(n / 1024)} KB`.padStart(8);
console.log('[site] page weights (first view / whole page):');
for (const w of weights.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`  ${w.path.padEnd(26)} ${VIEWPORTS.map((vp) => `${vp.name}: ${kb(w[vp.name].first)} /${kb(w[vp.name].full)}`).join('   ')}`);
}

if (problems.length) {
  console.error(`[site] ${problems.length} problem(s) in ${pages.length} pages:`);
  for (const p of [...new Set(problems)]) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`[site] ${pages.length} pages, ${links} links and resources, ${indexable.size} indexable pages in the sitemap: fine.`);
