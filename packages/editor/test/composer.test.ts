// @vitest-environment happy-dom
// <editor-composer>: a textarea from the server (it works with no JavaScript), the editor from attach with the
// textarea's text and caret; Enter sends, @ asks (search), / runs (command), files go to (files), and the limit
// disables Send. Compiled with clarusjs and attached to its own server HTML, as the loader does.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compile } from 'clarusjs/compiler'
import { afterEach, expect, test, vi } from 'vitest'

const href = (path: string) => pathToFileURL(path).href
const entry = href(resolve(import.meta.dirname, '../src/index.ts'))
const source = readFileSync(resolve(import.meta.dirname, '../src/components/composer.tscl'), 'utf8')
// clarusjs's own imports stay bare: one copy of its runtime (its signals) for the component and the editor alike.
const rewrite = (code: string) => code.replaceAll("'@clarusjs/editor'", `'${entry}'`)
async function load(target: 'server' | 'client') {
  const code = rewrite(compile(source, { file: 'composer.tscl', target, clientUrl: '/composer.js' }).code)
  mkdirSync(resolve(import.meta.dirname, '.tmp'), { recursive: true })
  const dir = mkdtempSync(resolve(import.meta.dirname, `.tmp/composer-${target}-`))
  writeFileSync(resolve(dir, 'mod.mjs'), code)
  return import(href(resolve(dir, 'mod.mjs')))
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

afterEach(() => { document.body.innerHTML = '' })

/** The composer rendered by the server inside a form, then attached; its events collected. */
async function composer(props: Record<string, unknown>, before?: (textarea: HTMLTextAreaElement) => void) {
  const { render } = await load('server')
  const { attach } = await load('client')
  const { editorOf } = await import(/* @vite-ignore */ entry)
  document.body.innerHTML = `<form>${await render(props)}</form>`
  const island = document.querySelector('cl-island')!
  const events: { name: string; value: any }[] = []
  const answers: Record<string, (value: any, event: CustomEvent) => void> = {}
  island.addEventListener('cl:event', (e) => {
    const { name, value } = (e as CustomEvent).detail
    events.push({ name, value })
    answers[name]?.(value, e as CustomEvent)
  })
  before?.(document.querySelector('textarea')!)
  attach(island, props)
  await tick()
  const field = island.querySelector<HTMLElement>('div[data-part=field]')!
  const ed = editorOf(field)
  const key = (k: string, init: KeyboardEventInit = {}) => ed.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }))
  const type = (text: string) => { for (const ch of text) ed.view.dispatch(ed.view.state.tr.insertText(ch)) }
  return { island, events, answers, field, ed, key, type, form: document.querySelector('form')! }
}

test('the server renders a labelled textarea with the value as text: no JavaScript needed to type or post', async () => {
  const { render } = await load('server')
  const html = await render({ id: 'c', name: 'msg', label: 'Reply', placeholder: 'Reply…', format: 'html', value: '<p>Hi &amp; <b>bye</b></p>' })
  expect(html).toMatch(/<textarea id="c-field" data-part="field" name="msg" placeholder="Reply…" aria-label="Reply" rows="3"[^>]*>Hi &amp; bye<\/textarea>/)
  expect(html).toContain('role="toolbar"')
  expect(html).toMatch(/<button type="submit" data-part="send"[^>]*>(<!--\[\d+-->)?Send(<!--\]-->)?<\/button>/)
  expect(compile(source, { file: 'composer.tscl', target: 'client' }).stateful).toBe(true)
})

test('on attach the editor takes over the textarea: its text, its caret, its focus; [name] moves to a hidden input', async () => {
  const { island, ed, field } = await composer({ id: 'c', name: 'msg' }, (t) => { t.value = 'a\n\nb'; t.focus(); t.setSelectionRange(3, 3) })
  expect(island.querySelector('textarea')).toBeNull()
  expect(ed.view.state.doc.toJSON().content.map((p: any) => p.content[0].text)).toEqual(['a', 'b'])
  expect(ed.view.state.selection.from).toBe(4)
  expect(document.activeElement).toBe(ed.view.dom)
  expect(field.contains(ed.view.dom)).toBe(true)
  expect(JSON.parse(island.querySelector<HTMLInputElement>('input[type=hidden][name=msg]')!.value)).toEqual(ed.view.state.doc.toJSON())
})

test('an untouched textarea keeps the rich value', async () => {
  const { ed } = await composer({ format: 'html', value: '<p><strong>bold</strong></p>' })
  expect(ed.value.get()).toBe('<p><strong>bold</strong></p>')
})

test('Enter sends (send) with the value, then clears; a cancelled send keeps the text', async () => {
  const c = await composer({ format: 'html' })
  c.type('hello')
  c.key('Enter')
  expect(c.events.filter((e) => e.name === 'send').map((e) => e.value)).toEqual([{ value: '<p>hello</p>' }])
  expect(c.ed.view.state.doc.textContent).toBe('')
  c.answers.send = (_v, e) => e.preventDefault()
  c.type('again')
  c.key('Enter')
  expect(c.ed.view.state.doc.textContent).toBe('again')
})

test('with [name] in a form, a send (not cancelled) posts the form, with the value in the field', async () => {
  const c = await composer({ name: 'msg', format: 'html' })
  const posted: string[] = []
  c.form.addEventListener('submit', (e) => { e.preventDefault(); posted.push(String(new FormData(c.form).get('msg'))) })
  c.type('hi')
  c.island.querySelector<HTMLButtonElement>('[data-part=send]')!.click()
  expect(posted).toEqual(['<p>hi</p>'])
  expect(c.ed.view.state.doc.textContent).toBe('')
})

test('@ asks (search), answered with respond(); / lists [commands] and sends (command) with the editor', async () => {
  const c = await composer({ commands: [{ id: 'giphy', label: 'Giphy' }, { id: 'poll', label: 'Poll', keywords: ['vote'] }] })
  c.answers.search = (v) => v.respond([{ id: 'u1', label: 'Mara' }].filter((p) => p.label.toLowerCase().startsWith(v.query)))
  c.type('@ma')
  await tick(250)
  const lists = c.island.querySelectorAll<HTMLElement>('[data-part=suggestions]')
  expect([...lists].map((l) => l.hidden)).toEqual([false, true, true])
  c.key('Enter')
  expect(c.ed.view.state.doc.firstChild.firstChild.type.name).toBe('mention')
  c.ed.clear()
  c.answers.command = (v) => v.editor.run('code')
  c.type('/vo')
  await tick(250)
  expect([...lists[1]!.querySelectorAll('[role=option]')].map((o) => o.textContent)).toEqual(['Poll'])
  c.key('Enter')
  expect(c.events.find((e) => e.name === 'command')!.value.id).toBe('poll')
  expect(c.ed.active('code')).toBe(true)
  expect(c.events.some((e) => e.name === 'send')).toBe(false)
})

test('files pasted, dropped, or picked with the attach button go to (files)', async () => {
  const { Slice } = await import('prosemirror-model')
  const c = await composer({})
  const file = new File(['x'], 'a.png', { type: 'image/png' })
  c.ed.view.someProp('handlePaste', (f: any) => f(c.ed.view, { clipboardData: { files: [file] } }, Slice.empty))
  const input = c.island.querySelector<HTMLInputElement>('input[type=file]')!
  const click = vi.spyOn(input, 'click').mockImplementation(() => {})
  c.island.querySelector<HTMLButtonElement>('[data-part=attach]')!.click()
  expect(click).toHaveBeenCalled()
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  expect(c.events.filter((e) => e.name === 'files').map((e) => e.value.files)).toEqual([[file], [file]])
})

test('[maxLength] shows the count, and Send is disabled past it', async () => {
  const c = await composer({ maxLength: 3 })
  const count = c.island.querySelector('[data-part=count]')!
  const send = c.island.querySelector<HTMLButtonElement>('[data-part=send]')!
  c.type('abc')
  expect(count.textContent).toBe('3/3')
  expect(send.disabled).toBe(false)
  c.type('d')
  expect(count.textContent).toBe('4/3')
  expect(send.disabled).toBe(true)
})

test(': suggests emoji by any word of their name, from the full list', async () => {
  const c = await composer({})
  c.type('nice :thumbs_u')
  await tick(250)
  const emojiList = c.island.querySelectorAll<HTMLElement>('[data-part=suggestions]')[2]!
  expect([...emojiList.querySelectorAll('[role=option]')].map((o) => o.textContent)).toEqual(['👍 :+1:'])
  c.ed.clear()
  c.type(':smiling')
  await tick(250)
  expect(emojiList.querySelectorAll('[role=option]').length).toBe(8)
  c.key('Enter')
  expect(c.ed.view.state.doc.textContent).toMatch(/^\p{Extended_Pictographic}/u)
})

test('emoji are inserted fully qualified (with the variation selector), so they draw in colour', async () => {
  const { emoji } = await import('../src/emoji.ts')
  expect(emoji.find((e) => e.name === 'red heart')!.char).toBe('❤️')
  expect(emoji.some((e) => e.name.includes('skin tone'))).toBe(false)
  expect(emoji.length).toBeGreaterThan(1900)
})
