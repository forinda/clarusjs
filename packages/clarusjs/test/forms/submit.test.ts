// @vitest-environment happy-dom
// Submit: everything is checked, and with errors the user is taken to the first one (its step, its field), with every
// error listed for a summary; server errors from the submit callback land the same way.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connect, form } from '../../src/forms/index.ts'
import type { FormOptions } from '../../src/forms/types.ts'
import { scope, state } from '../../src/runtime/signals.ts'

beforeEach(() => history.replaceState(null, '', '/signup'))
afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers() })

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

test('review: a schema error on a path with no field (a whole-object rule) stops submit and is listed', async () => {
  const whole = { '~standard': { version: 1 as const, vendor: 't', validate: (v: unknown) => ({ issues: [{ message: 'Passwords differ.', path: [] }] }) } } as any
  const submit = vi.fn()
  const { f, input } = mount({ schema: whole, submit }, { name: 'Ada', plan: 'free', email: 'a@b.c' })
  for (const [path, value] of [['name', 'Ada'], ['email', 'a@b.c']]) input(path!).value = value!
  expect(await f.submit()).toBe(false)
  expect(submit).not.toHaveBeenCalled()
  expect(f.errors).toEqual([{ path: '', message: 'Passwords differ.', id: '', step: null }])
})

test('review: a server error on a path with no field is kept, listed, and submit resolves false', async () => {
  const { f, input } = mount({ submit: () => ({ errors: { '': 'Server down.' } }) }, { name: 'Ada', plan: 'free', email: 'a@b.c' })
  for (const [path, value] of [['name', 'Ada'], ['email', 'a@b.c']]) input(path!).value = value!
  expect(await f.submit()).toBe(false)
  expect(f.errors.map((e) => e.message)).toEqual(['Server down.'])
})

test('review: next() and submit() wait for the newest schema check, not a superseded one', async () => {
  vi.useFakeTimers()
  const slow = { '~standard': { version: 1 as const, vendor: 't', validate: (v: any) => new Promise((resolve) => setTimeout(() => resolve(v.name === 'admin' ? { issues: [{ message: 'Taken.', path: ['name'] }] } : { value: v }), 500)) } } as any
  const values = state({ name: '', plan: 'free', email: '' })
  document.body.innerHTML = html
  const f = form(values, { schema: slow })
  scope(() => connect(document.body, 0, () => f))
  const name = document.querySelector('[data-cl-path="name"]') as HTMLInputElement
  name.value = 'admin'
  values.set({ ...values.get(), name: 'admin' })
  name.dispatchEvent(new Event('input', { bubbles: true }))
  await vi.advanceTimersByTimeAsync(100)
  const moved = f.next()
  await vi.advanceTimersByTimeAsync(2000)
  expect(await moved).toBe(false) // "admin" is taken: stay
  expect(f.error('name')).toBe('Taken.')
  vi.useRealTimers()
})

test('review: a schema that throws doesn\'t leave the form pending', async () => {
  const broken = { '~standard': { version: 1 as const, vendor: 't', validate: () => Promise.reject(new Error('boom')) } } as any
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { f } = mount({ schema: broken })
  await expect(f.submit()).resolves.toBe(false) // required fields are empty anyway
  expect(f.pending).toBe(false)
  error.mockRestore()
})

test('review #233 (2): a schema that throws blocks submit (fields otherwise valid)', async () => {
  const broken = { '~standard': { version: 1 as const, vendor: 't', validate: () => Promise.reject(new Error('boom')) } } as any
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  const submit = vi.fn()
  const { f, input } = mount({ schema: broken, submit }, { name: 'Ada', plan: 'free', email: 'a@b.c' })
  for (const [path, value] of [['name', 'Ada'], ['email', 'a@b.c']]) input(path!).value = value!
  expect(await f.submit()).toBe(false)
  expect(submit).not.toHaveBeenCalled()
  expect(f.errors.map((e) => e.path)).toEqual([''])
  error.mockRestore()
})

test('review #233 (2): values changed while a check runs are checked again before submit', async () => {
  vi.useFakeTimers()
  let calls = 0
  const slow = { '~standard': { version: 1 as const, vendor: 't', validate: (v: any) => { calls++; return new Promise((r) => setTimeout(() => r(v.name === 'admin' ? { issues: [{ message: 'Taken.', path: ['name'] }] } : { value: v }), 100)) } } } as any
  const values = state({ name: 'ada', plan: 'free', email: 'a@b.c' })
  document.body.innerHTML = html
  const submit = vi.fn()
  const f = form(values, { schema: slow, submit })
  scope(() => connect(document.body, 0, () => f))
  for (const [path, value] of [['name', 'ada'], ['email', 'a@b.c']]) (document.querySelector(`[data-cl-path="${path}"]`) as HTMLInputElement).value = value!
  await vi.advanceTimersByTimeAsync(200)
  const sent = f.submit()
  await vi.advanceTimersByTimeAsync(50)
  values.set({ ...values.get(), name: 'admin' }) // changed while the check runs
  await vi.advanceTimersByTimeAsync(1000)
  expect(await sent).toBe(false)
  expect(submit).not.toHaveBeenCalled()
  vi.useRealTimers()
})

test('review #233 (2): a server error for a value changed during submit is dropped', async () => {
  let release: (v: { errors: Record<string, string> }) => void = () => {}
  const values = state({ name: 'Ada', plan: 'free', email: 'a@b.c' })
  document.body.innerHTML = html
  const f = form(values, { submit: () => new Promise((r) => { release = r }) })
  scope(() => connect(document.body, 0, () => f))
  for (const [path, value] of [['name', 'Ada'], ['email', 'a@b.c']]) (document.querySelector(`[data-cl-path="${path}"]`) as HTMLInputElement).value = value!
  const sent = f.submit()
  await new Promise((r) => setTimeout(r, 0))
  values.set({ ...values.get(), email: 'b@c.d' }) // edited while the server answers
  release({ errors: { email: 'Taken.', name: 'Bad.' } })
  await sent
  expect(f.error('email')).toBe('')
  expect(f.error('name')).toBe('Bad.')
})
