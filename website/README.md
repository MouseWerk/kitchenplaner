# Website kitchenplaner.mousewerk.de

A static site built with Astro, German at `/` and English at `/en/`. It sends no JavaScript, sets
no cookies, loads nothing from other origins (Inter is self-hosted) and every page carries a strict
Content-Security-Policy. Deployed by `.github/workflows/website.yml` to GitHub Pages.

```
cd website
npm ci
npm run build     # astro build, then the checks below; output in dist/
npm run preview   # serves dist/ on http://localhost:4321
npm test          # unit tests of the build-time data and the checks
npm run dev       # development server (no CSP in development)
```

Where the content comes from:

- texts: `src/i18n/de.mjs` and `en.mjs` (same keys; „du“; terms from `docs/i18n.md`)
- screenshots: `pitch/*.png`, converted to AVIF and WebP at build time (`src/components/Shot.astro`)
- downloads and the version: the GitHub API at build time (`src/data/release.mjs`); without it, the
  buttons link to the latest release's page
- changelog: `docs/releases/v*.md` (`src/data/notes.mjs`), without the Windows checklist
- example kitchen exports: `pitch/exports/`, published under `/beispiel/`
- legal notice and privacy policy: `src/data/legal.mjs` (provider details) and the catalogs

Checks (`npm run check`, part of the build): `scripts/check-site.mjs` (links, anchors, titles,
descriptions, headings, image attributes, canonical and hreflang, sitemap, CSP, other origins, page
weight budget), `scripts/check-i18n.mjs` (key parity, placeholders, typography),
`scripts/check-design.mjs` (tokens only, neutral states, no left bars, focus ring, AA contrast).

## Before the first deploy (owner)

1. Fill in `src/data/legal.mjs` and review the privacy text (`legal.privacy` in both catalogs).
   Until then the workflow builds and checks but does not deploy.
2. Settings -> Pages -> Build and deployment -> Source: "GitHub Actions".
3. DNS of mousewerk.de: `kitchenplaner  CNAME  mousewerk.github.io.`
4. After the first deploy: Settings -> Pages -> Custom domain shows kitchenplaner.mousewerk.de;
   tick "Enforce HTTPS" once the certificate is issued.

GitHub Pages cannot send custom response headers: the CSP is a `<meta>` tag (so `frame-ancestors`
and HSTS are not available), and assets are cached for 10 minutes instead of a year.
