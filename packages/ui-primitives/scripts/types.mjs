// Generates src/*.d.ts from the JSDoc in src/*.js (the types' only source). Old output goes first: tsc would read it.
import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'

const src = new URL('../src/', import.meta.url)
for (const file of readdirSync(src)) if (file.endsWith('.d.ts')) rmSync(new URL(file, src))
// Run as a package script (pnpm types): node_modules/.bin is on PATH.
execFileSync('tsc', ['-p', 'tsconfig.dts.json'], { stdio: 'inherit', shell: process.platform === 'win32' })
