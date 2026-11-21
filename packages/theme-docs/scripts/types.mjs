// Generates src/vite.d.ts and src/search.d.ts from the JSDoc in the .js files (the types' only source).
// Old output goes first (tsc would read it as input), and nav.d.ts (emitted because vite.js imports nav.ts) after.
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'

const src = new URL('../src/', import.meta.url)
for (const file of ['vite.d.ts', 'search.d.ts']) rmSync(new URL(file, src), { force: true })
// Run as a package script (pnpm types): node_modules/.bin is on PATH.
execFileSync('tsc', ['-p', 'tsconfig.dts.json'], { stdio: 'inherit', shell: process.platform === 'win32' })
rmSync(new URL('nav.d.ts', src), { force: true })
