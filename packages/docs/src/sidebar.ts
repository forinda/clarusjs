import type { Section } from '@clarusjs/theme-docs/nav.ts'

// The sidebar's skeleton: the pages fill it (src/pages/<section>/, frontmatter `group` and `order`, read by themeDocs()
// in vite.config.ts); this sets the order of the groups and adds what isn't a Markdown page.
export const sidebar: Section[] = [
  {
    key: 'learn',
    title: 'Learn',
    href: '',
    groups: [{ title: 'Your first site', icon: 'rocket', items: [] }, { title: 'You', icon: 'sparkles', items: [{ title: 'Your progress', href: '/learn/progress' }] }],
  },
  {
    key: 'guide',
    title: 'Guide',
    href: '/guide/what-is-clarusjs',
    groups: [
      // Icons and collapsed groups as designed (#369): the current page's group is always open.
      { title: 'Introduction', icon: 'info', items: [] },
      { title: 'Templates', icon: 'code', items: [{ title: 'Verbatim', href: '/guide/verbatim', order: 8 }] },
      { title: 'Interactivity', icon: 'box', items: [] },
      { title: 'Site quality', icon: 'shield', collapsed: true, items: [] },
      { title: 'Build & deploy', icon: 'download', collapsed: true, items: [
        { title: 'This site, explained', href: '/guide/explained', order: 3 },
        { title: 'Server demo', href: '/playground', order: 4 },
      ] },
      { title: 'Tooling', icon: 'wrench', collapsed: true, items: [] },
    ],
  },
  {
    key: 'repl',
    switch: false, // the phone drawer's switch is Learn / Guide (Reference is in its links row: nav.ts menuLinks)
    title: 'Playground',
    href: '/repl',
    groups: [{ title: 'Playground', icon: 'terminal', items: [{ title: 'Playground', href: '/repl' }] }],
  },
  {
    key: 'reference',
    switch: false,
    title: 'Reference',
    href: '/reference/template-syntax',
    groups: [
      { title: 'Templates', icon: 'code', items: [] },
      { title: 'APIs', icon: 'layers', items: [] },
      { title: 'Project', icon: 'file', items: [{ title: 'Release notes', href: '/releases' }] },
    ],
  },
]
