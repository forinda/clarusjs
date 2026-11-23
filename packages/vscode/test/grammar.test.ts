// The .tscl grammars, tokenized as VS Code would (Shiki runs the same TextMate engine), on small cases and on every
// template of the docs site and the theme: the scopes each construct gets.
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHighlighter, type LanguageRegistration } from 'shiki'
import { beforeAll, expect, test } from 'vitest'

const read = (file: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, '..', file), 'utf8'))
const main = { ...read('syntaxes/tscl.tmLanguage.json'), name: 'tscl', embeddedLangs: ['html', 'typescript', 'css'] } as LanguageRegistration
const bindings = { ...read('syntaxes/tscl-bindings.tmLanguage.json'), name: 'tscl-bindings', injectTo: ['text.html.tscl'] } as LanguageRegistration

let highlighter: Awaited<ReturnType<typeof createHighlighter>>
beforeAll(async () => {
  highlighter = await createHighlighter({ themes: ['github-dark'], langs: ['html', 'typescript', 'css', main, bindings] })
})

/** Each token's text and its innermost scopes (all scopes joined). */
function tokens(code: string): { text: string; scopes: string }[] {
  return highlighter.codeToTokens(code, { lang: 'tscl' as never /* loaded above, not one Shiki bundles */, theme: 'github-dark', includeExplanation: true }).tokens.flat().flatMap((t) =>
    (t.explanation ?? []).map((e) => ({ text: e.content, scopes: e.scopes.map((s) => s.scopeName).join(' ') })))
}
/** The scopes of the first token whose text is `text` (after `after`, when given). */
function scopesOf(code: string, text: string, after?: string): string {
  const list = tokens(code)
  const from = after ? list.findIndex((t) => t.text.trim() === after) + 1 : 0
  const hit = list.slice(from).find((t) => t.text.trim() === text)
  if (!hit) throw new Error(`no token "${text}" in:\n${list.map((t) => `${JSON.stringify(t.text)} ${t.scopes}`).join('\n')}`)
  return hit.scopes
}

test('{{-- comments --}}', () => {
  expect(scopesOf('{{-- a note --}}\n<p></p>\n', 'a note')).toContain('comment.block.tscl')
})

test('directives: @import, @input and @model with TypeScript types, @type and @interface', () => {
  const src = "@import card from './card.tscl'\n@import type { User } from './user.ts'\n@input user: User\n@model value: string = ''\n@type Size = 'sm' | 'lg'\n@interface Named {\n  name: string\n}\n<p></p>\n"
  expect(scopesOf(src, 'import')).toContain('keyword.control.import.tscl')
  expect(scopesOf(src, 'card')).toContain('variable.other.readwrite.alias.tscl')
  expect(scopesOf(src, './card.tscl')).toMatch(/string\.quoted/)
  expect(scopesOf(src, 'input')).toContain('storage.type.tscl')
  expect(scopesOf(src, 'user')).toContain('variable.parameter.tscl')
  expect(scopesOf(src, 'User', 'user')).toContain('entity.name.type')
  expect(scopesOf(src, 'model')).toContain('storage.type.tscl')
  expect(scopesOf(src, 'string', 'value')).toContain('support.type.primitive')
  expect(scopesOf(src, 'Size')).toContain('entity.name.type.tscl')
  expect(scopesOf(src, 'Named')).toContain('entity.name.type.tscl')
  expect(scopesOf(src, 'name')).toContain('meta.directive.type.tscl') // the interface body, across lines
  expect(scopesOf(src, 'p')).toContain('entity.name.tag') // the template after the directives is HTML again
})

test('holes and blocks: {{ expression }}, @if/@else/@for with TypeScript inside, @empty, @slot', () => {
  const src = "@if (user.admin) {<b>{{ user.name.toUpperCase() }}</b>} @else {<i>guest</i>}\n@for (item of items; track item.id) {<li>{{ item }}</li>} @empty {<li>none</li>}\n<card>@slot('title') {Hi}</card>\n"
  expect(scopesOf(src, 'if')).toContain('keyword.control.flow.tscl')
  expect(scopesOf(src, 'user')).toContain('meta.embedded.expression.tscl')
  expect(scopesOf(src, 'toUpperCase')).toContain('entity.name.function')
  expect(scopesOf(src, '{{')).toContain('punctuation.section.embedded.begin.tscl')
  expect(scopesOf(src, 'else')).toContain('keyword.control.flow.tscl')
  expect(scopesOf(src, 'of')).toContain('keyword.control.flow.tscl')
  expect(scopesOf(src, 'track')).toContain('keyword.control.flow.tscl')
  expect(scopesOf(src, 'empty')).toContain('keyword.control.flow.tscl')
  expect(scopesOf(src, 'slot')).toContain('keyword.control.flow.tscl')
})

test('bindings inside tags: [prop], (event), [(model)] and {{ }} in attribute values hold TypeScript', () => {
  const src = '<button [disabled]="!ok" (click)="count++; save($event)" class="b {{ size }}">go</button>\n<field [(value)]="form.name" />\n'
  expect(scopesOf(src, 'disabled')).toContain('entity.other.attribute-name.tscl')
  expect(scopesOf(src, 'ok')).toContain('meta.embedded.expression.tscl')
  expect(scopesOf(src, 'click')).toContain('meta.attribute.event.tscl')
  expect(scopesOf(src, 'save')).toContain('entity.name.function')
  expect(scopesOf(src, 'size')).toContain('meta.embedded.expression.tscl')
  expect(scopesOf(src, 'value')).toContain('meta.attribute.model.tscl')
  expect(scopesOf(src, 'form')).toContain('meta.embedded.expression.tscl')
})

test('<script> is TypeScript; <style> is CSS', () => {
  const src = '<script>\n  let count = state(0)\n</script>\n<style>\n  p { color: red; }\n</style>\n<p>{{ count }}</p>\n'
  expect(scopesOf(src, 'let')).toContain('source.ts')
  expect(scopesOf(src, 'state')).toContain('entity.name.function')
  expect(scopesOf(src, 'color')).toContain('source.css')
})

test('every template in the docs site and the theme tokenizes, with no TypeScript left open at the end', () => {
  const roots = ['../docs/src', '../theme-docs/src'].map((r) => resolve(import.meta.dirname, '..', r))
  const files = roots.flatMap((root) => (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith('.tscl')).map((f) => resolve(root, f)))
  expect(files.length).toBeGreaterThan(30)
  for (const file of files) {
    const list = tokens(`${readFileSync(file, 'utf8')}\n<p>end</p>\n`)
    // A rule that never closed (a hole, a binding, a directive) would swallow the closing HTML as TypeScript.
    expect(list.at(-2)?.scopes ?? '', file).toMatch(/entity\.name\.tag|punctuation\.definition\.tag/)
  }
})

test('component tags (<card>, <my-card>) are tags, not unrecognized HTML; HTML tags stay HTML', () => {
  const src = '<card [title]="x" class="a">hi</card>\n<my-card a="1" />\n<div id="d"><select></select></div>\n'
  for (const name of ['card', 'my-card']) {
    const scopes = scopesOf(src, name)
    expect(scopes).toContain('entity.name.tag')
    expect(scopes).not.toContain('invalid')
  }
  expect(scopesOf(src, 'class')).toContain('entity.other.attribute-name')
  expect(scopesOf(src, 'title')).toContain('meta.attribute.property.tscl') // bindings still work in components
  expect(scopesOf(src, 'div')).toContain('entity.name.tag.html')
  expect(scopesOf(src, 'div')).not.toContain('component')
  expect(scopesOf(src, 'select')).not.toContain('component')
})

test('review #233: a one-line directive ends at its line; the next line is template', () => {
  const src = '@input title: string\nHello {{ title }}\n@type Size = \'sm\'\nBye <b>x</b>\n'
  expect(scopesOf(src, 'Hello')).not.toContain('meta.directive')
  expect(scopesOf(src, 'Bye')).not.toContain('meta.directive')
})

test('review #233: language-configuration.json is valid JSON', () => {
  expect(() => JSON.parse(readFileSync(resolve(import.meta.dirname, '../language-configuration.json'), 'utf8'))).not.toThrow()
})

test('#430: @await, @then and @catch are control keywords, with TypeScript in their parentheses', () => {
  const src = "@await (load(id)) {<i>…</i>} @then (rows) {<b>{{ rows.length }}</b>} @catch (e) {<u>{{ e }}</u>}\n"
  for (const word of ['await', 'then', 'catch']) expect(scopesOf(src, word)).toContain('keyword.control.flow.tscl')
  expect(scopesOf(src, 'load')).toContain('meta.embedded.expression.tscl')
})

test('#430: <script server> is TypeScript, like <script>', () => {
  const src = "<script server>\n  const posts = await load()\n</script>\n<p>{{ posts.length }}</p>\n"
  expect(scopesOf(src, 'const')).toContain('source.ts')
  expect(scopesOf(src, 'await')).toContain('source.ts')
})
