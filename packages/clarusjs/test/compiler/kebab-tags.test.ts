// An @imported component also answers to its name in kebab case: @import uiButton → <ui-button>, the way HTML writes
// custom elements (and the way components used by name, with no @import, are written already).
import { expect, test } from 'vitest'
import { compile } from '../../src/compiler/index.ts'
import { lint } from '../../src/compiler/lint.ts'
import { parse } from '../../src/compiler/parse.ts'

const src = (tag: string) => `@import uiButton from './button.tscl'\n<div><${tag} variant="outline">Go</${tag}></div>\n`

test('<ui-button> renders the imported uiButton, as <uiButton> does', () => {
  const code = (tag: string) => compile(src(tag), { file: 'x.tscl', target: 'server' }).code
  expect(code('ui-button')).toContain('__cl_render_uiButton(')
  expect(code('ui-button')).toBe(code('uiButton'))
})

test('the syntax tree names it by its import, so every later step (check, lint, islands) sees the component', () => {
  const el = parse(src('ui-button'), 'x.tscl').nodes.find((n) => n.type === 'element')!
  expect(el.type === 'element' && el.children.find((c) => c.type === 'element')).toMatchObject({ tag: 'uiButton' })
})

test('an import used only in kebab case is used: no unused-import warning', () => {
  expect(lint(src('ui-button'), 'x.tscl').filter((m) => m.rule === 'unused-import')).toEqual([])
})

test('only an import\'s own kebab form: other hyphenated tags stay HTML (custom elements)', () => {
  expect(compile(src('my-widget'), { file: 'x.tscl', target: 'server' }).code).not.toContain('__cl_render_uiButton(')
  // A one-word import has no kebab form: <card> is it already.
  expect(parse(`@import card from './card.tscl'\n<card-x></card-x>\n`, 'x.tscl').nodes.find((n) => n.type === 'element')).toMatchObject({ tag: 'card-x' })
})

test('PascalCase imports too: @import UiButton → <ui-button>; a one-word one (Button) never takes <button> from HTML', () => {
  expect(compile(`@import UiButton from './button.tscl'\n<div><ui-button>Go</ui-button></div>\n`, { file: 'x.tscl', target: 'server' }).code).toContain('__cl_render_UiButton(')
  const el = parse(`@import Button from './button.tscl'\n<div><button>Go</button></div>\n`, 'x.tscl').nodes.find((n) => n.type === 'element')!
  expect(el.type === 'element' && el.children.find((c) => c.type === 'element')).toMatchObject({ tag: 'button' })
  expect(parse(`@import XMLViewer from './v.tscl'\n<xml-viewer></xml-viewer>\n`, 'x.tscl').nodes.find((n) => n.type === 'element')).toMatchObject({ tag: 'XMLViewer' })
})
