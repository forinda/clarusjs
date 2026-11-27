// The server entry ships no view code: no prosemirror-view and none of the browser behaviours in its module graph.
import { resolve } from 'node:path'
import { build } from 'vite'
import { expect, test } from 'vitest'

test('@clarusjs/editor/server imports no prosemirror-view and no behaviours', async () => {
  const out = (await build({
    configFile: false, logLevel: 'silent',
    build: { write: false, ssr: true, lib: { entry: resolve(import.meta.dirname, '../src/server.ts'), formats: ['es'], fileName: 'server' }, rollupOptions: { external: [/^node:/, 'linkedom', /^clarusjs/] } },
  })) as { output: { type: string; moduleIds?: string[] }[] }[]
  const modules = [out].flat().flatMap((o) => o.output).flatMap((c) => c.moduleIds ?? [])
  expect(modules.length).toBeGreaterThan(3)
  expect(modules.filter((m) => /prosemirror-view|[\\/]behaviours[\\/]/.test(m))).toEqual([])
}, 60_000)

test('the parts\' behaviours (registry, toolbar, suggestion) import no ProseMirror: it loads with the field alone', async () => {
  for (const entry of ['core/registry.ts', 'behaviours/toolbar.ts', 'behaviours/suggestion.ts']) {
    const out = (await build({
      configFile: false, logLevel: 'silent',
      build: { write: false, lib: { entry: resolve(import.meta.dirname, '../src', entry), formats: ['es'], fileName: 'x' }, rollupOptions: { external: [/^clarusjs/, /^@clarusjs\/ui-primitives/] } },
    })) as { output: { isEntry?: boolean; moduleIds?: string[] }[] }[]
    // what loads with the part: the entry chunk (the emoji list is imported later, on the first ":")
    const modules = [out].flat().flatMap((o) => o.output).filter((c) => c.isEntry).flatMap((c) => c.moduleIds ?? [])
    expect(modules.length, entry).toBeGreaterThan(0)
    expect(modules.filter((m) => /prosemirror|[\\/]core[\\/]editor\.ts|emoji\.ts/.test(m)), entry).toEqual([])
  }
}, 120_000)
