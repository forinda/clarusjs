import type { Section } from '@clarusjs/theme-docs/nav.ts'

// The sidebar's skeleton: component pages (src/pages/components/, frontmatter `group` and `order`) fill it.
export const sidebar: Section[] = [
  {
    key: 'components',
    title: 'Components',
    href: '/',
    groups: [{ title: 'Get started', icon: 'rocket', items: [{ title: 'Introduction', href: '/', order: 1 }] }, { title: 'Components', icon: 'box', items: [] }],
  },
]
