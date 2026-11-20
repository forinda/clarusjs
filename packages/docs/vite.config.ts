import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'

export default defineConfig({
  plugins: [
    clarusjs({
      // Rendered on every request; on Netlify, by a function (see the Server playground page).
      routes: { '/playground': 'server', '/tour/*': 'client' },
      adapter: 'netlify',
      // Moving between pages swaps the page instead of reloading it (see the Fragment navigation guide).
      fragments: true,
      // Markdown pages (src/pages/**/*.md), rendered in the docs layout.
      sources: [markdown({
        layout: '/src/layouts/docs.tscl',
        // ::: tip blocks and > [!NOTE] alerts render through the site's callout component.
        container: { tag: 'callout', from: '/src/components/callout.tscl' },
      })],
    }),
  ],
})
