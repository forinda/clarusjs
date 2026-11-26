import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Unit tests only: e2e/ holds the Playwright tests (pnpm ui:test). The aliases are tsconfig.json's paths, so files
// that import '~/components/ui/…' (as a copied block does) load here too.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\/components\/ui\//, replacement: at('./src/registry/') },
      { find: /^~\//, replacement: at('./src/') },
    ],
  },
  test: { include: ['test/**/*.test.ts'] },
})
