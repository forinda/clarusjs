import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from 'clarusjs/compiler'
import { expect, test } from 'vitest'
import { registry } from '../src/registry.ts'
import { registryDir, render, source } from './render.ts'

const page = (name: string) => resolve(import.meta.dirname, '../src/pages/components', `${name}.md`)
const files = registry.flatMap((e) => e.files.map((f) => ({ entry: e, file: `${e.name}/${f}` })))

test('every entry\'s files exist, and every registry folder has an entry', () => {
  for (const { file } of files) expect(existsSync(resolve(registryDir, file)), file).toBe(true)
  expect(readdirSync(registryDir).sort()).toEqual(registry.map((e) => e.name).sort())
})

test('every entry has a page at src/pages/components/<name>.md that shows each of its files with <<<', () => {
  for (const e of registry) {
    const md = readFileSync(page(e.name), 'utf8')
    for (const f of e.files) expect(md, `${e.name}: ${f}`).toMatch(new RegExp(`^<<< \\.\\./\\.\\./registry/${e.name}/${f.replace('.', '\\.')}`, 'm'))
  }
})

test('copied files import only ui-primitives, clarusjs and the entries they list in uses', () => {
  for (const { entry, file } of files) {
    const specifiers = [...source(file).matchAll(/(?:@import|^\s*import)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
    for (const s of specifiers) {
      const local = /^\.\/([a-z-]+)\.tscl$/.exec(s)?.[1]
      const ok = /^@clarusjs\/ui-primitives\//.test(s) || /^clarusjs(\/|$)/.test(s) || (!!local && (entry.uses.includes(local) || entry.files.includes(`${local}.tscl`)))
      expect(ok, `${file} imports ${s}`).toBe(true)
    }
  }
})

test('entries with island: false compile to no client code', () => {
  for (const { entry, file } of files) {
    if (entry.island) continue
    expect(compile(source(file), { file, target: 'client' }).code.trim(), file).toBe('export {}')
  }
})

test('styles use only --ui-* custom properties', () => {
  for (const { file } of files) {
    for (const [, name] of source(file).matchAll(/var\(--([\w-]+)/g)) expect(name, file).toMatch(/^ui-/)
  }
})

test('button: variants default, secondary, outline, ghost, destructive, link; sizes sm, md, lg', async () => {
  for (const variant of ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link']) {
    expect(await render('button/button.tscl', { variant }, { default: 'Save' })).toBe(`<button type="button" data-part="button" data-variant="${variant}" data-size="md">Save</button>`)
  }
  for (const size of ['sm', 'md', 'lg']) expect(await render('button/button.tscl', { size }, { default: 'x' })).toContain(`data-size="${size}"`)
  expect(await render('button/button.tscl', { type: 'submit' }, { default: 'Send' })).toContain('type="submit"')
  // Attributes it doesn't declare land on the <button> (#463).
  const pressed = await render('button/button.tscl', { 'aria-pressed': 'true', disabled: true }, { default: 'B' })
  expect(pressed).toMatch(/<button [^>]*aria-pressed="true"/)
  expect(pressed).toMatch(/<button [^>]* disabled[ >]/)
})
