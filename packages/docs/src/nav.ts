// The docs site's one page list. The header, sidebar, breadcrumb, previous/next links and edit links are all
// generated from it (src/layouts/docs.tscl), so they can't drift apart. Add a page here to put it in the docs.

export type Item = { title: string; href: string }
export type Group = { title: string; items: Item[] }
export type Section = { key: string; title: string; href: string; groups: Group[] }

export const sections: Section[] = [
  {
    key: 'guide',
    title: 'Guide',
    href: '/guide/what-is-clarusjs',
    groups: [
      { title: 'Introduction', items: [
        { title: 'What is clarusjs?', href: '/guide/what-is-clarusjs' },
        { title: 'Getting started', href: '/guide/getting-started' },
        { title: 'Project structure', href: '/guide/project-structure' },
        { title: 'Pages and routes', href: '/guide/routing' },
        { title: 'Rendering modes', href: '/guide/rendering-modes' },
      ] },
      { title: 'Templates', items: [
        { title: 'Components', href: '/guide/components' },
        { title: 'Inputs', href: '/guide/inputs' },
        { title: 'Holes', href: '/guide/holes' },
        { title: 'Attributes', href: '/guide/attributes' },
        { title: 'Conditionals', href: '/guide/conditionals' },
        { title: 'Lists', href: '/guide/lists' },
        { title: 'Slots', href: '/guide/slots' },
        { title: 'Verbatim', href: '/guide/verbatim' },
        { title: 'Styles', href: '/guide/styles' },
        { title: 'Markdown pages', href: '/guide/markdown' },
      ] },
      { title: 'Interactivity', items: [
        { title: 'Islands', href: '/guide/islands' },
        { title: 'State', href: '/guide/state' },
        { title: 'Shared stores', href: '/guide/stores' },
        { title: 'Components inside islands', href: '/guide/components-in-islands' },
        { title: 'Lazy attach', href: '/guide/lazy-attach' },
        { title: 'Fragment navigation', href: '/guide/fragment-navigation' },
        { title: 'Client routes', href: '/guide/client-routes' },
      ] },
      { title: 'Build & deploy', items: [
        { title: 'Static build', href: '/guide/build' },
        { title: 'Deploying', href: '/guide/deploy' },
        { title: 'This site, explained', href: '/guide/explained' },
        { title: 'Server playground', href: '/playground' },
      ] },
      { title: 'Site quality', items: [
        { title: 'Accessibility', href: '/guide/accessibility' },
      ] },
      { title: 'Tooling', items: [
        { title: 'Type checking', href: '/guide/type-checking' },
      ] },
    ],
  },
  {
    key: 'reference',
    title: 'Reference',
    href: '/reference/template-syntax',
    groups: [
      { title: 'Templates', items: [
        { title: 'Template syntax', href: '/reference/template-syntax' },
        { title: 'Island attributes', href: '/reference/island-attributes' },
      ] },
      { title: 'APIs', items: [
        { title: 'Runtime', href: '/reference/runtime' },
        { title: 'Vite plugin', href: '/reference/vite-plugin' },
        { title: 'CLI', href: '/reference/cli' },
      ] },
      { title: 'Project', items: [
        { title: 'Release notes', href: '/releases' },
      ] },
    ],
  },
]

const none: Item = { title: '', href: '' }
const flat = (s: Section) => s.groups.flatMap((g) => g.items)

/** The section a page belongs to ('' for pages outside the docs sections, like the home page). */
export function sectionKey(path: string): string {
  return sections.find((s) => flat(s).some((i) => i.href === path))?.key ?? ''
}

/** Sidebar groups for the page's section (none outside the sections). */
export function groupsOf(path: string): Group[] {
  return sections.find((s) => s.key === sectionKey(path))?.groups ?? []
}

/** "Guide › Templates" */
export function crumb(path: string): string {
  const section = sections.find((s) => s.key === sectionKey(path))
  const group = section?.groups.find((g) => g.items.some((i) => i.href === path))
  return section && group ? `${section.title} › ${group.title}` : ''
}

// #region pager
/** Previous and next pages in sidebar order; an empty item (href '') when there is none. */
export function pager(path: string): { prev: Item; next: Item } {
  const section = sections.find((s) => s.key === sectionKey(path))
  const items = section ? flat(section) : []
  const i = items.findIndex((item) => item.href === path)
  return { prev: items[i - 1] ?? none, next: items[i + 1] ?? none }
}
// #endregion pager

// Pages written in Markdown (src/pages/**/*.md): their source file has that extension.
const MARKDOWN = new Set([
  '/guide/attributes',
  '/guide/build',
  '/guide/client-routes',
  '/guide/components',
  '/guide/components-in-islands',
  '/guide/conditionals',
  '/guide/deploy',
  '/guide/fragment-navigation',
  '/guide/getting-started',
  '/guide/holes',
  '/guide/inputs',
  '/guide/islands',
  '/guide/lazy-attach',
  '/guide/lists',
  '/guide/markdown',
  '/guide/accessibility',
  '/guide/project-structure',
  '/guide/rendering-modes',
  '/guide/routing',
  '/guide/slots',
  '/guide/state',
  '/guide/stores',
  '/guide/type-checking',
  '/guide/what-is-clarusjs',
])

/** "Edit this page" link for a route. */
export function sourceOf(path: string): string {
  const file = path === '/' ? 'index' : path.replace(/^\//, '')
  return `https://github.com/forinda/clarusjs/edit/main/packages/docs/src/pages/${file}${MARKDOWN.has(path) ? '.md' : '.tscl'}`
}
