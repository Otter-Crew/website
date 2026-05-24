// Central site metadata. These are seed values: update author, email, and any
// social links to the real ones. `url` must match astro.config.mjs `site`.
export const site = {
  name: 'otter-crew',
  author: 'Elliott Clark',
  url: 'https://ottercrew.group',
  description:
    'The independent software studio of Elliott Clark. Consulting for teams who need a system made legible again, a few projects of its own, and writing on software, teams, companies, and AI.',
  email: 'elliott@ottercrew.group',
  availability: 'Available for select work',
  nav: [
    { label: 'Work', href: '/projects' },
    { label: 'Writing', href: '/blog' },
    { label: 'Consulting', href: '/consulting' },
  ],
} as const;

export type NavItem = (typeof site.nav)[number];
