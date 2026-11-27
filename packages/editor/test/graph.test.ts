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
