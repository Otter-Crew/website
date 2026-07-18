import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Wrap every Markdown <table> in a scroll container so a wide table scrolls
// itself instead of overflowing the prose column (Markdown gives no wrapper of
// its own). The table stays width:100% inside; `.table-wrap` owns the scroll.
// ponytail: hand-rolled hast walk, no unist-util-visit dep for ~10 lines.
function rehypeWrapTables() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'element' && child.tagName === 'table') {
          node.children[i] = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-wrap'] },
            children: [child],
          };
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}

// Estimate reading time from the Markdown body and expose it as frontmatter
// (`minutesRead`) so the post header can show it. ~200 wpm over a plain word
// count of every text/code node.
// ponytail: dependency-free — skips the `reading-time` + `mdast-util-to-string`
// packages the Astro recipe reaches for; a manual walk is ~10 lines.
function remarkReadingTime() {
  return (tree, file) => {
    let words = 0;
    const walk = (node) => {
      if (typeof node.value === 'string') {
        words += node.value.split(/\s+/).filter(Boolean).length;
      }
      if (node.children) for (const child of node.children) walk(child);
    };
    walk(tree);
    const minutes = Math.max(1, Math.round(words / 200));
    file.data.astro.frontmatter.minutesRead = `${minutes} min read`;
  };
}

// `site` is the canonical production domain; it drives canonical URLs,
// sitemap, and RSS. Keep it in sync with `url` in src/site.ts.
export default defineConfig({
  site: 'https://ottercrew.group',
  integrations: [sitemap()],
  // CSS Modules: expose class names as camelCase-only JS identifiers so
  // components reference them as `styles.fooBar` (the .module.css keeps its
  // kebab/BEM names). See CLAUDE.md "CSS conventions".
  vite: {
    css: { modules: { localsConvention: 'camelCaseOnly' } },
  },
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [rehypeWrapTables],
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
