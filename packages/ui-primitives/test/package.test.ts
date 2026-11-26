// The package: each behaviour its own small module (an island ships only what it imports), no dependencies.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import { expect, test } from 'vitest'

const KB = 1024
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const modules = ['roving-focus', 'typeahead', 'dismiss', 'transition', 'focus-return', 'position', 'toast', 'sidebar', 'resize-column']

/** A module as a browser bundle gets it: minified, gzipped. */
async function size(entry: string): Promise<number> {
  const out = await build({
    logLevel: 'silent', configFile: false,
    build: { write: false, minify: true, lib: { entry: new URL(entry, import.meta.url).pathname, formats: ['es'], fileName: 'x' } },
  }) as { output: { code?: string }[] }[]
  return gzipSync([out].flat()[0]!.output[0]!.code!, { level: 9 }).length
}

test('no dependencies: clarusjs is a peer, and nothing else is needed at runtime', () => {
  expect(pkg.dependencies ?? {}).toEqual({})
  expect(Object.keys(pkg.peerDependencies)).toEqual(['clarusjs'])
})

test('size budget: each behaviour ≤ 1 KB gzip, all of them ≤ 3 KB', async () => {
  const each = Object.fromEntries(await Promise.all(modules.map(async (m) => [m, await size(`../src/${m}.js`)])))
  for (const [m, bytes] of Object.entries(each)) expect(bytes, `${m}: ${bytes} B gzip`).toBeLessThanOrEqual(KB)
  const all = await size('../src/index.js')
  expect(all, `all: ${all} B gzip`).toBeLessThanOrEqual(3 * KB)
  console.log('ui-primitives sizes (B gzip):', JSON.stringify({ ...each, all }))
}, 60_000)
