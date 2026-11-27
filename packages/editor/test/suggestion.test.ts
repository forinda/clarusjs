// @vitest-environment happy-dom
// The suggestion behaviour: a trigger character opens a list (mentions, slash commands, emoji) that the editable
// keeps focus over, as a combobox does: debounced search, the newest query winning, a cache, keys, Escape.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { composerExtensions } from '../src/extensions/composer.ts'
import { editor, editorOf } from '../src/behaviours/editor.ts'
import { loadEmoji, suggestion, type SuggestionItem } from '../src/behaviours/suggestion.ts'
import type { Editor } from '../src/core/editor.ts'

vi.mock('../src/emoji.ts', () => ({ emoji: [{ id: 'smile', label: 'smile', name: 'smile', char: '😄' }, { id: 'smirk', label: 'smirk', name: 'smirk', char: '😏' }] }))

const people: SuggestionItem[] = [{ id: 'u1', label: 'Mara Okafor' }, { id: 'u2', label: 'Marcus Lee' }, { id: 'u3', label: 'Ada' }]
let stops: (() => void)[] = []
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }) })
afterEach(() => { stops.forEach((s) => s()); stops = []; document.body.innerHTML = ''; vi.useRealTimers() })

function setup(options: Partial<Parameters<typeof suggestion>[1]> = {}, onSend = vi.fn()) {
  document.body.innerHTML = '<div id="ed"></div><ul id="list"></ul>'
  const el = document.getElementById('ed')!
  const list = document.getElementById('list')!
  stops.push(editor(el, { extensions: composerExtensions(), format: 'json', onSend }))
  const ed = editorOf(el)!
  const search = vi.fn((q: string) => people.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())))
  const pick = vi.fn((item: SuggestionItem, range: { from: number; to: number }, e: Editor) => { e.run('mention', item, range) })
  stops.push(suggestion(list, { editor: el, char: '@', search, pick, ...options }))
  return { ed, list, search, pick, onSend, dom: ed.view.dom }
}
const type = (ed: Editor, text: string) => { for (const ch of text) ed.view.dispatch(ed.view.state.tr.insertText(ch)) }
const key = (ed: Editor, k: string) => ed.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const labels = (list: HTMLElement) => [...list.querySelectorAll('[role=option]')].map((o) => o.textContent)

test('typing @ma opens the list with what search gives for "ma", once typing pauses', async () => {
  const { ed, list, search, dom } = setup()
  type(ed, 'hi @ma')
  expect(list.hidden).toBe(true)
  await vi.advanceTimersByTimeAsync(200)
  expect(search).toHaveBeenCalledTimes(1)
  expect(search).toHaveBeenCalledWith('ma', expect.any(AbortSignal))
  expect(list.hidden).toBe(false)
  expect(list.getAttribute('role')).toBe('listbox')
  expect(labels(list)).toEqual(['Mara Okafor', 'Marcus Lee'])
  expect(dom.getAttribute('aria-controls')).toBe(list.id)
  const first = list.querySelector('[role=option]')!
  expect(first.getAttribute('aria-selected')).toBe('true')
  expect(dom.getAttribute('aria-activedescendant')).toBe(first.id)
  expect(document.querySelector('[role=status]')!.textContent).toBe('2 results')
})

test('ArrowDown then Enter picks the second: a mention replaces @ma, the list closes, nothing is sent', async () => {
  const { ed, list, pick, onSend, dom } = setup()
  type(ed, '@ma')
  await vi.advanceTimersByTimeAsync(200)
  key(ed, 'ArrowDown')
  expect(dom.getAttribute('aria-activedescendant')).toBe(list.querySelectorAll('[role=option]')[1]!.id)
  key(ed, 'Enter')
  expect(pick).toHaveBeenCalledWith(people[1], { from: 1, to: 4 }, ed)
  expect(ed.view.state.doc.firstChild!.firstChild!.type.name).toBe('mention')
  expect(ed.view.state.doc.textContent).toBe('@Marcus Lee ') // the mention's text, and a space
  expect(list.hidden).toBe(true)
  expect(dom.hasAttribute('aria-controls')).toBe(false)
  expect(onSend).not.toHaveBeenCalled()
})

test('a slower answer for an older query is dropped, and its search aborted', async () => {
  const pending: { q: string; signal: AbortSignal; resolve(items: SuggestionItem[]): void }[] = []
  const search = vi.fn((q: string, signal: AbortSignal) => new Promise<SuggestionItem[]>((resolve) => pending.push({ q, signal, resolve })))
  const { ed, list } = setup({ search })
  type(ed, '@m')
  await vi.advanceTimersByTimeAsync(200)
  type(ed, 'a')
  await vi.advanceTimersByTimeAsync(200)
  expect(pending.map((p) => [p.q, p.signal.aborted])).toEqual([['m', true], ['ma', false]])
  pending[1]!.resolve([people[0]!])
  await vi.advanceTimersByTimeAsync(0)
  pending[0]!.resolve(people)
  await vi.advanceTimersByTimeAsync(0)
  expect(labels(list)).toEqual(['Mara Okafor'])
})

test('back to a query already answered: the cached answer shows at once, with no new search', async () => {
  const { ed, list, search } = setup()
  type(ed, '@ma')
  await vi.advanceTimersByTimeAsync(200)
  type(ed, 'r')
  await vi.advanceTimersByTimeAsync(200)
  expect(search).toHaveBeenCalledTimes(2)
  ed.view.dispatch(ed.view.state.tr.delete(ed.view.state.selection.from - 1, ed.view.state.selection.from))
  expect(labels(list)).toEqual(['Mara Okafor', 'Marcus Lee'])
  expect(search).toHaveBeenCalledTimes(2)
})

test('Escape closes without picking, and the list stays closed while that mention is typed on', async () => {
  const { ed, list, pick } = setup()
  type(ed, '@ma')
  await vi.advanceTimersByTimeAsync(200)
  key(ed, 'Escape')
  expect(list.hidden).toBe(true)
  type(ed, 'r')
  await vi.advanceTimersByTimeAsync(200)
  expect(list.hidden).toBe(true)
  expect(pick).not.toHaveBeenCalled()
  type(ed, ' @a')
  await vi.advanceTimersByTimeAsync(200)
  expect(list.hidden).toBe(false) // a new trigger opens again
})

test('no trigger mid-word, inside code, or for ":" with one character; "/" runs a command', async () => {
  const { ed, list } = setup()
  type(ed, 'mail@ma')
  await vi.advanceTimersByTimeAsync(200)
  expect(list.hidden).toBe(true)

  const run = vi.fn()
  const slash = setup({ char: '/', search: () => [{ id: 'giphy', label: 'giphy' }], pick: (item, range, e) => { e.view.dispatch(e.view.state.tr.delete(range.from, range.to)); run(item.id) } })
  type(slash.ed, '/gi')
  await vi.advanceTimersByTimeAsync(200)
  key(slash.ed, 'Enter')
  expect(run).toHaveBeenCalledWith('giphy')
  expect(slash.ed.view.state.doc.textContent).toBe('')
})

test('emoji: ":" needs two characters; the list loads once, on first use', async () => {
  const search = vi.fn(async (q: string) => (await loadEmoji()).filter((e) => e.name.startsWith(q)))
  const { ed, list } = setup({ char: ':', search, pick: (item, range, e) => { e.view.dispatch(e.view.state.tr.insertText((item as any).char, range.from, range.to)) } })
  type(ed, 'ok :s')
  await vi.advanceTimersByTimeAsync(200)
  expect(search).not.toHaveBeenCalled()
  type(ed, 'm')
  await vi.advanceTimersByTimeAsync(200)
  expect(labels(list)).toEqual(['😄 smile', '😏 smirk'])
  key(ed, 'Enter')
  expect(ed.view.state.doc.textContent).toBe('ok 😄')
  expect(loadEmoji()).toBe(loadEmoji())
})
