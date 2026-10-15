// @ts-check
import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/data/site.mjs';

// A static site without client JavaScript. Stylesheets stay external files (never inlined) so the
// Content-Security-Policy of every page can forbid inline styles and scripts altogether.
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'never' },
  compressHTML: true,
  devToolbar: { enabled: false },
  prefetch: false,
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
  // Screenshots and release notes live outside website/ (pitch/, docs/releases/).
  vite: { server: { fs: { allow: ['..'] } } },
});
