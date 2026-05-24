---
name: otter-crew
description: "Home base for a one-person studio: consulting, projects, and writing, built with calm, understated craft."
colors:
  burnt-amber: "oklch(58% 0.118 56)"
  burnt-amber-deep: "oklch(49% 0.112 52)"
  warm-cream: "oklch(97.3% 0.011 80)"
  warm-cream-deep: "oklch(95.2% 0.013 80)"
  warm-ink: "oklch(26% 0.014 62)"
  warm-ink-soft: "oklch(40% 0.015 62)"
  muted-stone: "oklch(55% 0.016 64)"
  hairline: "oklch(89% 0.014 80)"
typography:
  display:
    fontFamily: "Fraunces Variable, Fraunces, Georgia, serif"
    fontSize: "clamp(2.7rem, 1.6rem + 4.8vw, 4.75rem)"
    fontWeight: 320
    lineHeight: 1.02
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Fraunces Variable, Fraunces, Georgia, serif"
    fontSize: "clamp(2.05rem, 1.5rem + 2.3vw, 3.1rem)"
    fontWeight: 360
    lineHeight: 1.08
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Fraunces Variable, Fraunces, Georgia, serif"
    fontSize: "clamp(1.45rem, 1.25rem + 0.9vw, 1.95rem)"
    fontWeight: 420
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "clamp(1.15rem, 1.05rem + 0.55vw, 1.4rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Public Sans Variable, Public Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.14em"
  wordmark:
    fontFamily: "Fraunces Variable, Fraunces, Georgia, serif"
    fontSize: "1.3rem"
    fontWeight: 460
    letterSpacing: "-0.01em"
rounded:
  sm: "3px"
  md: "7px"
spacing:
  3xs: "0.25rem"
  2xs: "0.5rem"
  xs: "0.75rem"
  sm: "1rem"
  md: "1.5rem"
  lg: "2.5rem"
  xl: "4rem"
  2xl: "6rem"
  3xl: "9rem"
components:
  link-accent:
    textColor: "{colors.burnt-amber}"
    typography: "{typography.body}"
  link-accent-hover:
    textColor: "{colors.burnt-amber-deep}"
  code-inline:
    backgroundColor: "{colors.warm-cream-deep}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.sm}"
    padding: "0.1em 0.35em"
  code-block:
    backgroundColor: "{colors.warm-cream-deep}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "1rem 1.15rem"
  skip-link:
    backgroundColor: "{colors.warm-ink}"
    textColor: "{colors.warm-cream}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
---

# Design System: otter-crew

## 1. Overview

**Creative North Star: "The Quiet Workshop"**

otter-crew should feel like stepping into a well-kept workshop where finished work sits, unhurried, on warm wood under good light. The maker is clearly skilled and clearly present, but nothing is shouting for a sale. Generous whitespace, a warm and grounded palette, and confident typography do the talking. The visitor's eye goes to the work and the words first; the interface is the room, not the exhibit.

The system is tech-minimal in the truest sense: restraint *is* the craft. That means precision, rhythm, and a single confident accent, not a gradient hero with three identical feature cards. It explicitly rejects the generic SaaS marketing look, corporate stock-photo stiffness, and whatever is trending on Dribbble this quarter. If a screen could belong to any startup's landing page, it has failed and gets redone.

Density is low and reading is the point. The kit has already proved it stretches sideways: the same tokens and the same index-row primitive carry the home page, the work list, the writing list, and long-form posts without a single bespoke layout. Coherence and reuse matter more than any one flourish; the system is built to host a growing set of per-project pages next.

**Key Characteristics:**
- Calm, precise, credible. Confident without selling.
- Warm-tinted neutrals (hue 56 to 80 in OKLCH); one earthy accent used sparingly.
- Editorial type: Fraunces serif for voice, Public Sans for reading.
- Whitespace and hairline rules as the primary structural material; no resting shadows, no boxes.
- Actions are typographic (links with a nudging arrow), not buttons. One coherent identity that scales sideways.

## 2. Colors

A warm, grounded palette: an earthy amber over cream and warm ink, never cold or clinical. *(Restrained strategy: tinted neutrals carry the surface, a single accent earns its rare appearances.)* Every value is authored in OKLCH; the project bans raw hex, so the frontmatter carries OKLCH directly and Stitch's sRGB-hex linter warning is expected and acceptable here.

### Primary
- **Burnt Amber** (`oklch(58% 0.118 56)`): The lone accent. Reserved for the single most important mark on a screen: the active link color, the arrow-link CTA, the hero status dot, text selection, the focus ring, the nav underline. Its scarcity is the entire point. **Burnt Amber Deep** (`oklch(49% 0.112 52)`) is the hover/press shade only, never a second accent.

### Neutral
- **Warm Cream** (`oklch(97.3% 0.011 80)`): The dominant background, a warm off-white tinted toward the amber hue. Never pure `#fff`.
- **Warm Cream Deep** (`oklch(95.2% 0.013 80)`): A slightly deeper cream for quiet tonal layering, inline code, and code blocks. This is how the system signals a recessed surface instead of a shadow.
- **Warm Ink** (`oklch(26% 0.014 62)`): Primary text and headings, a near-black tinted warm. Never pure `#000`.
- **Warm Ink Soft** (`oklch(40% 0.015 62)`): Secondary prose, ledes, summaries, the softened body voice under a title.
- **Muted Stone** (`oklch(55% 0.016 64)`): Metadata, captions, nav labels at rest, and section-marker text. The quietest readable gray.
- **Hairline** (`oklch(89% 0.014 80)`): Every divider and border. The system's structure is drawn almost entirely in 1px hairlines of this color.

### Named Rules
**The One Voice Rule.** The burnt-amber accent appears on no more than ~10% of any given screen. If two things are amber, neither is special. When in doubt, the accent stays out and hierarchy comes from type and space instead.

**The No-Pure-Black-or-White Rule.** Every neutral is tinted toward the amber hue (chroma 0.011 to 0.016 is enough). Pure `#000` and `#fff` are forbidden; they read cold and break the warmth the whole system depends on.

**The Hairline-Not-Box Rule.** Structure is drawn with single 1px hairlines (`hairline`), not boxes or fills. A list of work is a stack of rows separated by rules, never a grid of bordered cards.

## 3. Typography

**Display Font:** Fraunces Variable (with Georgia, Times New Roman, serif fallback)
**Body Font:** Public Sans Variable (with system-ui, sans-serif fallback)
**Mono Font:** ui-monospace, SF Mono, Cascadia Code, Menlo, Consolas (code only)

**Character:** Editorial and human. Fraunces, optical-sizing on and set at light weights, carries warmth and an authored voice; Public Sans handles reading quietly and gets out of the way. The pairing reads like a well-set essay, not a product brochure. Fonts are self-hosted via Fontsource variable files.

### Hierarchy
- **Display** (Fraunces, weight 320, `clamp(2.7rem, 1.6rem + 4.8vw, 4.75rem)`, line-height 1.02, tracking -0.022em): The home hero only. Light weight at large size is the signature; the italic cut (`em`) carries the emphasis.
- **Headline** (Fraunces, weight 360, `clamp(2.05rem, ..., 3.1rem)`, line-height 1.08, tracking -0.018em): Page titles (`PageHeader`, post titles, 404). One per page.
- **Title** (Fraunces, weight 420, `clamp(1.45rem, ..., 1.95rem)`, line-height 1.15): Project names, post titles in lists, prose `h2`. The structural workhorse heading.
- **Lede** (Public Sans, weight 400, `clamp(1.15rem, ..., 1.4rem)`, line-height 1.5): The one-paragraph introduction under a title, the hero supporting line, the contact line. Always in Warm Ink Soft.
- **Body** (Public Sans, weight 400, 1.0625rem, line-height 1.6; 1.75 inside `.prose`): All reading. Capped at 65ch (`--measure`) so the blog stays legible.
- **Small** (Public Sans, 0.9rem): Nav links, dates, roles, summaries, footer. The quiet connective text.
- **Label** (Public Sans, weight 600, 0.75rem, tracking 0.14em, uppercase): The section-marker and status labels. The site's one repeated label system, used deliberately as an "index" voice.
- **Wordmark** (Fraunces, weight 460, 1.3rem, tracking -0.01em): The `otter-crew` mark in header and footer; off the prose scale.

### Named Rules
**The Scale-and-Weight Rule.** Hierarchy comes from real contrast in size and weight (at least a 1.25 ratio between steps), never from color. A flat scale where everything is "kind of big" is prohibited.

**The Light-Display Rule.** Fraunces display and headline sit at weights 320 to 420, lighter than the body's effective weight. The serif gets *larger and lighter*, not bolder, as it goes up the scale. Heavy display weights break the calm.

## 4. Elevation

The system is **flat by default**. Depth is conveyed by two means only: 1px **hairline** rules that separate stacked content, and a half-step **tonal shift** to Warm Cream Deep behind recessed surfaces (inline code, code blocks). There are no resting shadows anywhere in the shipping UI.

One shadow token exists, held in reserve: `--shadow-lift` (`0 10px 30px -14px oklch(40% 0.04 60 / 0.28)`), a warm-tinted, diffuse, downward lift. It is defined for a future hover/lift response and is currently unused. When it is finally applied, it must be a *response* to state, never ambient decoration.

### Named Rules
**The Flat-By-Default Rule.** Surfaces sit flat on the cream. Shadows appear only as a *response* to state (hover, focus, lift), never as resting ornamentation. If a card has a drop shadow while nothing is happening, the shadow is wrong.

**The Tonal-Recess Rule.** A recessed surface (code, a quiet panel) is signaled by stepping the background down to Warm Cream Deep with a hairline border, not by an inset shadow.

## 5. Components

The kit is deliberately small and link-driven. There are no `<button>` elements and no form inputs: this is a static reading site, and every action is a typographic link. Document and reuse these primitives rather than inventing new shapes.

### Links (the action vocabulary)
This system has no buttons. Calls to action are links, and there are two:
- **Arrow link** (`.arrow-link`): An inline accent link in Burnt Amber, weight 500, with a trailing `→` that slides 0.25em right on hover while the color deepens to Burnt Amber Deep. This is the primary CTA shape ("Start a conversation", "All work").
- **Text link** (`.text-link`): An inline accent link with an underline drawn at 38% accent opacity that fills to full color on hover. Used inside running prose and the contact line.

### Navigation
- **Style:** A row of Small links in Muted Stone, separated by fluid gaps. The wordmark sits opposite, baseline-aligned, under a single hairline bottom border.
- **States:** Links go to Warm Ink on hover and when active. The active/hover signal is a 1px Burnt Amber underline that *wipes in from the left* (`::after`, animating `right` from 100% to 0). Never a fill, a pill, or a box.
- **Mobile:** The same row; gaps clamp down. No hamburger.

### Index Row (signature component)
The defining primitive. Both projects and posts render as a two-column ledger row, not a card:
- **Shape:** `grid-template-columns: 9rem 1fr`. Left column holds metadata (a Fraunces numeral year + an uppercase Label status, or a date); right column holds the Title, summary, and footer.
- **Separation:** A 1px hairline on top of every row, with a closing hairline under the last. No background, no border box, no radius.
- **Behavior:** Both post and project rows are fully linked via a stretched title link (the title is the only anchor; a `::after` overlay covers the whole row), so the entire ledger row is the click target while the link's accessible name stays just the title (an external link appends a visually-hidden "(opens in a new tab)"). On hover the Title shifts to Burnt Amber and the trailing arrow nudges (right for an internal `→`, up-and-out for an external `↗`). A project with no destination yet (a coming-soon entry) renders its title as plain text and stays deliberately inert; its title dims to Warm Ink Soft and the "Coming soon" status in the meta column reads it as a placeholder, so the one live row stays the actionable one. An external project link opens in a new tab, swaps its arrow to `↗`, and names its destination host (e.g. `github.com`) as a quiet footer label so the off-site jump is no surprise.
- **Responsive:** Below 38rem the grid collapses to one column; the meta row turns horizontal and tightens.

### Section Marker (signature component)
- **Style:** A short 1.75rem hairline rule followed by an uppercase, 0.14em-tracked Label in Muted Stone. The site's single repeated label system, used as an editorial "index" voice above each section ("Selected work", "Recent writing", "Contact").
- **Semantics:** When the marker labels a real section it renders as a heading (`as="h2"`) so it joins the document outline and the page's structure is legible to screen-reader heading navigation; the items inside that section drop a level accordingly (a `PostItem`/`ProjectItem` `headingLevel={3}`). As a kicker *above* a page `<h1>` (the `PageHeader` eyebrow, the consulting and 404 lead-ins) it stays a `<p>`. Appearance is identical either way; only the tag changes.
- **Discipline:** One per section, never stacked, never colored with the accent.

### Prose
- **Measure:** Capped at 65ch.
- **Blockquote:** Fraunces italic at lede size in Warm Ink Soft, set off by start padding only. **No colored side-stripe.**
- **Code:** Inline code and blocks sit on Warm Cream Deep with a hairline border and small/medium radius. Blocks are highlighted by Shiki with the `github-light` theme; the theme background is overridden to Warm Cream Deep so code never breaks the warmth.

### Hero Status
- A small inline line: a 0.5rem Burnt Amber dot beside a Small Muted Stone availability label. The accent's smallest, most deliberate appearance.

## 6. Do's and Don'ts

### Do:
- **Do** let whitespace do the work. Vary spacing across the `3xs` to `3xl` scale for rhythm; resist filling every gap.
- **Do** keep the burnt-amber accent rare (The One Voice Rule, ~10% of any screen). Spend it on one link, the focus ring, the status dot, or selection, not several at once.
- **Do** tint every neutral toward the amber hue in OKLCH; warm cream and warm ink, never pure `#fff` or `#000`.
- **Do** build hierarchy from the Fraunces scale and *lighter-as-larger* weights (320 to 420 up top), with body capped at 65ch.
- **Do** draw structure with 1px hairlines and tonal layering; reach for `--shadow-lift` only as a state response.
- **Do** make actions typographic, an arrow link or a text link, and let the `→` nudge on hover. The site has no buttons.
- **Do** render any list of work or writing as stacked index rows (the `9rem 1fr` ledger), and reuse the section-marker above each section.
- **Do** keep the kit reusable across consulting, project pages, and the blog. One coherent identity.

### Don't:
- **Don't** ship the **generic SaaS template**: gradient hero, three identical feature cards, big hero-metric numbers, glassmorphism. This is the closest trap; tech-minimal collapses into it the moment craft slips.
- **Don't** drift into **corporate / enterprise stiffness**: stock photography, hollow buzzwords, risk-averse soullessness. The voice is one real person, not a department.
- **Don't** chase trends: no crypto-neon, no brutalism-for-its-own-sake, nothing that will not still look right in three years.
- **Don't** use gradient text, decorative glassmorphism, or colored side-stripe borders (`border-left`/`border-right` as an accent). Ever.
- **Don't** lean on cards, and never nest them. Content lists are hairline-separated rows, not bordered boxes. Most content needs no container.
- **Don't** carry the accent into two places at once on a screen, and never bold the Fraunces display to force emphasis. If everything is highlighted, nothing is.
- **Don't** add a resting drop shadow. Depth is hairlines and tonal recess until a state earns the lift.
</content>
