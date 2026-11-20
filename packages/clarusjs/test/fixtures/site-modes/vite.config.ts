import { defineConfig } from 'vite'
import clarusjs from '../../../src/vite/plugin.ts'

export default defineConfig({ plugins: [clarusjs({ routes: { '/account/*': 'server' }, adapter: 'netlify' })] })
