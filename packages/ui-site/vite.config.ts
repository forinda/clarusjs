import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'
import { themeDocs } from '@clarusjs/theme-docs/vite.js'
import { APPLY_SCRIPT, FLAVOR_SCRIPT, SCHEME_SCRIPT } from './src/theme/apply.ts'
import tailwindcss from '@tailwindcss/vite'
import { SIDEBAR_SCRIPT } from '@clarusjs/ui-primitives/sidebar.js'
import type { Connect, Plugin } from 'vite'
import cities from './src/api/cities.ts'

// /api/cities in `vite` and `vite preview`, as the Netlify Function answers it on the site.
const api: Connect.NextHandleFunction = async (req, res, next) => {
  if (!req.url?.startsWith('/api/cities')) return next()
  const answer = cities(new Request(new URL(req.url, 'http://localhost')))
  res.setHeader('content-type', 'application/json')
  res.end(await answer.text())
}
const citiesApi: Plugin = { name: 'ui-site:cities-api', configureServer: (s) => void s.middlewares.use(api), configurePreviewServer: (s) => void s.middlewares.use(api) }

export default defineConfig({
  plugins: [
    citiesApi,
    // Only the Tailwind parity page imports tailwind.css; nothing else on the site uses Tailwind.
    tailwindcss(),
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
          // The header's light/dark choice, followed by block frames too, as soon as it changes (src/theme/apply.ts).
          ['script', { id: 'ui-scheme' }, SCHEME_SCRIPT],
          // A collapsed sidebar, remembered, applied before the first paint (@clarusjs/ui-primitives).
          ['script', { id: 'ui-sidebar-apply' }, SIDEBAR_SCRIPT],
          // CSS or Tailwind code on the component pages, as last chosen (src/theme/apply.ts).
          ['script', { id: 'ui-flavor' }, FLAVOR_SCRIPT],
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
