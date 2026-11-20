import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({
  plugins: [
    clarusjs({
      // Rendered on every request; on Netlify, by a function (see the Server playground page).
      routes: { '/playground': 'server' },
      adapter: 'netlify',
    }),
  ],
})
