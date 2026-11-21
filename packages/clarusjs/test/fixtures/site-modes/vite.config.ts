import { defineConfig } from 'vite'
import clarusjs from '../../../src/vite/plugin.ts'

export default defineConfig({ plugins: [clarusjs({ routes: { '/account/*': 'server', '/app/*': 'client' }, adapter: 'netlify', fragments: true, collapseWhitespace: false })] })
