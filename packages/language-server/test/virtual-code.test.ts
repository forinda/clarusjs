// The HTML view of a template (its syntax blanked, every offset kept) and the CSS views of its <style>s, as Volar's
// HTML, CSS and Emmet services see them.
import { URI } from 'vscode-uri'
import { expect, test } from 'vitest'
import { htmlView } from '../src/blank.ts'
import { tsclLanguagePlugin } from '../src/virtual-code.ts'

/** The view, with every space shown as `·` so the assertions read (the length and lines are checked too). */
const view = (source: string) => {
  const out = htmlView(source)
  expect(out.length).toBe(source.length)
  expect(out.split('\n').length).toBe(source.split('\n').length)
  return out.replace(/ /g, '·')
}

test('directives, comments and holes are blanked; HTML stays', () => {
  expect(view("@import card from './card.tscl'\n@input title: string\n{{-- note --}}\n<p class=\"a\">Hi {{ title }}</p>\n"))
    .toBe('·······························\n····················\n··············\n<p·class="a">Hi············</p>\n')
})

test('multi-line directives are blanked whole', () => {
  expect(view('@input user: {\n  name: string\n}\n@interface Named {\n  name: string\n}\n<p></p>\n'))
    .toBe('··············\n··············\n·\n··················\n··············\n·\n<p></p>\n')
})

test('blocks: @if/@else if/@else/@for/@empty/@slot openers and their closing braces', () => {
  const source = "@if (a) {<b>x</b>} @else if (b) {<i></i>} @else {<u></u>}\n@for (x of xs; track x) {<li></li>} @empty {<li></li>}\n<card>@slot('t') {<em></em>}</card>\n"
  expect(view(source)).toBe(
    '·········<b>x</b>················<i></i>·········<u></u>·\n' +
    '·························<li></li>··········<li></li>·\n' +
    '<card>············<em></em>·</card>\n',
  )
})

test('binding values are blanked; their names stay for the HTML service; script bodies are blanked', () => {
  expect(view('<input [value]="a.b" (input)="go($event)" [(checked)]="c" title="x {{ y }}">\n<script>\n  let a = 1\n</script>\n'))
    .toBe('<input·[value]="···"·(input)="··········"·[(checked)]="·"·title="x········">\n<script>\n···········\n</script>\n')
})

test('a template that doesn\'t parse still gives a view', () => {
  expect(() => htmlView('<div>\n  @if (x {\n  <p>{{ a.')).not.toThrow()
  expect(htmlView('<div>\n  @if (x {\n  <p>{{ a.').startsWith('<div>\n')).toBe(true)
})

test('the language plugin: .tscl files get an HTML view and a CSS view per <style>, mapped to the source', () => {
  const source = '<p>{{ a }}</p>\n<style>\n  p { color: red; }\n</style>\n<style>b{}</style>\n'
  const uri = URI.file('/app/src/a.tscl')
  expect(tsclLanguagePlugin.getLanguageId(uri)).toBe('tscl')
  expect(tsclLanguagePlugin.getLanguageId(URI.file('/app/src/a.ts'))).toBeUndefined()
  const code = tsclLanguagePlugin.createVirtualCode!(uri, 'tscl', { getText: (a, b) => source.slice(a, b), getLength: () => source.length, getChangeRange: () => undefined }, {} as never)!
  const [html, css0, css1] = code.embeddedCodes!
  expect(html!.languageId).toBe('html')
  expect(html!.snapshot.getText(0, html!.snapshot.getLength())).toBe(htmlView(source))
  expect(css0!.languageId).toBe('css')
  expect(css0!.snapshot.getText(0, css0!.snapshot.getLength())).toBe('\n  p { color: red; }\n')
  expect(css0!.mappings[0]!.sourceOffsets[0]).toBe(source.indexOf('\n  p {'))
  expect(css1!.snapshot.getText(0, css1!.snapshot.getLength())).toBe('b{}')
  // The HTML view maps 1:1 where it isn't blanked: the <p> at 0, the </p> after the hole.
  const kept = html!.mappings.map((m) => [m.sourceOffsets[0], m.generatedOffsets[0]])
  for (const [s, g] of kept) expect(s).toBe(g)
  expect(kept.some(([s]) => s === 0)).toBe(true)
})
