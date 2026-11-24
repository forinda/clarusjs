import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'
import { themeDocs } from '@clarusjs/theme-docs/vite.js'
import { APPLY_SCRIPT } from './src/theme/apply.ts'
import { SIDEBAR_SCRIPT } from '@clarusjs/ui-primitives/sidebar.js'

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
        tags: [
          ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
          // A theme saved on /theme, applied to demos before the first paint (src/theme/apply.ts).
          ['script', { id: 'ui-theme-apply' }, APPLY_SCRIPT],
          // A collapsed sidebar, remembered, applied before the first paint (@clarusjs/ui-primitives).
          ['script', { id: 'ui-sidebar-apply' }, SIDEBAR_SCRIPT],
        ],
      },
      // Pages are Markdown in the site's layout; usage examples (src/registry/*-demo.tscl) and the site's own parts (src/components) by tag.
      sources: [markdown({
        layout: '/src/layouts/site.tscl',
        components: ['/src/registry', '/src/components'],
        container: { tag: 'callout', from: '@clarusjs/theme-docs/callout.tscl' },
        copy: { tag: 'copy', from: '@clarusjs/theme-docs/copy.tscl' },
      })],
    }),
  ],
})
