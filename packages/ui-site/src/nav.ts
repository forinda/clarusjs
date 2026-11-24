// This site's navigation and theme settings: what @clarusjs/theme-docs shows in the header, sidebar and footer.
import { pagesNav, type ThemeConfig } from '@clarusjs/theme-docs/nav.ts'
import pages from 'virtual:theme-docs/pages'
import { sidebar } from './sidebar.ts'

export const sections = pagesNav(sidebar, pages)

export const theme: ThemeConfig = {
  brand: { text: 'clarus', accent: '.js ui', logo: '/logo.svg' },
  siteUrl: 'https://ui.clarusjs.com',
  sections,
  menuLinks: [
    { label: 'Theme', href: '/theme' },
    { label: 'Docs', href: 'https://clarusjs.com' },
  ],
  social: [{ label: 'GitHub', href: 'https://github.com/forinda/clarusjs', icon: 'github' }],
  search: true,
  editLink: 'https://github.com/forinda/clarusjs/edit/main/packages/ui-site/src/pages/:file',
  pages,
  footer: 'MIT licensed. Copy what you need: every component is yours to change. Built with clarusjs.',
}
