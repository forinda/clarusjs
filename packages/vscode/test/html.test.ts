// Hover and completion for the HTML in .tscl files, with the file's imported components as tags (their inputs as
// attributes), as the extension serves them. No VS Code here: the extension only converts these results.
import { expect, test } from 'vitest'
import { htmlFeatures } from '../src/html.ts'

const files: Record<string, string> = {
  '/app/src/components/card.tscl': "@input title: string\n@input tags: string[] = []\n@model open: boolean = false\n\n<h2>{{ title }}</h2>\n",
  '/app/src/components/rating.tscl': "<script>\n  let stars = state(0)\n  function pick(n, el) { stars = n; el.dispatchEvent(new CustomEvent('rate', { bubbles: true, detail: n })) }\n  const clear = (el) => el.dispatchEvent(new CustomEvent(\"rating:clear\"))\n</script>\n<button (click)=\"pick(5, $event.target)\">★</button>\n",
}
const features = htmlFeatures((path) => files[path])
const page = '/app/src/pages/index.tscl'
const at = (text: string, marker: string) => text.indexOf(marker)

test('hover on an HTML tag and an attribute shows its documentation', () => {
  const text = '<div class="a">hi</div>\n'
  expect(features.hover(text, page, 2)?.markdown).toMatch(/div/i)
  const attr = features.hover(text, page, at(text, 'class') + 1)
  expect(attr?.markdown.length).toBeGreaterThan(10)
  expect(attr).toMatchObject({ start: at(text, 'class'), end: at(text, 'class') + 'class'.length })
})

test('hover on an imported component shows where it comes from and its inputs', () => {
  const text = "@import card from '../components/card.tscl'\n<card [title]=\"'x'\" />\n"
  const hover = features.hover(text, page, at(text, '<card') + 2)?.markdown ?? ''
  expect(hover).toContain('../components/card.tscl')
  expect(hover).toContain('title: string')
  expect(hover).toContain('tags?: string[]')
  expect(hover).toContain('[(open)]')
})

test('no hover inside expressions and scripts (TypeScript covers those)', () => {
  const text = '<script>\n  let div = state(1)\n</script>\n<p>{{ div }}</p>\n'
  expect(features.hover(text, page, at(text, 'div'))).toBeNull()
  expect(features.hover(text, page, text.lastIndexOf('div'))).toBeNull()
})

test('completion: HTML tags, imported components, and their inputs as bindings', () => {
  const text = "@import card from '../components/card.tscl'\n<ca"
  const tags = features.complete(text, page, text.length).map((c) => c.label)
  expect(tags).toContain('card')
  expect(tags).toContain('canvas')
  const inTag = "@import card from '../components/card.tscl'\n<card "
  const attrs = features.complete(inTag, page, inTag.length).map((c) => c.label)
  expect(attrs).toEqual(expect.arrayContaining(['[title]', '[tags]', '[open]', '[(open)]']))
  const html = '<input '
  expect(features.complete(html, page, html.length).map((c) => c.label)).toContain('type')
})

test('an import that can\'t be read is still a tag, without inputs', () => {
  const text = "@import badge from 'ui/badge.tscl'\n<badge />\n"
  expect(features.hover(text, page, at(text, '<badge') + 2)?.markdown).toContain('ui/badge.tscl')
})

test('HTML elements: [prop] and (event) bindings complete and hover, [(value)] and [(checked)] on fields', () => {
  const text = '<button '
  const labels = features.complete(text, page, text.length).map((c) => c.label)
  expect(labels).toEqual(expect.arrayContaining(['[disabled]', '[class]', '(click)', '(keydown)', 'disabled']))
  expect(labels).not.toContain('[onclick]')
  expect(labels).not.toContain('(disabled)')
  const field = '<input '
  expect(features.complete(field, page, field.length).map((c) => c.label)).toEqual(expect.arrayContaining(['[value]', '[(value)]', '[(checked)]', '(input)']))
  const select = '<div '
  expect(features.complete(select, page, select.length).map((c) => c.label)).not.toContain('[(value)]')
  const bound = '<button [disabled]="busy" (click)="save()">go</button>\n'
  expect(features.hover(bound, page, bound.indexOf('disabled') + 1)?.markdown).toMatch(/expression/)
  expect(features.hover(bound, page, bound.indexOf('click') + 1)?.markdown).toMatch(/\$event/)
})

test('a component\'s events (the CustomEvents its script dispatches) complete and show on hover', () => {
  const text = "@import rating from '../components/rating.tscl'\n<rating "
  const labels = features.complete(text, page, text.length).map((c) => c.label)
  expect(labels).toEqual(expect.arrayContaining(['(rate)', '(rating:clear)']))
  const tag = "@import rating from '../components/rating.tscl'\n<rating (rate)=\"x = $event.detail\" />\n"
  expect(features.hover(tag, page, tag.indexOf('<rating') + 2)?.markdown).toContain('(rate)')
  expect(features.hover(tag, page, tag.indexOf('(rate)') + 2)?.markdown).toContain('$event.detail')
})
