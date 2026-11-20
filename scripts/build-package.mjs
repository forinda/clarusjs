// Builds a published package's dist/, from its directory (pnpm build runs it there):
// 1. declarations, with their docs (editor hovers)
// 2. JavaScript without comments (package size)
// 3. with a tsconfig.runtime.json (clarusjs): the browser runtime again, with comments. Apps bundle and minify it,
//    and Vite reads /* @vite-ignore */ in it.
import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'

// Run as a package script, so node_modules/.bin (tsc) is on PATH; through the shell, so tsc.cmd works on Windows.
const tsc = (args) => execSync(`tsc ${args}`, { stdio: 'inherit' })

rmSync('dist', { recursive: true, force: true })
tsc('-p tsconfig.build.json --emitDeclarationOnly')
tsc('-p tsconfig.build.json --declaration false --removeComments')
if (existsSync('tsconfig.runtime.json')) tsc('-p tsconfig.runtime.json')
