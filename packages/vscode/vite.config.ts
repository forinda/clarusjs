// Bundles the extension's code (and the HTML language service) into one CommonJS file VS Code loads.
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'src/extension.ts',
    outDir: 'dist',
    target: 'node20',
    minify: true,
    rollupOptions: { external: ['vscode'], output: { format: 'cjs', entryFileNames: 'extension.js' } },
  },
  ssr: { noExternal: true },
})
