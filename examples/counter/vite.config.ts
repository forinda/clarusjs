import { defineConfig } from 'vite'
import kview from '../../src/vite/plugin.ts'

export default defineConfig({
  plugins: [kview()],
})
