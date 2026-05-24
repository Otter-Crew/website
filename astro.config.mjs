import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// `site` is the canonical production domain; it drives canonical URLs,
// sitemap, and RSS. Keep it in sync with `url` in src/site.ts.
export default defineConfig({
  site: 'https://ottercrew.group',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
