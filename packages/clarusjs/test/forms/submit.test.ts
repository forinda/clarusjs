// @vitest-environment happy-dom
// Submit: everything is checked, and with errors the user is taken to the first one (its step, its field), with every
// error listed for a summary; server errors from the submit callback land the same way.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connect, form } from '../../src/forms/index.ts'
import type { FormOptions } from '../../src/forms/types.ts'
import { scope, state } from '../../src/runtime/signals.ts'

beforeEach(() => history.replaceState(null, '', '/signup'))
afterEach(() => { document.body.innerHTML = '' })

const html = `<form data-cl-form="0">
  <fieldset id="details" data-cl-step><label>Name <input required data-cl-path="name"><small data-cl-message></small></label></fieldset>
  <fieldset id="plan" data-cl-step><label>Plan <input required data-cl-path="plan" value="free"><small data-cl-message></small></label></fieldset>
  <fieldset id="confirm" data-cl-step><label>Email <input required data-cl-path="email"><small data-cl-message></small></label><button>Send</button></fieldset>
</form>`

type Values = { name: string; plan: string; email: string }
function mount(options: FormOptions<Values> = {}, values: Values = { name: '', plan: 'free', email: '' }) {
  document.body.innerHTML = html
  const f = form(state(values), options)
  scope(() => connect(document.body, 0, () => f))
  const input = (path: string) => document.querySelector(`[data-cl-path="${path}"]`) as HTMLInputElement
  return { f, input }
}

test('with errors, submit goes to the first one\'s step and field, and lists every error for a summary', async () => {
  const { f, input } = mount()
  f.go('confirm')
  expect(await f.submit()).toBe(false)
  expect(f.step).toBe('details')
  expect(document.activeElement).toBe(input('name'))
  expect(f.errors.map((e) => [e.path, e.step])).toEqual([['name', 'details'], ['email', 'confirm']])
  for (const e of f.errors) expect(document.getElementById(e.id)?.textContent).toBe(e.message) // links reach the message
})

test('the form\'s own submit runs it (and never reloads the page)', async () => {
  const { f } = mount()
  const event = new Event('submit', { bubbles: true, cancelable: true })
  document.querySelector('form')!.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  await vi.waitFor(() => expect(f.errors.length).toBe(2))
})

test('show: "submit" shows nothing until a submit', async () => {
  const { f, input } = mount({ show: 'submit' })
  input('name').dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  expect(f.error('name')).toBe('')
  await f.submit()
  expect(f.error('name')).not.toBe('')
})

test('valid: the submit callback gets the values once; server errors it returns land on their fields and steps', async () => {
  const submit = vi.fn(async (_values: Values) => ({ errors: { email: 'Already registered.' } }))
  const { f, input } = mount({ submit }, { name: 'Ada', plan: 'free', email: 'a@b.c' })
  for (const [path, value] of [['name', 'Ada'], ['email', 'a@b.c']]) input(path!).value = value!
  const first = f.submit()
  expect(await f.submit()).toBe(false) // already submitting: ignored
  expect(f.submitting).toBe(true)
  expect(await first).toBe(false) // the server said no
  expect(submit).toHaveBeenCalledTimes(1)
  expect(submit).toHaveBeenCalledWith({ name: 'Ada', plan: 'free', email: 'a@b.c' })
  expect(f.submitting).toBe(false)
  expect(f.step).toBe('confirm')
  expect(f.error('email')).toBe('Already registered.')
  expect(document.activeElement).toBe(input('email'))
})

test('valid and accepted: submit resolves true', async () => {
  const { f, input } = mount({ submit: () => {} }, { name: 'Ada', plan: 'free', email: 'a@b.c' })
  for (const [path, value] of [['name', 'Ada'], ['email', 'a@b.c']]) input(path!).value = value!
  expect(await f.submit()).toBe(true)
})
