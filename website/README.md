# Website kitchenplaner.mousewerk.de

A static site built with Astro, German at `/` and English at `/en/`. No cookies, nothing loaded
from other origins (Inter is self-hosted), one 0.5 KB script (`public/menu.js`, Escape for the phone
menu), and a strict Content-Security-Policy on every page. Deployed by
`.github/workflows/website.yml` to GitHub Pages. `AUDIT.md` goes through the guidelines item by item.

```
cd website
npm ci
npm run build            # phone crops, astro build, then the checks below; output in dist/
npm run check:rendered   # Playwright: every page at 360–1920 px (after the build)
npm run preview          # serves dist/ on http://localhost:4321
npm test                 # unit tests of the build-time data and the checks
npm run dev              # development server (no CSP in development)
```

`check:rendered` needs Chromium: `npx playwright install chromium` once, or point
`KP_CHROMIUM` at an installed one.

Where the content comes from:

- texts: `src/i18n/de.mjs` and `en.mjs` (same keys; „du“; terms from `docs/i18n.md` and the app's
  catalogs). An entry with `since: '0.x.0'` shows only once that version is released.
- screenshots: `pitch/*.png`, converted to AVIF and WebP at build time (`src/components/Shot.astro`);
  below 960 px a crop of each (`src/data/crops.mjs`, cut by `scripts/crops.mjs` into the ignored
  `src/assets/crops/`)
- downloads and the version: the GitHub API at build time (`src/data/release.mjs`); without it, the
  buttons link to the latest release's page
- changelog: `docs/releases/v*.md` (`src/data/notes.mjs`), without the Windows checklist
- example kitchen exports: `pitch/exports/`, published under `/beispiel/`
- legal notice, privacy policy and the Organization in the structured data: `src/data/legal.mjs`
- link previews: `src/pages/og/[page].jpg.ts`

Checks (all run in the workflow before the deploy):

- `scripts/check-site.mjs`: links, anchors, titles, descriptions, headings, image attributes,
  canonical and hreflang, sitemap, CSP, other origins, preview images, JSON-LD, page weight budget
- `scripts/check-i18n.mjs`: key parity, placeholders, typography
- `scripts/check-design.mjs`: tokens only, neutral states, no left bars, focus ring, AA contrast
- `scripts/check-rendered.mjs`: overflow, console, images, tap targets, focus ring, anchors, phone
  menu, language switch

The deploy is skipped while the legal notice is incomplete (`scripts/legal-ready.mjs`).

GitHub Pages cannot send response headers: the CSP is a `<meta>` tag (so `frame-ancestors`, HSTS,
`nosniff` and Permissions-Policy are not available), and assets are cached for 10 minutes instead
of a year.
