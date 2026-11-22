// #304: the docs site's own lint rule (the Lint guide's recipe), run by `pnpm docs:check`.
import { expect, test } from 'vitest'
import { lint } from 'clarusjs/compiler'
import { noInlineStyle } from '../src/lint/no-inline-style.ts'

test('no-inline-style reports a style="…" attribute, at the attribute', () => {
  const found = lint('<p>\n  <b style="color: red">x</b>\n</p>\n', 'x.tscl', {}, [noInlineStyle])
  expect(found.map((m) => `${m.line}:${m.column} ${m.rule}: ${m.message}`)).toEqual([
    '2:6 no-inline-style: style="…" on <b>: put it in the component\'s <style> block',
  ])
})

test('bound styles ([style], [style.x]) are left alone: they change at run time', () => {
  expect(lint('<b [style]="s">x</b>\n', 'x.tscl', {}, [noInlineStyle])).toEqual([])
})
