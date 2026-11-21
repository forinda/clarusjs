// Semantic tokens for the template syntax, so editors without the TextMate grammar colour it.
import { expect, test } from 'vitest'
import { tokensOf, TOKEN_TYPES } from '../src/tokens.ts'

/** Tokens as `line:char text type`, for readable assertions. */
const show = (source: string, components: string[] = []) => {
  const lines = source.split('\n')
  return tokensOf(source, new Set(components)).map((t) => `${t.line}:${t.character} ${lines[t.line]!.slice(t.character, t.character + t.length)} ${TOKEN_TYPES[t.type]}`)
}

test('directives, blocks, holes, comments, bindings and component tags', () => {
  const source = "@import card from './card.tscl'\n{{-- a\nnote --}}\n@if (ok) {<card [title]=\"t\" (rate)=\"go()\" [(open)]=\"o\">{{ x }}</card>} @else {<i></i>}\n"
  expect(show(source, ['card'])).toEqual([
    '0:0 @import keyword',
    '1:0 {{-- a comment',
    '2:0 note --}} comment',
    '3:0 @if keyword',
    '3:11 card type',
    '3:16 [ operator',
    '3:17 title variable',
    '3:22 ] operator',
    '3:28 ( operator',
    '3:29 rate variable',
    '3:33 ) operator',
    '3:42 [( operator',
    '3:44 open variable',
    '3:48 )] operator',
    '3:55 {{ macro',
    '3:60 }} macro',
    '3:64 card type',
    '3:71 @else keyword',
  ])
})

test('a file that doesn\'t parse still gets tokens', () => {
  expect(() => tokensOf('<div>\n  @if (x {\n  <p>{{ a.', new Set())).not.toThrow()
  expect(show('<div>\n  @if (x {\n  <p>{{ a.')).toEqual(['1:2 @if keyword', '2:5 {{ macro'])
})
