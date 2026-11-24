import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'
import { themeDocs } from '@clarusjs/theme-docs/vite.js'

export default defineConfig({
  plugins: [
    // The sidebar from src/pages, search, and llms.txt for AI tools.
    themeDocs({
      llms: {
        title: 'clarusjs ui',
        summary: 'Styled clarusjs components to copy into your project: .tscl files on @clarusjs/ui-primitives, themed by --ui- tokens.',
        site: 'https://ui.clarusjs.com',
      },
    }),
    clarusjs({
      // Moving between pages swaps the page instead of reloading it.
      fragments: true,
      site: { url: 'https://ui.clarusjs.com', name: 'clarusjs ui' },
      head: {
        titleTemplate: '%s · clarusjs ui',
        tags: [['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }]],
      },
      // Pages are Markdown in the site's layout; demos (src/demos) are used by tag.
      sources: [markdown({
        layout: '/src/layouts/site.tscl',
        components: '/src/demos',
        container: { tag: 'callout', from: '@clarusjs/theme-docs/callout.tscl' },
        copy: { tag: 'copy', from: '@clarusjs/theme-docs/copy.tscl' },
      })],
    }),
  ],
})
