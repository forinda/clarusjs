// #27: pages can read the route manifest while they are prerendered.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { readManifest } from '../../src/server/manifest.ts'

const g = globalThis as { __clManifestRead?: boolean }
afterEach(() => { delete process.env.CLARUS_MANIFEST; delete g.__clManifestRead })

test('outside a build there is no manifest', () => {
  expect(readManifest()).toBeNull()
})

test('during a build it reads the manifest the build wrote, and records that it was read', () => {
  const file = resolve(mkdtempSync(resolve(tmpdir(), 'clarus-m-')), 'clarusjs-manifest.json')
  process.env.CLARUS_MANIFEST = file
  expect(readManifest()).toBeNull() // first pass: not written yet
  expect(g.__clManifestRead).toBe(true)
  writeFileSync(file, JSON.stringify({ version: 1, routes: { '/': { islands: [] } } }))
  expect(readManifest()?.routes['/']).toEqual({ islands: [] })
})
