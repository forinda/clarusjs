import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'
import { themeDocs } from '@clarusjs/theme-docs/vite.js'

export default defineConfig({
  plugins: [
    themeDocs(),
    clarusjs({
      // Rendered on every request; on Netlify, by a function (see the Server playground page).
      routes: { '/playground': 'server', '/tour/*': 'client' },
      adapter: 'netlify',
      // Moving between pages swaps the page instead of reloading it (see the Fragment navigation guide).
      fragments: true,
      // Paths people type out of habit (see the Routing guide): a 301 on Netlify, a forwarding page anywhere else.
      redirects: { '/docs': '/guide/getting-started' },
      // The public address: canonical URLs and social cards on every page (public/og.png unless a page sets its own).
      site: { url: 'https://clarusjs.com', name: 'clarusjs', image: '/og.png' },
      // Every page's <head>: the title template and tags all pages share (src/head.ts adds the rest).
      head: {
        titleTemplate: '%s · clarusjs',
        tags: [
          ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
          ['meta', { name: 'theme-color', content: '#0b6e70' }],
        ],
        // Structured data for search engines; each page adds its own TechArticle in the layout.
        jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'clarusjs', url: 'https://clarusjs.com' },
      },
      // Markdown pages (src/pages/**/*.md), rendered in the docs layout.
      sources: [markdown({
        layout: '/src/layouts/docs.tscl',
        // ::: tip blocks and > [!NOTE] alerts render through the site's callout component.
        container: { tag: 'callout', from: '@clarusjs/theme-docs/callout.tscl' },
        // Every highlighted code block gets the site's copy button (an island that loads on first use).
        copy: { tag: 'copy', from: '@clarusjs/theme-docs/copy.tscl' },
        // ::: quiz blocks in lessons render through the theme's quiz (its options are an island).
        quiz: { tag: 'quiz', from: '@clarusjs/theme-docs/quiz.tscl' },
      })],
    }),
  ],
})
