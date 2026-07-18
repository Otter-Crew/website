# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

`mise` is the task runner — tasks live in `mise.toml` and each depends on `pnpm-install`, so they install dependencies automatically; you don't run `pnpm install` separately.

- `mise run dev` — Astro dev server.
- `mise run build` — static build to `dist/`.
- `mise run preview` — build, then serve `dist/` locally.
- `mise run check` — **the gate.** Runs `check:biome` (Biome lint + format-check, no writes) and `check:astro` (`astro check` type-check). Run before considering work done; prints `mise check: ALL CHECKS PASSED` on success. There is no unit-test suite — this is the verification step.
- `mise run fix` — runs `fix:biome` (`biome check --write`): formats and applies safe lint fixes.

Sub-tasks are individually runnable: `mise run check:biome`, `mise run check:astro`, `mise run fix:biome`.

Toolchain: Node + pnpm are provisioned by mise (`node`, `npm:pnpm`); Node 25 has no corepack, so don't `corepack enable` — pnpm comes from mise. `node_modules/.bin` is on the task PATH, so tasks invoke `astro`/`biome` directly.

## What this is

A fully static (SSG) Astro 6 site for a one-person software studio — consulting, project showcases, and a blog. No SSR adapter and no client-side framework; output is plain HTML/CSS. Before deploy, the production domain must be set consistently in both `astro.config.mjs` (`site`) and `src/site.ts` (`url`) — these drive canonical URLs, the sitemap, and RSS.

## Architecture

**Content is data, defined by schema.** `src/content.config.ts` declares two content collections loaded from Markdown via the glob loader: `blog` (`src/content/blog/*.md`) and `projects` (`src/content/projects/*.md`), each with a Zod schema. Frontmatter that doesn't match the schema fails the build. Adding a field means editing the schema first. Both collections have a `draft` boolean, and **every** query filters it out — replicate `.filter((p) => !p.data.draft)` in any new page that lists content. Pages live in `src/pages/`; `blog/[...slug].astro` generates a route per post via `getStaticPaths`, and `rss.xml.js` is an endpoint that serializes the blog collection.

**Single source of site metadata.** `src/site.ts` exports the `site` object (name, author, email, nav, description). Pull nav, contact, and titles from there rather than hardcoding; `BaseLayout.astro` consumes it for `<title>`, canonical, OG, and RSS tags. Every page wraps its content in `BaseLayout` (optionally through `PageHeader`).

**The design system is documents-first, then three tiers.** `PRODUCT.md` (brand, audience, principles) and `DESIGN.md` ("The Quiet Workshop" — warm cream/ink/amber palette, editorial serif+sans type, restraint) define intent. Those decisions are implemented in three honest tiers: **tokens** (`src/styles/tokens.css`, CSS custom properties — the single source of design values); **foundation** (`src/styles/global.css` — reset, base element defaults, focus/selection, reduced-motion, and the cross-cutting layout/a11y utilities `.container`/`.skip-link`/`.visually-hidden`); and **primitives** (small `.astro` components in `src/components/` that own their markup and a colocated CSS Module). When changing visual style, read `DESIGN.md` first and honor its named rules — chiefly: the burnt-amber `--c-accent` appears on ≤10% of any screen (one accent per screen), and **no pure `#000`/`#fff`** (all neutrals are warm-tinted via oklch). Use the existing tokens (`--c-*`, `--space-*`, `--text-*`, `--ease-*`); do not introduce raw hex colors or pixel spacing.

**Primitive components are the shared UI vocabulary.** Reusable atoms live flat in `src/components/`, each with its own CSS Module: `ArrowLink` (directional link with a nudging arrow; `size` prop), `TextLink` (underlined accent link), `SectionMarker` (tracked editorial label), `Wordmark` (the brand link; `soft` footer variant), `Section` (the `<section>` + `.container` layout wrapper; `top`/`bottom` space-scale props, `width`, `id`/`labelledby`), and `Prose` (long-form Markdown). Compose these before hand-rolling new markup. The separation rule: **appearance** lives inside the primitive (its CSS Module); **positioning** of a primitive (margins, flex placement) stays with the consuming page/component on a wrapper element it owns — never reach inside a primitive's internals. `Prose` is the one primitive whose styles are global, in the imported stylesheet `src/styles/prose.css` (under `.prose`, a re-declared `@layer components`), because CSS Module class names are hashed and can't reach the bare Markdown elements rendered by `<Content/>`.

**CSS conventions.** `global.css` declares `@layer reset, base, components, utilities` and holds only the foundation: reset, base element defaults, and the layout/a11y utilities `.container` (+ `--content`/`--prose` width variants), `.skip-link`, `.visually-hidden`. Everything else lives in **CSS Modules** — one colocated `X.module.css` per component/page, imported as `styles` and referenced with **bracket notation** (`class={styles['fooBar']}`). Class names in the module stay kebab/BEM but are exported camelCased (`localsConvention: 'camelCaseOnly'`, set in `astro.config.mjs`). Strict TS forces the shape: `noPropertyAccessFromIndexSignature` rules out dot access, and `noUncheckedIndexedAccess` makes `styles['x']` be `string | undefined` — so it can't be a computed `class:list` object key. Use array-form conditionals instead: `class:list={[styles['base'], cond && styles['mod']]}`. Biome's `useLiteralKeys` is off (`biome.json`) so `fix` won't rewrite the brackets back to dot access. Cross-component targeting by class name no longer works (hashing), so give a primitive a prop rather than reaching in with `:global()`. Reach for an existing primitive component or utility class before writing new CSS; reach for a token before writing a raw value. Markdown code blocks are highlighted by Shiki with the `github-light` theme (configured in `astro.config.mjs`).

## Tooling conventions

**Biome** (`biome.json`) is the single formatter and linter, covering JS/TS/Astro/CSS/JSON: 2-space indent, single quotes (CSS included), import organization on. It is deliberately opinionated — don't hand-format to dodge it; run `mise run fix`. It formats `.astro` frontmatter/scripts and CSS but can't fully parse Astro template syntax, so an `overrides` entry turns off `noUnusedVariables`/`noUnusedImports` for `.astro`. `noImportantStyles` is off globally because the `!important` uses here are deliberate (the reduced-motion reset and the Shiki background override). `useLiteralKeys` is off so Biome leaves the `styles['fooBar']` CSS-Module access alone (strict TS requires bracket, not dot; see CSS conventions).

**TypeScript is maximally strict.** `tsconfig.json` extends `astro/tsconfigs/strictest` plus `noPropertyAccessFromIndexSignature`. Two consequences worth knowing before they bite:

- `exactOptionalPropertyTypes` is on, so a component prop fed a content-schema `.optional()` value (which is `string | undefined`) must be typed `prop?: string | undefined`, **not** `prop?: string` (see `ProjectItem.astro`).
- `noUncheckedSideEffectImports` (a TS 6 default) rejects side-effect imports of packages without a matching module type. Import CSS-only packages by explicit file: `@fontsource-variable/fraunces/index.css`, not the bare specifier (see `BaseLayout.astro`).

**Schema imports.** Import `z` from `astro/zod` (not `astro:content`, and not `astro:schema` — the latter is deprecated and removed in Astro 7). Astro 6 bundles zod v4, so use its top-level format validators (`z.url()`, `z.email()`, …) rather than the deprecated method form (`z.string().url()`): the method form is tagged `@deprecated` and emits a `ts(6385)` *hint*, and `check:astro` runs with `--minimumFailingSeverity hint`, so any hint fails `mise run check`.
