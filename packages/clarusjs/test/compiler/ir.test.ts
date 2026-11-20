import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { parse } from '../../src/compiler/parse.ts'
import { lower } from '../../src/compiler/ir.ts'
import { ClarusError } from '../../src/compiler/errors.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
const lowerSource = (source: string, file = 'x.clarus') => lower(parse(source, file), file, source)
function lowerError(source: string): ClarusError {
  try { lowerSource(source) } catch (e) { return e as ClarusError }
  throw new Error('expected lower to throw')
}

test('counter lowers to statics, reactive holes and one event', () => {
  const ir = lowerSource(fixture('counter.clarus'), 'src/components/counter.clarus')
  expect(ir.name).toBe('counter')
  expect(ir.stateful).toBe(true)
  expect(ir.events).toEqual([{ index: 0, type: 'click', handler: 'add()' }])
  expect(ir.nodes).toEqual([
    { kind: 'static', html: '<button data-cl-e="0">Clicked ' },
    { kind: 'hole', expr: 'count', reactive: true, index: 0 },
    { kind: 'static', html: ' times (double: ' },
    { kind: 'hole', expr: 'double', reactive: true, index: 1 },
    { kind: 'static', html: ')</button>' },
  ])
})

test('stateless component has only non-reactive holes', () => {
  const ir = lowerSource(fixture('greeting.clarus'), 'greeting.clarus')
  expect(ir.stateful).toBe(false)
  expect(ir.nodes).toContainEqual({ kind: 'hole', expr: 'name', reactive: false, index: -1 })
})

test('imported tags become component nodes', () => {
  const ir = lowerSource(`@import counter from '../components/counter.clarus'\n<counter [start]="3" />`)
  expect(ir.nodes).toEqual([{ kind: 'component', name: 'counter', props: [{ name: 'start', expr: '3' }], children: [], fills: [], region: -1 }])
})

test('static attributes are copied and adjacent statics merged', () => {
  const ir = lowerSource('<a href="/x" hidden>y</a>')
  expect(ir.nodes).toEqual([{ kind: 'static', html: '<a href="/x" hidden>y</a>' }])
})

test('void elements get no closing tag', () => {
  expect(lowerSource('<br><input disabled>').nodes).toEqual([{ kind: 'static', html: '<br><input disabled>' }])
})

test('event binding without a script is a build error at the attribute', () => {
  const e = lowerError('<p>x</p>\n<button (click)="x()">go</button>')
  expect(e.message).toContain('event bindings need a <script>')
  expect(e.message.startsWith('x.clarus:2:9 ')).toBe(true)
})

test('[attr] on an HTML element lowers to a dynamic attribute', () => {
  const ir = lowerSource('@input t: string\n<div [title]="t">x</div>')
  expect(ir.nodes).toEqual([
    { kind: 'static', html: '<div' },
    { kind: 'attr', name: 'title', value: { expr: 't' }, reactive: false, index: -1, tag: 'div' },
    { kind: 'static', html: '>x</div>' },
  ])
})

test('component children are lowered in the parent scope', () => {
  const ir = lowerSource(`@import card from './card.clarus'\n<card>hi</card>`)
  expect(ir.nodes).toEqual([{ kind: 'component', name: 'card', props: [], children: [{ kind: 'static', html: 'hi' }], fills: [], region: -1 }])
})

test('a component inside an island gets a region when its props read state', () => {
  const ir = lowerSource(`@import badge from './badge.clarus'\n<script>let n = state(0)</script>\n<badge [label]="n" /><badge [label]="'x'" />`)
  expect(ir.nodes.filter((n) => n.kind === 'component').map((n) => (n as any).region)).toEqual([0, -1])
})
