import { defineConfig } from 'vite'
import clarujs from '../../src/vite/plugin.ts'

export default defineConfig({
  plugins: [clarujs()],
})
