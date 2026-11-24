// #458: automatic component imports. componentIndex() names each kebab-case file under the component folders; compile()
// imports the ones a template uses (only those), so <text-field> works without an @import.
import { expect, test } from 'vitest'
import { ClarusError, compile } from '../../src/compiler/index.ts'
import { componentIndex } from '../../src/compiler/components.ts'
import { importCode, unscoped } from '../helpers.ts'

const DIRS = ['src/components', 'src/layouts']

test('names: folders + file (always), and the file alone when no other component has it; only names with a hyphen', () => {
  const { names, skipped } = componentIndex([
    'src/components/forms/text-field.tscl',
    'src/components/forms/date-field.tscl',
    'src/components/admin/date-field.tscl',
    'src/components/user-card.tscl',
    'src/components/card.tscl',
    'src/components/TextArea.tscl',
    'src/layouts/site-shell.tscl',
  ], DIRS)
  expect(names['forms-text-field']).toBe('/src/components/forms/text-field.tscl')
  expect(names['text-field']).toBe('/src/components/forms/text-field.tscl')
  expect(names['forms-date-field']).toBe('/src/components/forms/date-field.tscl')
  expect(names['date-field']).toEqual(['/src/components/admin/date-field.tscl', '/src/components/forms/date-field.tscl']) // two: ambiguous
  expect(names['user-card']).toBe('/src/components/user-card.tscl')
  expect(names['site-shell']).toBe('/src/layouts/site-shell.tscl')
  expect(names.card).toBeUndefined() // no hyphen: it could be an HTML element; import it explicitly
  expect(skipped).toEqual(['src/components/TextArea.tscl'])
})

test('a full name wins over another component\'s short name', () => {
  const { names } = componentIndex(['src/components/text-field.tscl', 'src/components/forms/text-field.tscl'], DIRS)
  expect(names['text-field']).toBe('/src/components/text-field.tscl')
  expect(names['forms-text-field']).toBe('/src/components/forms/text-field.tscl')
})

const card = compile('@input title: string\n<section><h2>{{ title }}</h2><slot /></section>\n', { file: 'user-card.tscl', target: 'server', scope: 's' }).code
const components = { 'user-card': '/src/components/user-card.tscl', 'date-field': ['/a/date-field.tscl', '/b/date-field.tscl'] }

test('a used tag is imported; props, slots and the rest work as with @import', async () => {
  const page = compile('<user-card [title]="\'Ada\'"><p>hi</p></user-card>\n', { file: 'page.tscl', target: 'server', scope: 'p', components })
  expect(page.code).toContain("from '/src/components/user-card.tscl'")
  const { render } = await importCode(page.code, 'auto', { '/src/components/user-card.tscl': card })
  expect(unscoped(await render({}))).toBe('<section><h2>Ada</h2><p>hi</p></section>')
})

test('only used components are imported; unknown hyphenated tags stay HTML (web components)', () => {
  const out = compile('<my-widget a="1"></my-widget>\n', { file: 'page.tscl', target: 'server', components }).code
  expect(out).not.toContain('user-card')
  expect(out).toContain('<my-widget a=\\"1\\"')
  expect(out).toContain('></my-widget>')
})

test('an explicit @import is kept; an ambiguous short name is a located error naming the files', () => {
  const explicit = compile("@import userCard from './mine.tscl'\n<userCard [title]=\"'x'\" />\n", { file: 'page.tscl', target: 'server', components }).code
  expect(explicit).toContain("from './mine.tscl'")
  expect(explicit).not.toContain('/src/components/user-card.tscl')
  const at = (() => { try { compile('<p>\n  <date-field />\n</p>\n', { file: 'page.tscl', target: 'server', components }); return '' } catch (e) { return e instanceof ClarusError ? e.message : String(e) } })()
  expect(at).toMatch(/^page\.tscl:2:3 <date-field> could be \/a\/date-field\.tscl or \/b\/date-field\.tscl: use its full name/)
})
