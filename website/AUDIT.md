# Website audit

The website against the owner's guidelines (`AICodeGuidelines`: `web/websites.md`,
`web/launch-checklist.md`, `design/principles.md`, `design/writing.md`, `quality/security.md`,
`quality/performance.md`), item by item. Status: **done** (was already right), **fixed** (changed
in a pass), **n/a** (does not apply, with the reason), **decided** (the owner decided against
it, with what is done instead), **open** (not done yet).
Stand: 15 October 2026, version 0.2.1, after the website findings W1–W23 of the 0.2.1 quality pass.

Owner decisions (15 October 2026):

- Hosting stays on GitHub Pages; no Cloudflare in front and no move to Cloudflare Pages. Response
  headers (HSTS, CSP header, `frame-ancestors`, nosniff, Permissions-Policy), long asset caching,
  real redirects, a 404 page per language and branch previews therefore stay out of reach; the
  rows below say **decided** for them.
- No „Ein Projekt von MouseWerk“ line on the start page or in the footer; who provides the site is
  in the legal notice and the structured data.

Automated: `npm run build` runs `scripts/check-site.mjs` (built HTML), `check-i18n.mjs` (catalogs)
and `check-design.mjs` (stylesheets); `npm run check:rendered` runs `scripts/check-rendered.mjs`
(Playwright, every page at 360–1920 px). The website workflow runs all of them before it deploys.

## websites.md

### 1. Content first

| Item | Status | How |
| --- | --- | --- |
| One job and one primary action per page | done | Start: download; example: open the file; download: the installer per OS. |
| Say what it does in the first screen, real screenshot | fixed | Shorter lead; on phones the hero is a crop of the 3D kitchen instead of the whole app window, and the download button is above the fold at 360 × 800. From 1200 px text and screenshot stand side by side, so the app is in the first screen on desktops too. |
| Who is behind it | decided | No maker line (owner); the provider is in the legal notice and the Organization in the JSON-LD. |
| Show, do not claim; nothing invented | fixed | Only real screenshots of the example kitchen; no testimonials, ratings or customer logos. Features of a version show only once that version is released (`since` in the catalogs, `available()` in `release.mjs`); the catalog's size is that of the latest published release (`src/data/catalog.mjs`), and the changelog shows only notes of published releases (`publishedNotes()`). The screenshots and example exports are older than 0.2.0: **open** (new `pitch/` screenshots and exports with 0.2.1, plus a sample PDF plan set). |
| Short paragraphs, descriptive links | done | Links say where they go („Installer für Windows“, „Zur Beispielküche“). |
| Facts in one place | fixed | Version, files and sizes from the GitHub API at build time (`release.mjs`), the changelog from `docs/releases/*.md`, legal data from `legal.mjs`, example figures from `examples/README.md`, the number of catalog units per release from `catalog.mjs` (a unit test checks each against that version's release notes). The site is built again after every release, manual („Release“) or automatic („Auto release“); `scripts/website-trigger.test.mjs` checks that every workflow that publishes a release starts it. |

### 2. Performance

| Item | Status | How |
| --- | --- | --- |
| LCP < 2.5 s, CLS < 0.1, INP < 200 ms | done | Static HTML, 69–78 KB baseline per page (48 KB of it the font), hero 40–90 KB. Every image has width and height. Lighthouse on the live site (0.2.1 audit): mobile LCP 1.1–1.3 s, CLS 0. |
| JS under 100 KB | done | One script of 0.5 KB (`menu.js`). |
| Modern formats, srcset/sizes, dimensions, lazy below the fold | fixed | AVIF and WebP in 4–5 widths; art-directed `<picture>`: below 960 px a crop of the screenshot (`crops.mjs`), else the whole window, light screenshots for light mode where they exist. `sizes` follow the grid (7 of 12 columns for the hero from 1200 px and for the features from 960 px, the 32 px gutter from 720 px). The first picture of the example kitchen is its largest paint on desktops and loads eagerly. |
| `fetchpriority="high"` on the LCP image only; preload | fixed | The hero image has it (on the example kitchen: its first picture); `<link rel="preload" as="image">` with `imagesrcset` per media query (phone crop, desktop dark, desktop light). `check-site` allows only one `fetchpriority="high"` image. |
| Fonts self-hosted, subset, woff2, swap, preload only what the first screen uses | done | Inter latin and latin-ext as woff2 with `unicode-range`; only latin is preloaded. |
| CSS small, no unused framework CSS | done | One stylesheet, no framework. |
| Hashed assets immutable, HTML revalidated | decided | Assets are hashed (`/_astro/`), but GitHub Pages sets `max-age=600` on everything and allows no headers; the owner keeps GitHub Pages. |
| No third parties | done | Nothing from another origin; `check-site` fails on any. |
| Measure | done | Lighthouse (0.2.1 audit, mobile / desktop): performance 99–100 / 100, accessibility 100, best practices 100, SEO 92 only because the meta CSP had no `connect-src` and Lighthouse could not read robots.txt from inside the page (`connect-src 'self'` added). `check-site` prints the weight of every page at 360 @2x, 430 @3x, 768 @2x and 1440 @1x/@2x and fails above 350 KB (first view) / 2.6 MB (whole page). |

### 3. Layout and responsiveness

| Item | Status | How |
| --- | --- | --- |
| 360–1920 px, no horizontal scroll | fixed | `check-rendered` at 360, 390, 430, 768, 1024, 1280, 1440, 1920 (dark) and 390, 1280 (light). Commands scroll inside their box. |
| Sticky header anchors | done | The header is not sticky; `scroll-margin-top` is set; `check-rendered` checks that `#funktionen` lands in the window below the header. |
| Tap targets ≥ 44 px | fixed | Navigation, menu button, language switch, buttons, footer and file links, the „Release auf GitHub“ links of the changelog and the email address in the privacy policy; `check-rendered` checks every link and button on phones (links in running text excepted, WCAG 2.5.8). Wrapped footer links keep their lines closer than the gap between links. |
| Fluid type, 60–80 characters | done | `clamp()` for headings and lead; text columns at `66ch`. |
| Both colour schemes, reduced motion | done | Tokens for dark and light (`prefers-color-scheme`), no animations; `prefers-reduced-motion` turns transitions off. |
| Compact phone header | fixed | Below 740 px: name, a short language switch („EN“/„DE“) and a „Menü“ button (`<details>`; `menu.js` adds Escape and outside clicks); from 740 px (tablets) the four links and the language switch in one row. The hero's facts break between facts, never inside one. |

### 4. Accessibility

| Item | Status | How |
| --- | --- | --- |
| Landmarks, one h1, headings in order, lists | done | `check-site` checks h1 and heading order on every page. |
| Skip link, neutral focus on `:focus-visible` | done | `check-rendered` tabs through the start page (390 and 1280 px): ring present and gray; none after a mouse click. |
| Contrast AA in both themes | fixed | `check-design` computes every text token on every background in both themes (the dark accent button was raised to 4.78:1). No text on images. |
| Label in name (WCAG 2.5.3), language of parts | fixed | The language switch has no `aria-label` any more, so its name is its visible text („English“, „EN“); `check-rendered` fails when an `aria-label` does not contain the visible text. German names and addresses on the English legal pages carry `lang="de"`. |
| Alt texts that describe | fixed | Every screenshot says what it shows; the hero alt fits both the desktop and the phone picture; crops have visible captions below 960 px. |
| Menus keyboard operable, Escape closes, focus returned | fixed | `<details>` menu; Escape closes it and focuses its button; checked by `check-rendered`. |
| Forms | n/a | The site has no forms. |
| Video | n/a | No video or animation. |

### 5. SEO and sharing

| Item | Status | How |
| --- | --- | --- |
| Unique title (50–60) and description (140–160), canonical, `lang`, hreflang with x-default | fixed | `check-site` enforces the guideline's lengths on every indexable page (the noindex 404 page only the maximum); the titles of the legal pages, the changelog, the German start page and the English download page were too short and are rewritten. x-default is German (the main language). |
| Clean URLs, real 404 | fixed | One `404.html` in both languages (GitHub Pages serves one 404 for the whole site; a 404 per language is **decided** with the hosting). Its buttons are a list without bullets („Startseite“/„Home“, Download, Beispielküche); `check-rendered` fails on bullets in a list of buttons. Section anchors are in the page's language (`/#funktionen`, `/en/#features`; `ANCHORS` in `site.mjs`). |
| sitemap and robots | done | `sitemap.xml` with exactly the indexable pages and their language versions; `robots.txt` points to it. |
| Structured data | fixed | One `@graph` per page: WebSite, Organization (Mousewerk, from `legal.mjs`), SoftwareApplication on the start pages (version, files, screenshots, features, free offer, source code), BreadcrumbList below. No ratings; `check-site` fails on them. |
| Open Graph and Twitter cards, 1200 × 630 per page | fixed | One image per page from a fitting screenshot (`/og/<page>.jpg`), Twitter tags added; `check-site` checks the file and size. Per language: **open**, there are only German screenshots of the app and the images carry no title; both languages share the image. |

### 6. Internationalization

| Item | Status | How |
| --- | --- | --- |
| All texts in catalogs, parity, typography, no emoji | done | `check-i18n` (keys, list lengths, placeholders, „…“ in German, curly quotes in English, no „...“, no „Rechner“, no emoji). |
| Language switch keeps the page | done | Checked on every page by `check-rendered`. |
| Terms as the app shows them | fixed | English texts now use the English app labels („Arrange“, „Room“, „Draw outline“, „Walk through“, „Renumber positions“, „Update now“); keys as on the keyboard (Strg+O, ⌘O). |

### 7. Security and privacy

| Item | Status | How |
| --- | --- | --- |
| HTTPS, HSTS | decided | GitHub Pages serves HTTPS („Enforce HTTPS“); it sends no HSTS header for custom domains and allows none. Cloudflare in front would add it; the owner keeps GitHub Pages. |
| CSP without `unsafe-inline`, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors | decided | CSP as `<meta>` (`default-src 'none'; script-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; connect-src 'self'`), no inline script or style anywhere (checked). Referrer policy as `<meta>`. nosniff, Permissions-Policy and `frame-ancestors` need response headers, which GitHub Pages does not allow; the owner keeps GitHub Pages. |
| Legal pages linked from every page | done | Impressum and Datenschutz in the footer, with „Stand“. The privacy policy now also covers the transfer to the USA (EU-U.S. Data Privacy Framework, standard contractual clauses), GitHub's storage period for its logs (GitHub names none), contact by email, and describes the update check as it is (a fixed `latest.json`, the update module's user agent, no app version): **open** until the owner's legal review. |
| No cookie banner needed | done | No cookies, no storage, no trackers. |
| External links `rel="noopener"` | done | Checked by `check-site`. |
| security.txt | fixed | `/.well-known/security.txt` points to the private advisories (SECURITY.md). |

### 8. Design

| Item | Status | How |
| --- | --- | --- |
| Neutral states, neutral focus, no glows, no left bars, tokens only | done | `check-design` on the stylesheets, `check-rendered` on the computed styles (current navigation entry without a frame, focus ring gray). |

### 9. Quality gates

| Item | Status | How |
| --- | --- | --- |
| Build fails on broken links/anchors, SEO, i18n | done | `check-site`, `check-i18n`. |
| CSP hashes out of date | n/a | No inline scripts, so no hashes. |
| e2e against the production build: console, overflow, anchors, design states, language switch, 404, keyboard | fixed | `check-rendered` (Playwright) in the workflow before the deploy. Forms: n/a. |

### 10. Deploy

| Item | Status | How |
| --- | --- | --- |
| Production only from main after the checks | fixed | `.github/workflows/website.yml`; pull requests build and check only. It also runs after every successful „Release“ and „Auto release“ run (before, an automatic release never rebuilt the site). |
| Previews per branch | decided | GitHub Pages has one site per repository; the owner keeps GitHub Pages. |
| After each deploy: check live pages | open | For the owner or the lead after this change goes out. |

## launch-checklist.md

| Item | Status |
| --- | --- |
| Build without our warnings; lint/typecheck | done (the build prints none of ours) |
| No console errors or warnings | fixed (`check-rendered`) |
| Dependencies current | done (Astro 7.3, sharp 0.35, Playwright pinned to 1.56.1 for a stable browser) |
| Facts from one source | done |
| Screenshots current, both themes, sharp at 2x, alt | open: `pitch/` and the example exports predate 0.2.0 (old catalog, CSV without manufacturer and price columns, no PDF plan set); 2x; light versions exist for the overview and 3D only |
| Texts proofread, glossary, typography | fixed |
| Legal pages present and linked | done |
| 360–1920 px, light and dark | fixed (`check-rendered`, screenshots looked at) |
| States follow principles.md, guard passes | done |
| Anchors, reduced motion | done |
| Keyboard only | fixed (menu Escape, focus return, scrollable commands take the focus) |
| Contrast AA both themes | done |
| Forms | n/a |
| Lighthouse 95+ | done (0.2.1 audit): 99–100 everywhere except SEO 92, a tool artefact fixed with `connect-src 'self'`; to be measured again after the deploy |
| Images responsive, fonts subset | done |
| Caching headers | decided (GitHub Pages stays) |
| Titles, descriptions, canonical, hreflang, lang | fixed (lengths per the guideline) |
| Sitemap, robots, 404, redirects | fixed (404 without bullets); no moved pages yet |
| JSON-LD truthful, OG image | fixed |
| HTTPS, HSTS, CSP, other headers | decided, see section 7 |
| No secrets in the repo or client | done |
| After deploy: live check | open |

## design/writing.md, quality/*.md

- German „du“ everywhere, „Computer“ not „Rechner“, „…“ quotes, Strg/⌘ key names: done, checked.
- English curly quotes and apostrophes: done.
- performance.md budget tests: page weight budgets in `check-site`, printed on every build.
- security.md, web apps: CSP without `unsafe-inline` (meta), no secrets; the rest (auth, CSRF,
  uploads, emails) n/a for a static site.
