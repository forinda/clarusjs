#!/usr/bin/env node
// Release smoke test (#227): the packages as published, not the workspace. Packs clarusjs, @clarusjs/content and
// @clarusjs/theme-docs, installs the tarballs into a scratch project, then runs clarusjs check, vite build and
// vite preview on a small site that uses all three. Fails when an export, a file in `files` or a dependency is
// missing from a published package.
//
//   node scripts/smoke.mjs            (pnpm smoke)
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', env: { ...process.env, CI: 'true' } })
const step = (text) => console.log(`smoke: ${text}`)
const PACKAGES = ['clarusjs', 'content', 'theme-docs']

const work = mkdtempSync(join(tmpdir(), 'clarusjs-smoke-'))
const keep = process.argv.includes('--keep')
let preview
try {
  step('building and packing')
  run('pnpm', ['--filter', 'clarusjs', '--filter', '@clarusjs/content', 'build'], repo)
  const tarballs = join(work, 'tarballs')
  mkdirSync(tarballs)
  for (const dir of PACKAGES) run('pnpm', ['pack', '--pack-destination', tarballs], join(repo, 'packages', dir))
  const tgz = (prefix) => join(tarballs, readdirSync(tarballs).find((f) => f.startsWith(prefix) && f.endsWith('.tgz')))

  step('a scratch site using the tarballs')
  const app = join(work, 'app')
  const versions = JSON.parse(readFileSync(join(repo, 'packages/docs/package.json'), 'utf8')).devDependencies
  const files = {
    'package.json': JSON.stringify({
      name: 'smoke-app', private: true, type: 'module',
      dependencies: { clarusjs: `file:${tgz('clarusjs-')}`, '@clarusjs/content': `file:${tgz('clarusjs-content-')}`, '@clarusjs/theme-docs': `file:${tgz('clarusjs-theme-docs-')}` },
      devDependencies: { vite: JSON.parse(readFileSync(join(repo, 'packages/clarusjs/package.json'), 'utf8')).devDependencies.vite, typescript: versions.typescript ?? '^7.0.2' },
    }, null, 2),
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ES2023', 'DOM'], allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true } }),
    'vite.config.ts': `import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'
import { themeDocs } from '@clarusjs/theme-docs/vite.js'

export default defineConfig({ plugins: [themeDocs(), clarusjs({ sources: [markdown({ layout: '/src/layouts/docs.tscl' })] })] })
`,
    'src/theme.config.ts': `import type { ThemeConfig } from '@clarusjs/theme-docs/nav.ts'

export const config: ThemeConfig = {
  brand: { text: 'smoke' },
  sections: [{ key: 'guide', title: 'Guide', href: '/guide', groups: [{ title: 'Start', items: [{ title: 'Guide', href: '/guide' }] }] }],
}
`,
    'src/layouts/docs.tscl': `@import theme from '@clarusjs/theme-docs/layout.tscl'
@import { config } from '../theme.config.ts'
@input title: string
@input path: string = '/'

<theme [config]="config" [title]="title" [path]="path"><slot /></theme>
`,
    'src/components/counter.tscl': `@input start: number = 0

<script>
  let count = state(start)
</script>

<button type="button" (click)="count++">Count {{ count }}</button>
`,
    'src/pages/index.tscl': `@import docs from '../layouts/docs.tscl'
@import counter from '../components/counter.tscl'
@import callout from '@clarusjs/theme-docs/callout.tscl'

<docs [title]="'Home'" [path]="'/'">
  <h1>Smoke home</h1>
  <callout [type]="'tip'">From the theme.</callout>
  <counter [start]="2" />
</docs>
`,
    'src/pages/guide.md': '---\ntitle: Guide\n---\n\n# Smoke guide\n\nWritten in **Markdown**.\n\n```ts\nconst x = 1\n```\n',
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(app, path)), { recursive: true })
    writeFileSync(join(app, path), text)
  }
  run('pnpm', ['install', '--ignore-workspace', '--config.confirmModulesPurge=false'], app)

  step('clarusjs check')
  run(join(app, 'node_modules/.bin/clarusjs'), ['check'], app)
  step('vite build')
  run(join(app, 'node_modules/.bin/vite'), ['build'], app)
  const client = join(app, 'dist/client')
  const home = readFileSync(join(client, 'index.html'), 'utf8')
  const expect = (ok, what) => { if (!ok) throw new Error(`smoke: ${what}`) }
  expect(home.includes('Smoke home'), 'the home page was built')
  expect(/<cl-island c="counter"/.test(home), 'the counter is an island')
  expect(readFileSync(join(client, 'guide/index.html'), 'utf8').includes('<strong>Markdown</strong>'), 'the Markdown page was built')

  step('vite preview')
  const { spawn } = await import('node:child_process')
  preview = spawn(join(app, 'node_modules/.bin/vite'), ['preview', '--port', '4399', '--strictPort'], { cwd: app, stdio: 'ignore' })
  let res
  for (let i = 0; i < 50 && !res; i++) {
    await new Promise((r) => setTimeout(r, 200))
    res = await fetch('http://localhost:4399/guide').catch(() => undefined)
  }
  expect(res?.status === 200 && (await res.text()).includes('Smoke guide'), 'vite preview serves /guide')
  const island = /<cl-island c="counter" src="([^"]+)"/.exec(home)[1]
  expect((await fetch('http://localhost:4399' + island)).status === 200, `the island's chunk is served (${island})`)
  step('ok')
} finally {
  preview?.kill()
  if (keep) console.log(`smoke: kept ${work}`)
  else rmSync(work, { recursive: true, force: true })
}
