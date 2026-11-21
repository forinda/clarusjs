// #279: a plain <style> is global now; the build says so, once per file, with its place.
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createBuilder } from 'vite'
import { expect, test } from 'vitest'
import clarusjs from '../../src/vite/plugin.ts'

test('vite build warns once about a component with a plain <style>, and not about <style scoped> or <style global>', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-style-warn-'))
  const files: Record<string, string> = {
    'src/pages/index.tscl': "@import card from '../components/card.tscl'\n@import note from '../components/note.tscl'\n<card /><note />\n<style global>\nbody { margin: 0 }\n</style>\n",
    'src/components/card.tscl': '<section>card</section>\n<style>\n  :scope { color: red; }\n</style>\n',
    'src/components/note.tscl': '<p>note</p>\n<style scoped>\n  :scope { color: blue; }\n</style>\n',
  }
  for (const [path, text] of Object.entries(files)) { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(resolve(root, path), text) }
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '../..'), resolve(root, 'node_modules/clarusjs'), 'dir')
  const warnings: string[] = []
  const logger = { info() {}, warn: (m: string) => warnings.push(m), warnOnce: (m: string) => warnings.push(m), error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false }
  await (await createBuilder({ root, configFile: false, customLogger: logger, plugins: [clarusjs()] })).buildApp()
  const ours = warnings.filter((w) => w.includes('plain <style>'))
  expect(ours).toHaveLength(1)
  expect(ours[0]).toContain('src/components/card.tscl:2:1 a plain <style> is global')
}, 60_000)
