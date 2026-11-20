import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({
  plugins: [
    clarusjs({
      // Rendered on every request; on Netlify, by a function (see the Server playground page).
      routes: { '/playground': 'server', '/tour/*': 'client' },
      adapter: 'netlify',
      // Moving between pages swaps the page instead of reloading it (see the Fragment navigation guide).
      fragments: true,
    }),
  ],
})
