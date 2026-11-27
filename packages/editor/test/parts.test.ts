// @vitest-environment happy-dom
// The parts, put together as a page would: <editor-field> (a textarea from the server, then the editor), and the
// parts that name it with field="id" (toolbar and tools, suggestions, count, send, files), each its own island,
// attaching before or after the field. Compiled with clarusjs and attached to their own server HTML.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compile } from 'clarusjs/compiler'
import { parseIslandData } from 'clarusjs/runtime'
import { afterEach, expect, test, vi } from 'vitest'

const href = (path: string) => pathToFileURL(path).href
const src = (path: string) => href(resolve(import.meta.dirname, '../src', path))
const SUBPATHS: Record<string, string> = {
  '@clarusjs/editor': 'index.ts', '@clarusjs/editor/registry': 'core/registry.ts', '@clarusjs/editor/toolbar': 'behaviours/toolbar.ts',
  '@clarusjs/editor/suggestion': 'behaviours/suggestion.ts', '@clarusjs/editor/plain-text': 'core/plain-text.ts', '@clarusjs/editor/editor': 'behaviours/editor.ts', '@clarusjs/editor/extensions': 'extensions/composer.ts',
}
// clarusjs's own imports stay bare: one copy of its runtime (its signals) for every part and the editor.
const rewrite = (code: string) => code.replace(/'(@clarusjs\/editor(?:\/[\w-]+)?)'/g, (m, s: string) => (SUBPATHS[s] ? `'${src(SUBPATHS[s])}'` : m))
const modules = new Map<string, any>()
async function load(name: string, target: 'server' | 'client') {
  const key = `${name}:${target}`
  if (!modules.has(key)) {
    const source = readFileSync(resolve(import.meta.dirname, `../src/components/${name}.tscl`), 'utf8')
    mkdirSync(resolve(import.meta.dirname, '.tmp'), { recursive: true })
    const dir = mkdtempSync(resolve(import.meta.dirname, `.tmp/${name}-${target}-`))
    writeFileSync(resolve(dir, 'mod.mjs'), rewrite(compile(source, { file: `${name}.tscl`, target, clientUrl: `/${name}.js` }).code))
    modules.set(key, await import(href(resolve(dir, 'mod.mjs'))))
  }
  return modules.get(key)
}
const render = async (name: string, props: object = {}, slots?: Record<string, string>) => (await load(name, 'server')).render(props, slots)
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
const island = (name: string) => document.querySelector<HTMLElement>(`cl-island[c="${name}"]`)!
/** Attaches a part's island, as the loader does: its props from its p attribute. */
async function attach(name: string, el = island(name)) {
  const update = (await load(name, 'client')).attach(el, parseIslandData(el.getAttribute('p')!))
  await tick()
  return update as (props: object) => void
}

let events: { from: string; name: string; value: any; event: CustomEvent }[] = []
const listen = (e: Event) => events.push({ from: (e.target as Element).closest('cl-island')!.getAttribute('c')!, ...(e as CustomEvent).detail, event: e as CustomEvent })
afterEach(() => { document.body.innerHTML = ''; events = []; document.removeEventListener('cl:event', listen) })

/** A chat composer: field, toolbar with bold and code block, @ / : suggestions, count, files and Send, in a form. */
async function page(field: object = {}, before?: (t: HTMLTextAreaElement) => void) {
  const tools = (await render('tool', { command: 'bold', label: 'Bold' }, { default: 'B' })) + (await render('tool', { command: 'codeBlock', label: 'Code block' }, { default: '{}' })) + (await render('tool', { command: 'link', label: 'Link' }, { default: 'L' }))
  document.body.innerHTML = '<form>'
    + await render('field', { id: 'msg', name: 'msg', ...field })
    + await render('toolbar', { field: 'msg' }, { default: tools })
    + await render('suggestions', { field: 'msg', char: '@' })
    + await render('suggestions', { field: 'msg', char: '/', commands: [{ id: 'poll', label: 'Poll', keywords: ['vote'] }] })
    + await render('suggestions', { field: 'msg', char: ':' })
    + await render('count', { field: 'msg' })
    + await render('files', {})
    + await render('send', { field: 'msg' })
    + '</form>'
  document.addEventListener('cl:event', listen)
  before?.(document.querySelector('textarea')!)
  // the parts first, as on a page whose field waits for a first focus
  for (const name of ['toolbar', 'count', 'files', 'send']) await attach(name)
  for (const el of document.querySelectorAll<HTMLElement>('cl-island[c="suggestions"]')) await attach('suggestions', el)
  const button = (sel: string) => document.querySelector<HTMLButtonElement>(sel)!
  return {
    button,
    updateField: (props: object) => {},
    async attachField() {
      const update = await attach('field')
      this.updateField = update
      const { editorOf } = await import(/* @vite-ignore */ src('core/registry.ts'))
      const ed = editorOf(document.getElementById('msg')!)
      return {
        ed,
        type: (text: string) => { for (const ch of text) ed.view.dispatch(ed.view.state.tr.insertText(ch)) },
        key: (k: string, init: KeyboardEventInit = {}) => ed.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })),
      }
    },
  }
}

test('the field from the server: a labelled textarea with the value as its text, and the format it posts: text', async () => {
  const html = await render('field', { id: 'c', name: 'msg', label: 'Reply', placeholder: 'Reply…', format: 'html', value: '<p>Hi &amp; <b>bye</b></p>' })
  expect(html).toMatch(/<textarea id="c" data-part="editor" name="msg" placeholder="Reply…" aria-label="Reply" rows="3"[^>]*>\nHi &amp; bye<\/textarea>/)
  expect(html).toMatch(/<input type="hidden" name="msg-format"[^>]* value="text"/)
  // the tools start disabled: nothing to run until the field's editor does
  expect(await render('tool', { command: 'bold', label: 'Bold' }, { default: 'B' })).toMatch(/<button type="button" data-part="tool" data-command="bold" aria-label="Bold" aria-pressed="false" disabled[^>]*>B<\/button>/)
})

test('on attach the editor takes over with the text typed and its caret; the form now posts the value and its format', async () => {
  const p = await page({}, (t) => { t.value = 'a\n\nb'; t.focus(); t.setSelectionRange(3, 3) })
  const { ed } = await p.attachField()
  expect(document.querySelector('textarea')).toBeNull()
  expect(ed.view.state.doc.toJSON().content.map((b: any) => b.content[0].text)).toEqual(['a', 'b'])
  expect(ed.view.state.selection.from).toBe(4)
  expect(document.activeElement).toBe(ed.view.dom)
  expect(document.querySelector<HTMLInputElement>('input[name="msg-format"]')!.value).toBe('json')
  expect(JSON.parse(document.querySelector<HTMLInputElement>('input[type=hidden][name=msg]')!.value)).toEqual(ed.view.state.doc.toJSON())
})

test('an untouched field keeps its rich value, and the caret where it was clicked (review 4)', async () => {
  const p = await page({ format: 'html', value: '<p>hello <strong>you</strong></p>' }, (t) => { t.value = t.value.replace(/^\n/, ''); t.focus(); t.setSelectionRange(8, 8) }) // as a browser holds it: it drops the line break after <textarea> (happy-dom doesn't)
  const { ed } = await p.attachField()
  expect(ed.value.get()).toBe('<p>hello <strong>you</strong></p>')
  expect(ed.view.state.selection.from).toBe(9) // after "hello yo"
})

test('parts attached before the field wire up when it does: tools enable, bold toggles, the count follows', async () => {
  const p = await page({ maxLength: 3 })
  expect(p.button('[data-command=bold]').disabled).toBe(true)
  const { ed, type } = await p.attachField()
  expect(p.button('[data-command=bold]').disabled).toBe(false)
  expect(p.button('[data-command=link]').disabled).toBe(false) // review C1: link too, once wired
  type('ab')
  ed.view.dispatch(ed.view.state.tr.setSelection((ed.view.state.selection.constructor as any).create(ed.view.state.doc, 1, 3)))
  p.button('[data-command=bold]').click()
  expect(ed.active('bold')).toBe(true)
  expect(p.button('[data-command=bold]').getAttribute('aria-pressed')).toBe('true')
  const count = document.querySelector('[data-part=count]')!
  expect(count.textContent).toBe('2/3')
  ed.view.dispatch(ed.view.state.tr.insertText('cd', 3))
  expect(count.textContent).toBe('4/3')
  expect(count.hasAttribute('data-over')).toBe(true)
  expect(p.button('[data-part=send]').disabled).toBe(true)
})

test('Send sends through the field ((send) fires, then it clears and the form posts); before the editor, the form posts as it is', async () => {
  const p = await page({ format: 'html' })
  const form = document.querySelector('form')!
  const posted: [string, string][] = []
  form.addEventListener('submit', (e) => { e.preventDefault(); const d = new FormData(form); posted.push([String(d.get('msg')), String(d.get('msg-format'))]) })
  const early = new MouseEvent('click', { bubbles: true, cancelable: true })
  p.button('[data-part=send]').dispatchEvent(early)
  expect(early.defaultPrevented).toBe(false) // no editor yet: a plain submit
  const { ed, type } = await p.attachField()
  type('hi')
  p.button('[data-part=send]').click()
  expect(events.filter((e) => e.name === 'send').map((e) => [e.from, e.value])).toEqual([['field', { value: '<p>hi</p>' }]])
  expect(posted.map(([, format]) => format)).toEqual(['text', 'html']) // the early click posted the textarea, as without JavaScript
  expect(posted[1]![0]).toBe('<p>hi</p>')
  expect(ed.view.state.doc.textContent).toBe('')
})

test('a cancelled (send) keeps the text and posts nothing', async () => {
  const p = await page({ format: 'html' })
  const { ed, type, key } = await p.attachField()
  document.addEventListener('cl:event', (e) => { if ((e as CustomEvent).detail.name === 'send') e.preventDefault() })
  type('keep')
  key('Enter')
  expect(ed.view.state.doc.textContent).toBe('keep')
})

test('suggestions: @ asks (search) and makes a mention, / sends (command) with the editor, : inserts emoji', async () => {
  const p = await page()
  const { ed, type, key } = await p.attachField()
  document.addEventListener('cl:event', (e) => {
    const { name, value } = (e as CustomEvent).detail
    if (name === 'search') value.respond([{ id: 'u1', label: 'Mara' }].filter((x) => x.label.toLowerCase().startsWith(value.query)))
    if (name === 'command') value.editor.run('code')
  })
  type('@ma')
  const lists = [...document.querySelectorAll<HTMLElement>('[data-part=suggestions]')]
  await vi.waitFor(() => expect(lists.map((l) => l.hidden)).toEqual([false, true, true]), { timeout: 10_000 })
  key('Enter')
  expect(ed.view.state.doc.firstChild.firstChild.type.name).toBe('mention')
  ed.clear()
  type('/vo')
  await vi.waitFor(() => expect(lists[1]!.hidden).toBe(false), { timeout: 10_000 })
  key('Enter')
  expect(events.find((e) => e.name === 'command')!.value.id).toBe('poll')
  expect(ed.active('code')).toBe(true)
  ed.clear()
  type(':+1')
  // the first ":" loads the emoji list (its own chunk): wait for the list, not a fixed time (slower on CI)
  await vi.waitFor(() => expect(lists[2]!.querySelector('[role=option]')?.textContent).toBe('👍 :+1:'), { timeout: 10_000 })
  key('Enter')
  expect(ed.view.state.doc.textContent).toContain('👍')
  expect(events.some((e) => e.name === 'send')).toBe(false)
})

test('files: picked with the attach button, or pasted into the field, go to (files) from each', async () => {
  const { Slice } = await import('prosemirror-model')
  const p = await page()
  const { ed } = await p.attachField()
  const file = new File(['x'], 'a.png', { type: 'image/png' })
  ed.view.someProp('handlePaste', (f: any) => f(ed.view, { clipboardData: { files: [file] } }, Slice.empty))
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!
  const click = vi.spyOn(input, 'click').mockImplementation(() => {})
  p.button('[data-part=attach]').click()
  expect(click).toHaveBeenCalled()
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  expect(events.filter((e) => e.name === 'files').map((e) => [e.from, e.value.files])).toEqual([['field', [file]], ['files', [file]]])
})

test('review: in a form that fails its own validation, a send neither posts nor clears', async () => {
  const p = await page({ format: 'html' })
  const form = document.querySelector('form')!
  form.insertAdjacentHTML('beforeend', '<input name="title" required>')
  const submitted = vi.fn()
  form.addEventListener('submit', (e) => { e.preventDefault(); submitted() })
  const { ed, type, key } = await p.attachField()
  type('keep')
  key('Enter')
  expect(submitted).not.toHaveBeenCalled()
  expect(events.some((e) => e.name === 'send')).toBe(false)
  expect(ed.view.state.doc.textContent).toBe('keep')
})

/** Two editors on the page, "a" and "b", made with the editor behaviour; each with its own text and limit. */
async function twoFields() {
  const { editor } = await import(/* @vite-ignore */ src('behaviours/editor.ts'))
  const { editorOf } = await import(/* @vite-ignore */ src('core/registry.ts'))
  const { composerExtensions } = await import(/* @vite-ignore */ src('extensions/composer.ts'))
  const make = (id: string, text: string, maxLength: number) => {
    const el = document.createElement('div')
    el.id = id
    document.body.append(el)
    editor(el, { extensions: composerExtensions(), format: 'json', maxLength, onSend: () => events.push({ from: id, name: 'sent', value: null, event: null as any }) })
    const ed = editorOf(el)
    ed.view.dispatch(ed.view.state.tr.insertText(text))
    return ed
  }
  return { a: make('a', 'aa', 3), b: make('b', 'bbbbbbbb', 10) }
}
/** A part's island, rendered and attached; returns the update a parent island calls with new inputs. */
async function part(name: string, props: object) {
  document.body.insertAdjacentHTML('beforeend', await render(name, props))
  const el = [...document.querySelectorAll<HTMLElement>(`cl-island[c="${name}"]`)].pop()!
  const update = (await load(name, 'client')).attach(el, props)
  await tick()
  return { el, update: async (next: object) => { update({ ...props, ...next }); await tick() } }
}

test('review #648: count, send, suggestions and the toolbar follow a [field] (and char) changed by their parent', async () => {
  const { b } = await twoFields()
  const count = await part('count', { field: 'a' })
  expect(count.el.textContent).toBe('2/3')
  await count.update({ field: 'b' })
  expect(count.el.textContent).toBe('8/10')

  const send = await part('send', { field: 'a' })
  await send.update({ field: 'b' })
  send.el.querySelector('button')!.click()
  expect(events.filter((e) => e.name === 'sent').map((e) => e.from)).toEqual(['b'])

  const list = await part('suggestions', { field: 'a', char: '@' })
  await list.update({ field: 'b', char: ':' })
  b.view.dispatch(b.view.state.tr.insertText(' :+1'))
  await vi.waitFor(() => expect(list.el.querySelector('[role=option]')?.textContent).toBe('👍 :+1:'), { timeout: 10_000 })

  const tools = await render('tool', { command: 'bold', label: 'Bold' }, { default: 'B' })
  document.body.insertAdjacentHTML('beforeend', await render('toolbar', { field: 'nowhere' }, { default: tools }))
  const barEl = [...document.querySelectorAll<HTMLElement>('cl-island[c="toolbar"]')].pop()!
  const updateBar = (await load('toolbar', 'client')).attach(barEl, { field: 'nowhere' })
  expect(barEl.querySelector('button')!.disabled).toBe(true)
  updateBar({ field: 'b' })
  await tick()
  expect(barEl.querySelector('button')!.disabled).toBe(false)
})

test('review #648: the field posts the format its running editor serializes, even if [format] changes later', async () => {
  const p = await page({ format: 'json' })
  const { type } = await p.attachField()
  const marker = () => document.querySelector<HTMLInputElement>('input[name="msg-format"]')!.value
  expect(marker()).toBe('json')
  p.updateField({ id: 'msg', name: 'msg', format: 'html' }) // a parent passing a new format
  await tick()
  type('x')
  await tick()
  expect(marker()).toBe('json') // the running editor still writes JSON
  expect(() => JSON.parse(document.querySelector<HTMLInputElement>('input[type=hidden][name=msg]')!.value)).not.toThrow()
})
