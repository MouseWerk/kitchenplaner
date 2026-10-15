// The rendered design guards (web/websites.md, "Quality gates"): serves dist/ locally, opens every
// page in Chromium (Playwright) and fails (exit 1) with a list of problems when
// - a page scrolls sideways at 360, 390, 430, 768, 1024, 1280, 1440 or 1920 px;
// - the console shows an error or warning (a CSP violation counts), or a request of this site fails;
// - an image does not load after scrolling through the page;
// - a link, button or menu button on a phone is smaller than 44 px (links inside running text
//   excepted, WCAG 2.5.8);
// - the keyboard focus ring is missing, not neutral (gray), or shows after a mouse click;
// - a selected navigation entry has a colored frame (border, outline or shadow);
// - an anchor target lands outside the window or under the header;
// - the phone menu does not open, or Escape does not close it and return the focus;
// - the language switch does not lead to the same page in the other language.
// Usage: node scripts/check-rendered.mjs [--shots <dir>]   (after `npm run build`)
// The browser: `npx playwright install chromium` once (CI: with --with-deps), or KP_CHROMIUM=<path>.
import { createServer } from 'node:http';
import { readdir, readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const WIDTHS = [360, 390, 430, 768, 1024, 1280, 1440, 1920];
const PHONE = 640;
const shotsAt = process.argv.indexOf('--shots');
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.avif': 'image/avif', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

async function file(pathname) {
  const p = join(DIST, decodeURIComponent(pathname));
  const s = await stat(p).catch(() => null);
  if (s?.isFile()) return p;
  if (s?.isDirectory() && (await stat(join(p, 'index.html')).catch(() => null))) return join(p, 'index.html');
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const f = await file(url.pathname);
  if (!f) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return res.end(await readFile(join(DIST, '404.html')));
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(await readFile(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.html')) out.push('/' + relative(DIST, p).split('\\').join('/').replace(/index\.html$/, ''));
  }
  return out.sort();
}
const pages = await walk(DIST);

const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
// KP_CHROMIUM may name a Chromium that is already installed (local runs without the download).
const browser = await chromium.launch(process.env.KP_CHROMIUM ? { executablePath: process.env.KP_CHROMIUM } : { channel: 'chromium' });
if (SHOTS) await mkdir(SHOTS, { recursive: true });

/** Scrolls through the page so lazy images load, then back to the top. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
}

/** Is a CSS color gray (no hue): channels within 12 of each other? */
const isNeutral = (color) => {
  const m = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (!m) return true;
  const [r, g, b] = m.slice(1, 4).map(Number);
  return Math.max(r, g, b) - Math.min(r, g, b) <= 12;
};

for (const scheme of ['dark', 'light']) {
  for (const width of WIDTHS) {
    // Light is checked at one phone and one desktop width; the layout does not depend on it.
    if (scheme === 'light' && ![390, 1280].includes(width)) continue;
    const phone = width < PHONE;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 800 : 1000 }, colorScheme: scheme, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    let logs = [];
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) logs.push(m.text());
    });
    page.on('pageerror', (e) => logs.push(e.message));
    page.on('response', (r) => {
      if (r.url().startsWith(BASE) && r.status() >= 400 && !r.url().endsWith('/does-not-exist/')) logs.push(`${r.status()} ${r.url()}`);
    });
    for (const path of pages) {
      const where = `${scheme} ${width} ${path}`;
      logs = [];
      await page.goto(BASE + path, { waitUntil: 'load' });
      await scrollThrough(page);
      const r = await page.evaluate(({ phone }) => {
        const out = {};
        out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        out.wide = [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest('.cmd, .menu-panel'))
          .slice(0, 3)
          .map((e) => `${e.tagName.toLowerCase()}.${e.className}`);
        out.broken = [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src);
        out.small = phone
          ? [...document.querySelectorAll('a, button, summary')]
              .filter((e) => {
                const b = e.getBoundingClientRect();
                const visible = b.width > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.classList.contains('skip');
                const inText = !!e.closest('p, dd, address, .steps li, .release li, .legal li');
                return visible && !inText && (b.height < 44 || b.width < 44);
              })
              .map((e) => `${(e.textContent || '').trim().slice(0, 24)} (${Math.round(e.getBoundingClientRect().width)} x ${Math.round(e.getBoundingClientRect().height)})`)
          : [];
        out.current = [...document.querySelectorAll('[aria-current="page"]')].map((e) => {
          const cs = getComputedStyle(e);
          return { border: cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none' ? cs.borderTopColor : null, outline: cs.outlineStyle !== 'none' ? cs.outlineColor : null, shadow: cs.boxShadow !== 'none' ? cs.boxShadow : null };
        });
        const sw = document.querySelector('.nav-desktop a.lang, .lang-short');
        out.lang = { html: document.documentElement.lang, switchHref: sw?.getAttribute('href') ?? null };
        return out;
      }, { phone });
      if (r.overflow > 0) fail(where, `scrolls sideways by ${r.overflow} px (${r.wide.join(', ')})`);
      if (r.broken.length) fail(where, `images not loaded: ${r.broken.slice(0, 3).join(', ')}`);
      if (r.small.length) fail(where, `tap targets under 44 px: ${r.small.slice(0, 4).join(' | ')}`);
      for (const c of r.current) if (c.border || c.outline || c.shadow) fail(where, `the current navigation entry has a frame: ${JSON.stringify(c)}`);
      if (logs.length) fail(where, `console: ${[...new Set(logs)].slice(0, 3).join(' | ')}`);

      // The language switch leads to the same page in the other language (404 has none).
      if (scheme === 'dark' && width === 1280 && r.lang.switchHref) {
        const other = r.lang.switchHref;
        const res = await page.request.get(BASE + other);
        const html = await res.text();
        const lang = html.match(/<html[^>]*\blang="([^"]+)"/)?.[1];
        if (!res.ok() || !lang || lang === r.lang.html) fail(where, `language switch leads to ${other} (${res.status()}, lang ${lang})`);
      }
      if (SHOTS && [360, 390, 430, 768, 1280].includes(width)) {
        await page.screenshot({ path: join(SHOTS, `${scheme}-${width}${path.replace(/\//g, '_').replace(/_$/, '') || '_home'}.png`), fullPage: true });
      }
    }

    // Keyboard focus: a neutral ring on :focus-visible, none after a mouse click.
    if (scheme === 'dark' && [390, 1280].includes(width)) {
      await page.goto(BASE + '/', { waitUntil: 'load' });
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(() => {
          const e = document.activeElement;
          const cs = getComputedStyle(e);
          return { tag: `${e.tagName.toLowerCase()} ${(e.textContent || '').trim().slice(0, 20)}`, style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
        });
        if (f.style === 'none' || f.width === '0px') fail(`${width} keyboard`, `no focus ring on ${f.tag}`);
        else if (!isNeutral(f.color)) fail(`${width} keyboard`, `focus ring on ${f.tag} is colored: ${f.color}`);
      }
      const target = width < PHONE ? '.menu summary' : '.nav-desktop a[href$="beispielkueche/"]';
      await page.goto(BASE + '/', { waitUntil: 'load' });
      await page.hover(target);
      await page.mouse.down();
      const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      await page.mouse.up();
      if (ring !== 'none') fail(`${width} mouse`, `focus ring shows after a mouse click (${ring})`);

      // Anchors land inside the window, below the header.
      await page.goto(BASE + '/#funktionen', { waitUntil: 'load' });
      const a = await page.evaluate(() => ({ top: document.getElementById('funktionen').getBoundingClientRect().top, header: document.querySelector('.site-header').getBoundingClientRect().bottom }));
      if (a.top < Math.max(0, a.header) - 1 || a.top > 200) fail(`${width} anchor`, `#funktionen lands at ${Math.round(a.top)} px (header ends at ${Math.round(a.header)} px)`);
    }

    // The phone menu: opens, Escape closes it and returns the focus to its button.
    if (scheme === 'dark' && width === 390) {
      await page.goto(BASE + '/download/', { waitUntil: 'load' });
      await page.click('.menu summary');
      const open = await page.isVisible('.menu-panel a[href="/beispielkueche/"]');
      await page.keyboard.press('Escape');
      const after = await page.evaluate(() => ({ open: document.querySelector('.menu').open, focus: document.activeElement?.tagName }));
      if (!open) fail('390 menu', 'the menu does not open');
      if (after.open || after.focus !== 'SUMMARY') fail('390 menu', `Escape leaves it ${after.open ? 'open' : 'closed'} with the focus on ${after.focus}`);
      await page.click('.menu summary');
      await page.click('main', { position: { x: 10, y: 400 } });
      if (await page.evaluate(() => document.querySelector('.menu').open)) fail('390 menu', 'a click outside does not close the menu');
    }
    await ctx.close();
  }
}

await browser.close();
server.close();
if (problems.length) {
  console.error(`[rendered] ${problems.length} problem(s):`);
  for (const p of [...new Set(problems)]) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`[rendered] ${pages.length} pages at ${WIDTHS.join(', ')} px (dark; light at 390 and 1280): no overflow, no console errors, images load, tap targets, focus ring, anchors, menu and language switch are fine.`);
