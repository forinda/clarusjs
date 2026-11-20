import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: [
      { find: 'kview/runtime/server', replacement: fileURLToPath(new URL('./src/runtime/server.ts', import.meta.url)) },
      { find: 'kview/runtime', replacement: fileURLToPath(new URL('./src/runtime/index.ts', import.meta.url)) },
    ],
  },
})
