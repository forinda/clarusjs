// @vitest-environment happy-dom
// Multi-step forms: steps are [data-cl-step][id] sections of one form, one shown at a time, the current one in the
// URL hash; next() checks the current step, back() never does.
import { afterEach, beforeEach, expect, test } from 'vitest'
import { connect, form } from '../../src/forms/index.ts'
import { scope, state } from '../../src/runtime/signals.ts'

beforeEach(() => history.replaceState(null, '', '/signup'))
afterEach(() => { document.body.innerHTML = '' })

const html = `<form data-cl-form="0">
  <fieldset id="details" data-cl-step><label>Name <input required data-cl-path="name"><small data-cl-message></small></label></fieldset>
  <fieldset id="plan" data-cl-step><label>Plan <input required data-cl-path="plan"><small data-cl-message></small></label></fieldset>
  <fieldset id="confirm" data-cl-step><button>Send</button></fieldset>
</form>`

function mount() {
  document.body.innerHTML = html
  const f = form(state({ name: '', plan: '' }))
  const dispose = scope(() => connect(document.body, 0, () => f))
  const step = (id: string) => document.getElementById(id)!
  const input = (path: string) => document.querySelector(`[data-cl-path="${path}"]`) as HTMLInputElement
  return { f, dispose, step, input }
}
const fill = (el: HTMLInputElement, value: string) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })) }

test('the first step shows; the others are hidden; the form is marked as having steps', () => {
  const { f, step } = mount()
  expect(step('details').hidden).toBe(false)
  expect(step('details').hasAttribute('data-cl-current')).toBe(true)
  expect(step('plan').hidden).toBe(true)
  expect(step('confirm').hidden).toBe(true)
  expect(document.querySelector('form')!.hasAttribute('data-cl-steps')).toBe(true)
  expect(f.step).toBe('details')
  expect(f.steps.map((s) => [s.id, s.current])).toEqual([['details', true], ['plan', false], ['confirm', false]])
})

test('next() stays on a step with an error (shown, focused), then moves on once it is fixed; back() never checks', async () => {
  const { f, step, input } = mount()
  expect(await f.next()).toBe(false)
  expect(f.step).toBe('details')
  expect(f.error('name')).not.toBe('')
  expect(document.activeElement).toBe(input('name'))
  expect(f.steps[0]!.errors).toBe(1)
  fill(input('name'), 'Ada')
  expect(await f.next()).toBe(true)
  expect(f.step).toBe('plan')
  expect(location.hash).toBe('#plan')
  expect(step('details').hidden).toBe(true)
  expect(step('plan').hidden).toBe(false)
  expect(f.steps[0]!.done).toBe(true)
  f.back()
  expect(f.step).toBe('details')
  expect(location.hash).toBe('#details')
})

test('Back/Forward (popstate, hashchange) land on the step in the hash', () => {
  const { f, step } = mount()
  history.pushState(null, '', '#confirm')
  window.dispatchEvent(new PopStateEvent('popstate'))
  expect(f.step).toBe('confirm')
  expect(step('confirm').hidden).toBe(false)
  history.pushState(null, '', '#plan')
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(f.step).toBe('plan')
})

test('a reload on a step\'s hash starts there', () => {
  history.replaceState(null, '', '/signup#plan')
  const { f, step } = mount()
  expect(f.step).toBe('plan')
  expect(step('details').hidden).toBe(true)
})

test('another hash on the page (a heading anchor) leaves the form alone', () => {
  history.replaceState(null, '', '/signup#some-heading')
  const { f } = mount()
  expect(f.step).toBe('details')
  expect(location.hash).toBe('#some-heading')
  history.pushState(null, '', '#other-heading')
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(f.step).toBe('details')
})

test('focus(path) opens the step holding the field', () => {
  const { f, input } = mount()
  f.focus('plan')
  expect(f.step).toBe('plan')
  expect(document.activeElement).toBe(input('plan'))
})

test('when the island goes, the form stops listening to the URL and keeps no removed fields', () => {
  const { f, dispose } = mount()
  dispose()
  document.body.innerHTML = ''
  history.pushState(null, '', '#plan')
  window.dispatchEvent(new PopStateEvent('popstate'))
  expect(f.step).toBe('details') // no longer following the hash
  expect(f.errors).toEqual([])
})

test('review: Back to the entry the page loaded on (no hash) returns to the first step', async () => {
  const { f, input } = mount()
  input('name').value = 'Ada'
  expect(await f.next()).toBe(true)
  history.pushState(null, '', '/signup') // as Back to the first entry
  window.dispatchEvent(new PopStateEvent('popstate'))
  expect(f.step).toBe('details')
})

test('review #233 (2): next() checks the step\'s fields by their paths after waiting, not before', async () => {
  document.body.innerHTML = `<form data-cl-form="0"><fieldset id="s1" data-cl-step><label><input required data-cl-path="lines.0.item"><small data-cl-message></small></label></fieldset><fieldset id="s2" data-cl-step></fieldset></form>`
  let resolve: () => void = () => {}
  const schema = { '~standard': { version: 1 as const, vendor: 't', validate: (v: any) => new Promise((r) => { resolve = () => r({ value: v }) }) } } as any
  const f = form(state({ lines: [{ item: '' }] }), { schema })
  scope(() => connect(document.body, 0, () => f))
  const moved = f.next()
  // A valid row is added above while the check waits: the empty field is now lines.1.item.
  const empty = document.querySelector('input')!
  empty.setAttribute('data-cl-path', 'lines.1.item')
  const filled = document.createElement('input')
  filled.setAttribute('data-cl-path', 'lines.0.item')
  filled.value = 'ok'
  empty.closest('label')!.before(filled)
  resolve()
  expect(await moved).toBe(false)
})
