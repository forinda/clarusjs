// This site's navigation and theme settings: what @clarusjs/theme-docs shows in the header, sidebar and footer.
import { pagesNav, type ThemeConfig } from '@clarusjs/theme-docs/nav.ts'
import pages from 'virtual:theme-docs/pages'
import { sidebar } from './sidebar.ts'

export const sections = pagesNav(sidebar, pages)

export const theme: ThemeConfig = {
  brand: { text: 'clarus', accent: '.js', logo: '/logo.svg' },
  siteUrl: 'https://clarusjs.com',
  sections,
  social: [
    { label: 'GitHub', href: 'https://github.com/forinda/clarusjs', icon: 'github' },
    { label: 'npm', href: 'https://www.npmjs.com/package/clarusjs', icon: 'npm' },
  ],
  search: true,
  // #region edit
  // "Edit this page": the page's source file (:file, e.g. guide/lists.md); pages also give "Last updated".
  editLink: 'https://github.com/forinda/clarusjs/edit/main/packages/docs/src/pages/:file',
  pages,
  // #endregion edit
  footer: 'MIT licensed. This site is built with clarusjs: its pages are static HTML, and only its interactive parts ship JavaScript.',
}
