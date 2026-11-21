// This site's navigation and theme settings: what @clarusjs/theme-docs shows in the header, sidebar and footer.
import { pagesNav, type ThemeConfig } from '@clarusjs/theme-docs/nav.ts'
import pages from 'virtual:theme-docs/pages'
import { sidebar } from './sidebar.ts'

export const sections = pagesNav(sidebar, pages)

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
  '/guide/docs-theme',
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
  social: [
    { label: 'GitHub', href: 'https://github.com/forinda/clarusjs', icon: 'github' },
    { label: 'npm', href: 'https://www.npmjs.com/package/clarusjs', icon: 'npm' },
  ],
  editLink: sourceOf,
  footer: 'MIT licensed. This site is built with clarusjs: its pages are static HTML, and only its interactive parts ship JavaScript.',
}
