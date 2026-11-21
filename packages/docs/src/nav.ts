// This site's navigation and theme settings: what @clarusjs/theme-docs shows in the header, sidebar and footer.
import type { Section, ThemeConfig } from '@clarusjs/theme-docs/nav.ts'

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
        { title: 'Tailwind CSS', href: '/guide/tailwind' },
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


// Pages written in Markdown (src/pages/**/*.md): their source file has that extension.
const MARKDOWN = new Set([
  '/guide/accessibility',
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
  '/guide/project-structure',
  '/guide/rendering-modes',
  '/guide/routing',
  '/guide/slots',
  '/guide/state',
  '/guide/stores',
  '/guide/styles',
  '/guide/tailwind',
  '/guide/type-checking',
  '/guide/what-is-clarusjs',
  '/reference/cli',
  '/reference/island-attributes',
  '/reference/runtime',
  '/reference/template-syntax',
  '/reference/vite-plugin',
])

// #region edit
/** "Edit this page" link for a route: its Markdown or .tscl source on GitHub. */
export function sourceOf(path: string): string {
  const file = path === '/' ? 'index' : path.replace(/^\//, '')
  return `https://github.com/forinda/clarusjs/edit/main/packages/docs/src/pages/${file}${MARKDOWN.has(path) ? '.md' : '.tscl'}`
}
// #endregion edit

export const theme: ThemeConfig = {
  brand: { text: 'clarus', accent: '.js', logo: '/logo.svg' },
  siteUrl: 'https://clarusjs.com',
  sections,
  social: [{ label: 'GitHub', href: 'https://github.com/forinda/clarusjs', icon: 'github' }],
  editLink: sourceOf,
  footer: 'MIT licensed. This site is built with clarusjs: its pages are static HTML, and only its interactive parts ship JavaScript.',
}
