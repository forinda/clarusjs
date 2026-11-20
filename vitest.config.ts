import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: [
      { find: 'clarusjs/runtime/server', replacement: fileURLToPath(new URL('./src/runtime/server.ts', import.meta.url)) },
      { find: 'clarusjs/runtime', replacement: fileURLToPath(new URL('./src/runtime/index.ts', import.meta.url)) },
    ],
  },
})
