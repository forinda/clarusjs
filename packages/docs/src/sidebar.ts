import type { Section } from '@clarusjs/theme-docs/nav.ts'

// The sidebar's skeleton: the pages fill it (src/pages/<section>/, frontmatter `group` and `order`, read by themeDocs()
// in vite.config.ts); this sets the order of the groups and adds what isn't a Markdown page.
export const sidebar: Section[] = [
  {
    key: 'learn',
    title: 'Learn',
    href: '',
    groups: [{ title: 'Your first site', items: [] }, { title: 'You', items: [{ title: 'Your progress', href: '/learn/progress' }] }],
  },
  {
    key: 'guide',
    title: 'Guide',
    href: '/guide/what-is-clarusjs',
    groups: [
      { title: 'Introduction', items: [] },
      { title: 'Templates', items: [{ title: 'Verbatim', href: '/guide/verbatim', order: 8 }] },
      { title: 'Interactivity', items: [] },
      { title: 'Build & deploy', items: [
        { title: 'This site, explained', href: '/guide/explained', order: 3 },
        { title: 'Server demo', href: '/playground', order: 4 },
      ] },
      { title: 'Site quality', items: [] },
      { title: 'Tooling', items: [] },
    ],
  },
  {
    key: 'repl',
    title: 'Playground',
    href: '/repl',
    groups: [{ title: 'Playground', items: [{ title: 'Playground', href: '/repl' }] }],
  },
  {
    key: 'reference',
    title: 'Reference',
    href: '/reference/template-syntax',
    groups: [
      { title: 'Templates', items: [] },
      { title: 'APIs', items: [] },
      { title: 'Project', items: [{ title: 'Release notes', href: '/releases' }] },
    ],
  },
]
