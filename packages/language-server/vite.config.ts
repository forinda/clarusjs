// Builds dist/server.js: the server with Volar, its services and the clarusjs compiler bundled in, so the package
// installs with no dependencies (see the ledger: Volar 2.4 declares a typescript <7 peer this server doesn't use).
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'src/server.ts',
    outDir: 'dist',
    target: 'node22',
    minify: true,
    rollupOptions: { output: { format: 'es', entryFileNames: 'server.js' } },
  },
  ssr: { noExternal: true, target: 'node' },
})
