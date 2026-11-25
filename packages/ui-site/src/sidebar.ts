import type { Section } from '@clarusjs/theme-docs/nav.ts'

// The sidebar's skeleton and the header's links (one per section): component pages (src/pages/components/,
// frontmatter `group` and `order`) and block pages (src/pages/blocks/) fill it.
export const sidebar: Section[] = [
  {
    key: 'components',
    title: 'Components',
    href: '/components',
    groups: [{ title: 'Get started', icon: 'rocket', items: [{ title: 'Introduction', href: '/components', order: 1 }] }, { title: 'Components', icon: 'box', items: [] }],
  },
  { key: 'blocks', title: 'Blocks', href: '/blocks', groups: [{ title: 'Blocks', icon: 'layers', items: [] }] },
]
