// Bundles the extension into two self-contained CommonJS files VS Code loads, in two builds (one would share chunks
// between them): dist/extension.js (the client; `vite build`) and dist/server.js (the clarusjs language server, with
// Volar, its services and the compiler; `vite build --mode server`). Only `vscode` stays outside.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const server = mode === 'server'
  return {
    build: {
      ssr: server ? resolve(import.meta.dirname, '../language-server/src/main.ts') : 'src/extension.ts',
      outDir: 'dist',
      emptyOutDir: !server, // the second build adds server.js beside extension.js
      target: 'node20',
      minify: true,
      rollupOptions: { external: ['vscode'], output: { format: 'cjs', entryFileNames: server ? 'server.js' : 'extension.js' } },
    },
    ssr: { noExternal: true, target: 'node' },
  }
})
