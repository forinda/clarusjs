// clarusjs/icons: icons from the Iconify sets a project installs (@iconify-json/<set>), for <icon> and the editor.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { iconNames, iconSets, iconSvg, resolveIcon } from '../src/icons.ts'

/** A project with the given sets installed; returns a page file inside it. */
function project(sets: Record<string, object>): { root: string; file: string } {
  const root = mkdtempSync(join(tmpdir(), 'cl-icons-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ devDependencies: Object.fromEntries(Object.keys(sets).map((s) => [`@iconify-json/${s}`, '*'])) }))
  for (const [prefix, data] of Object.entries(sets)) install(root, prefix, data)
  mkdirSync(join(root, 'src/pages'), { recursive: true })
  return { root, file: join(root, 'src/pages/index.tscl') }
}
function install(root: string, prefix: string, data: object): void {
  const dir = join(root, 'node_modules/@iconify-json', prefix)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `@iconify-json/${prefix}`, version: '1.0.0', exports: { './icons.json': './icons.json', './package.json': './package.json' } }))
  writeFileSync(join(dir, 'icons.json'), JSON.stringify({ prefix, ...data }))
}
const TEST = {
  info: { name: 'Test', total: 3 },
  width: 24,
  height: 24,
  icons: { rocket: { body: '<path d="M1 1"/>' }, wide: { body: '<path/>', width: 48 } },
  aliases: { ship: { parent: 'rocket' }, flipped: { parent: 'rocket', hFlip: true } },
}

test('an icon by set:name, with the set defaults, its own size, and aliases', () => {
  const { file } = project({ test: TEST })
  expect(resolveIcon('test:rocket', file)).toEqual({ data: { body: '<path d="M1 1"/>', width: 24, height: 24, left: 0, top: 0 } })
  expect(resolveIcon('test:wide', file)).toEqual({ data: { body: '<path/>', width: 48, height: 24, left: 0, top: 0 } })
  expect(resolveIcon('test:ship', file)).toEqual(resolveIcon('test:rocket', file))
})

test('a set without sizes uses 16×16, as Iconify does', () => {
  const { file } = project({ small: { icons: { dot: { body: '<circle/>' } } } })
  expect(resolveIcon('small:dot', file)).toEqual({ data: { body: '<circle/>', width: 16, height: 16, left: 0, top: 0 } })
})

test('a missing icon suggests the closest names; a missing set says so', () => {
  const { file } = project({ test: TEST })
  expect(resolveIcon('test:rockt', file)).toEqual({ missing: 'icon', set: 'test', suggestions: ['rocket'] })
  expect(resolveIcon('nope:x', file)).toEqual({ missing: 'set', set: 'nope' })
})

test('a set installed after a miss is found (misses are not cached)', () => {
  const { root, file } = project({ test: TEST })
  expect(resolveIcon('late:x', file)).toEqual({ missing: 'set', set: 'late' })
  install(root, 'late', { icons: { x: { body: '<g/>' } } })
  expect(resolveIcon('late:x', file)).toMatchObject({ data: { body: '<g/>' } })
})

test('sets are found from the nearest package.json above the file', () => {
  const outer = project({})
  const inner = join(outer.root, 'packages/site')
  mkdirSync(join(inner, 'src/pages'), { recursive: true })
  writeFileSync(join(inner, 'package.json'), '{}')
  install(inner, 'test', TEST)
  expect(resolveIcon('test:rocket', join(inner, 'src/pages/a.tscl'))).toMatchObject({ data: { width: 24 } })
  expect(resolveIcon('test:rocket', outer.file)).toEqual({ missing: 'set', set: 'test' })
})

test('installed sets and their icon names, for the editor', () => {
  const { file } = project({ test: TEST })
  expect(iconSets(file)).toEqual([{ prefix: 'test', name: 'Test', total: 3 }])
  expect(iconNames('test', file)).toEqual(['flipped', 'rocket', 'ship', 'wide'])
  expect(iconNames('nope', file)).toEqual([])
})

test('an alias that flips or rotates is an error naming the transform (not supported yet)', () => {
  const { file } = project({ test: TEST })
  expect(() => resolveIcon('test:flipped', file)).toThrow(/test:flipped.*hFlip/)
})

test('iconSvg: a standalone <svg> for an icon (the editor previews it)', () => {
  const data = { body: '<path/>', width: 48, height: 24, left: 2, top: 3 }
  expect(iconSvg(data, 'width="48"')).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 3 48 24" width="48"><path/></svg>')
})

test("names of built-in object properties aren't icons (constructor, toString, __proto__)", () => {
  const { file } = project({ test: TEST })
  for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(resolveIcon(`test:${name}`, file), name).toMatchObject({ missing: 'icon' })
  expect(iconNames('test', file)).not.toContain('constructor')
})
