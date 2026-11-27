// The suggestion behaviour, for [use] on a list: a trigger character in the editor (@, /, :) opens it, with what
// search() gives for the text typed after it. The editable keeps focus, as in a combobox: aria-controls and
// aria-activedescendant point at the list and its active option, the arrow keys move, Enter or Tab picks, Escape
// closes, and a polite status says how many results came. Search is debounced, the newest query wins (older ones are
// aborted), and answers are cached by query.
import { position } from '@clarusjs/ui-primitives/position.js'
import type { EditorState } from 'prosemirror-state'
import type { Editor } from '../core/editor.ts'
import type { Emoji } from '../emoji.ts'
import { editorOf } from '../core/registry.ts'

/**
 * One suggestion: an id, the label shown, and for emoji the character.
 * @see https://clarusjs.com/guide/editor-composer#suggestions
 */
export type SuggestionItem = { id: string; label: string; char?: string }

/**
 * What `suggestion()` takes.
 * @see https://clarusjs.com/guide/editor-composer#suggestions
 */
export type SuggestionOptions = {
  /** The element the `editor` behaviour runs on. */
  editor: Element
  char: '@' | '/' | ':'
  /** The items for what's typed after the character; `signal` aborts when a newer query replaces it. */
  search(query: string, signal: AbortSignal): Promise<SuggestionItem[]> | SuggestionItem[]
  /** Called with the chosen item and the range of the trigger and its query, to replace or run. */
  pick(item: SuggestionItem, range: { from: number; to: number }, editor: Editor): void
  /** Characters to type after the trigger before it opens. Default 2 for ":", else 0. */
  minLength?: number
}

const DEBOUNCE = 200
const HIDDEN = 'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'
let uid = 0

/**
 * Suggestions on `list`, for the editor on `options.editor`; returns the dispose.
 * @example
 * <ul [use]="(el) => suggestion(el, { editor: field, char: '@', search: findPeople, pick: (item, range, e) => e.run('mention', item, range) })"></ul>
 * @see https://clarusjs.com/guide/editor-composer#suggestions
 */
export function suggestion(list: HTMLElement, options: SuggestionOptions): () => void {
  const ed = editorOf(options.editor)
  if (!ed) throw new Error('@clarusjs/editor: suggestion() needs the element the editor behaviour runs on')
  const { view } = ed
  const char = options.char
  const min = options.minLength ?? (char === ':' ? 2 : 0)
  const esc = char.replace(/[/]/g, '\\$&')
  const pattern = new RegExp(`(?:^|\\s)${esc}([^\\s${esc}]*)$`)

  list.id ||= `cl-suggestions-${++uid}`
  list.setAttribute('role', 'listbox')
  list.hidden = true
  const status = document.createElement('div')
  status.setAttribute('role', 'status')
  status.dataset.part = 'suggestion-status'
  status.style.cssText = HIDDEN
  list.after(status)

  const cache = new Map<string, SuggestionItem[]>()
  let range: { from: number; to: number } | null = null
  let query: string | null = null
  let items: SuggestionItem[] = []
  let active = 0
  let dismissed = -1
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let unposition: (() => void) | undefined

  // the caret, as an anchor for position()
  const anchor = {
    getBoundingClientRect() {
      try {
        const c = view.coordsAtPos(range?.from ?? view.state.selection.from)
        return new DOMRect(c.left, c.top, 0, c.bottom - c.top)
      } catch {
        return view.dom.getBoundingClientRect()
      }
    },
  } as Element

  const optionId = (i: number) => `${list.id}-${i}`
  function render() {
    list.replaceChildren(...items.map((item, i) => {
      const li = document.createElement('li')
      li.id = optionId(i)
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', String(i === active))
      li.dataset.part = 'suggestion'
      li.textContent = item.char ? `${item.char} ${item.label}` : item.label
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i) })
      return li
    }))
    view.dom.setAttribute('aria-activedescendant', optionId(active))
  }
  function hide() {
    list.hidden = true
    list.replaceChildren()
    view.dom.removeAttribute('aria-controls')
    view.dom.removeAttribute('aria-activedescendant')
    unposition?.()
    unposition = undefined
  }
  function close() {
    clearTimeout(timer)
    controller?.abort()
    controller = undefined
    range = null
    query = null
    items = []
    hide()
  }
  function show(next: SuggestionItem[]) {
    items = next
    active = 0
    status.textContent = items.length ? `${items.length} result${items.length === 1 ? '' : 's'}` : 'No results'
    if (!items.length) return hide()
    render() // first: position() measures the list it places
    if (list.hidden) {
      list.hidden = false
      view.dom.setAttribute('aria-controls', list.id)
      unposition = position(list, anchor, { side: 'bottom', align: 'start' })
    }
  }
  function pick(i: number) {
    const item = items[i]
    const r = range
    close()
    if (item && r) options.pick(item, r, ed!)
  }

  /** The trigger and query before the caret, or null. */
  function match(state: EditorState) {
    const { $from, empty } = state.selection
    if (!empty || $from.parent.type.spec.code) return null
    // a line break counts as whitespace (a trigger may start a line); other leaves (a mention) don't
    const m = pattern.exec($from.parent.textBetween(0, $from.parentOffset, undefined, (leaf) => (leaf.type.name === 'hard_break' ? '\n' : '\ufffc')))
    if (!m || m[1]!.length < min) return null
    return { from: $from.pos - m[1]!.length - 1, to: $from.pos, query: m[1]! }
  }
  function update(state: EditorState) {
    const m = match(state)
    if (!m) dismissed = -1
    if (!m || m.from === dismissed) return void (range && close())
    const moved = range?.from !== m.from
    range = { from: m.from, to: m.to }
    if (m.query === query) {
      // the same query at another trigger (the caret moved to another "@ma"): the list goes there
      if (moved && !list.hidden) {
        unposition?.()
        unposition = position(list, anchor, { side: 'bottom', align: 'start' })
      }
      return
    }
    query = m.query
    clearTimeout(timer)
    controller?.abort()
    controller = undefined
    const hit = cache.get(query)
    if (hit) return show(hit)
    // a new query: the results shown are an older one's, so they go (Enter can't pick one) until it answers
    items = []
    hide()
    const q = query
    timer = setTimeout(async () => {
      const c = (controller = new AbortController())
      try {
        const result = await options.search(q, c.signal)
        if (c !== controller) return // cancelled: a newer query owns the cache and the list
        cache.set(q, result)
        show(result)
      } catch (err) {
        if (c.signal.aborted || c !== controller) return
        items = []
        hide()
        status.textContent = 'Search failed'
        console.error('[@clarusjs/editor] search failed', err) // the next query tries again
      }
    }, DEBOUNCE)
  }

  const remove = ed.addPlugin({
    view: () => ({ update: (v) => update(v.state) }),
    props: {
      handleKeyDown(v, event) {
        if (list.hidden || !items.length) return false
        if (event.isComposing || event.keyCode === 229 || v.composing) return false // an input method's key
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          active = (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          render()
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') { pick(active); return true }
        if (event.key === 'Escape') { dismissed = range!.from; close(); return true }
        return false
      },
    },
  })

  return () => {
    close()
    status.remove()
    remove()
  }
}

let emojiList: Promise<Emoji[]> | undefined
/**
 * The built-in emoji (Unicode's, with their names, groups, and GitHub's shortcodes), loaded on first call as its own
 * chunk.
 * @see https://clarusjs.com/guide/editor-composer#suggestions
 */
export function loadEmoji(): Promise<Emoji[]> {
  return (emojiList ??= import('../emoji.ts').then((m) => m.emoji))
}

/**
 * Emoji for what's typed after ":", best first: a shortcode that is it (":+1"), one that starts with it (":thumbsu"),
 * a word of the name starting with it (underscores for spaces: ":thumbs_up"), then a tag (":happy").
 * @example
 * search: (q) => searchEmoji(q)
 * @see https://clarusjs.com/guide/editor-composer#suggestions
 */
export async function searchEmoji(query: string, limit = 8): Promise<Emoji[]> {
  const q = query.toLowerCase()
  const words = ' ' + q.replace(/_/g, ' ')
  const rank = (e: Emoji) =>
    e.aliases.includes(q) ? 0
      : e.aliases.some((a) => a.startsWith(q)) ? 1
        : (' ' + e.name).includes(words) ? 2
          : e.tags.some((t) => t.startsWith(q)) ? 3
            : 4
  const found: [number, Emoji][] = []
  for (const e of await loadEmoji()) {
    const r = rank(e)
    if (r < 4) found.push([r, e])
  }
  return found.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, e]) => e) // a stable sort: Unicode's order within a rank
}
