// @vitest-environment happy-dom
// The forms engine (clarusjs/forms): fields found by data-cl-path, errors from native constraints, a Standard
// Schema and the server, shown on their fields with ARIA, by the show rule.
import { afterEach, expect, test, vi } from 'vitest'
import { connect, form } from '../../src/forms/index.ts'
import { scope, state } from '../../src/runtime/signals.ts'

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers() })

/** Mount `html` (with one data-cl-form="0" element) and connect a form over `values`. */
function mount<T extends object>(html: string, values: T, options: Parameters<typeof form<T>>[1] = {}) {
  document.body.innerHTML = html
  const v = state(values)
  const f = form(v, options)
  const dispose = scope(() => connect(document.body, 0, () => f))
  return { f, v, dispose, el: (sel: string) => document.querySelector(sel) as HTMLInputElement }
}
const type = (el: HTMLInputElement, value: string) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })) }
const leave = (el: Element) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
const tick = () => new Promise((r) => setTimeout(r, 0))

/** A schema (Standard Schema v1) from a function returning issues. */
const schema = (check: (v: any) => { message: string; path: (string | number)[] }[] | Promise<{ message: string; path: (string | number)[] }[]>) => ({
  '~standard': {
    version: 1 as const,
    vendor: 'test',
    validate: (value: unknown) => {
      const out = check(value)
      return out instanceof Promise ? out.then((issues) => (issues.length ? { issues } : { value })) : out.length ? { issues: out } : { value }
    },
  },
}) as any

const emailForm = `<form data-cl-form="0"><label>Email <input required data-cl-path="customer.email"> <small data-cl-error></small></label></form>`

test('a native constraint shows in the field\'s message element once the field is left, with ARIA', () => {
  const { el, f } = mount(emailForm, { customer: { email: '' } })
  const input = el('input')
  const message = el('[data-cl-error]')
  expect(el('form').hasAttribute('novalidate')).toBe(true)
  expect(f.error('customer.email')).toBe('') // not shown before the field is left
  expect(message.hidden).toBe(true)
  leave(input)
  expect(f.error('customer.email')).toBe('Constraints not satisfied') // the browser's own message
  expect(message.textContent).toBe('Constraints not satisfied')
  expect(message.hidden).toBe(false)
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(input.getAttribute('aria-describedby')).toBe(message.id)
  type(input, 'a@b.c')
  expect(f.error('customer.email')).toBe('')
  expect(input.hasAttribute('aria-invalid')).toBe(false)
  expect(message.hidden).toBe(true)
})

test('messages: replacements by path or by constraint', () => {
  const { el, f } = mount(emailForm, { customer: { email: '' } }, { messages: { valueMissing: 'Required.' } })
  leave(el('input'))
  expect(f.error('customer.email')).toBe('Required.')
  const other = mount(emailForm, { customer: { email: '' } }, { messages: { 'customer.email': 'Enter your email.' } })
  leave(other.el('input'))
  expect(other.f.error('customer.email')).toBe('Enter your email.')
})

test('a schema issue lands on its field (and the browser knows it is invalid); server errors win until the value changes', async () => {
  const s = schema((v) => (v.customer.email.includes('@') ? [] : [{ message: 'Not an email.', path: ['customer', 'email'] }]))
  const { el, f, v } = mount(emailForm.replace(' required', ''), { customer: { email: 'x' } }, { schema: s })
  const input = el('input')
  leave(input)
  await tick()
  expect(f.error('customer.email')).toBe('Not an email.')
  expect(input.validity.customError).toBe(true)
  f.setErrors({ 'customer.email': 'Taken.' })
  expect(f.error('customer.email')).toBe('Taken.') // server over schema
  v.set({ customer: { email: 'a@b.c' } })
  await new Promise((r) => setTimeout(r, 350)) // the schema re-checks after a pause (300 ms)
  expect(f.error('customer.email')).toBe('') // the value changed: the server error is gone, the schema is happy
  expect(input.validity.customError).toBe(false)
})

test('show rules: "input" shows on the first keystroke; "blur" waits for the field to be left', () => {
  const html = `<form data-cl-form="0"><label><input minlength="3" data-cl-path="name"><small data-cl-error></small></label></form>`
  const eager = mount(html, { name: '' }, { show: 'input' })
  type(eager.el('input'), 'a')
  expect(eager.f.error('name')).not.toBe('')
  const lazy = mount(html, { name: '' })
  type(lazy.el('input'), 'a')
  expect(lazy.f.error('name')).toBe('')
  leave(lazy.el('input'))
  expect(lazy.f.touched('name')).toBe(true)
})

test('paths join through components: a field inside [data-cl-path="shipping"] is shipping.street', () => {
  const { el, f } = mount(`<form data-cl-form="0"><cl-island data-cl-path="shipping"><label><input required data-cl-path="street"><small data-cl-error></small></label></cl-island></form>`, { shipping: { street: '' } })
  leave(el('input'))
  expect(f.error('shipping.street')).not.toBe('')
  expect(f.errors.map((e) => e.path)).toEqual(['shipping.street'])
})

test('rows shifting: the error follows the field to its new path', () => {
  const { el, f } = mount(`<form data-cl-form="0"><label><input data-cl-path="lines.0.item" value="ok"></label><label><input required data-cl-path="lines.1.item"><small data-cl-error></small></label></form>`, { lines: [{ item: 'ok' }, { item: '' }] })
  const second = document.querySelectorAll('input')[1]!
  leave(second)
  expect(f.error('lines.1.item')).not.toBe('')
  // The first row is removed: the second row's input is now lines.0.item.
  document.querySelector('label')!.remove()
  second.setAttribute('data-cl-path', 'lines.0.item')
  leave(second)
  expect(f.error('lines.0.item')).not.toBe('')
  expect(f.error('lines.1.item')).toBe('')
})

test('a radio group: one path, every radio marked, one message, focus goes to the checked one else the first', () => {
  const { f } = mount(`<form data-cl-form="0"><fieldset><input type="radio" name="p" value="a" required data-cl-path="plan"><input type="radio" name="p" value="b" data-cl-path="plan"><small data-cl-error></small></fieldset></form>`, { plan: '' })
  const [a, b] = [...document.querySelectorAll('input')] as HTMLInputElement[]
  leave(a!)
  expect(a!.getAttribute('aria-invalid')).toBe('true')
  expect(b!.getAttribute('aria-invalid')).toBe('true')
  expect(f.errors).toHaveLength(1)
  f.focus('plan')
  expect(document.activeElement).toBe(a)
  b!.checked = true
  f.focus('plan')
  expect(document.activeElement).toBe(b)
})

test('async schema results arriving late: the latest check wins', async () => {
  vi.useFakeTimers()
  const answers: ((issues: { message: string; path: string[] }[]) => void)[] = []
  const s = schema(() => new Promise((resolve) => answers.push(resolve)))
  const { el, f } = mount(`<form data-cl-form="0"><label><input data-cl-path="user"><small data-cl-error></small></label></form>`, { user: '' }, { schema: s, show: 'input' })
  type(el('input'), 'a')
  await vi.advanceTimersByTimeAsync(300) // debounced
  type(el('input'), 'ab')
  await vi.advanceTimersByTimeAsync(300)
  expect(answers).toHaveLength(3) // on connect, then after each pause in typing
  expect(f.pending).toBe(true)
  answers[2]!([]) // the newest check: fine
  await vi.advanceTimersByTimeAsync(0)
  answers[1]!([{ message: 'Taken.', path: ['user'] }]) // an older one arrives late
  await vi.advanceTimersByTimeAsync(0)
  expect(f.error('user')).toBe('')
  expect(f.pending).toBe(false)
})

test('touched, changed, valid and reset', () => {
  const { el, f, v } = mount(emailForm, { customer: { email: '' } })
  expect(f.valid).toBe(false) // required and empty, shown or not
  type(el('input'), 'a@b.c')
  v.set({ customer: { email: 'a@b.c' } })
  expect(f.changed('customer.email')).toBe(true)
  expect(f.valid).toBe(true)
  leave(el('input'))
  f.reset()
  expect(v.get()).toEqual({ customer: { email: '' } })
  expect(f.touched('customer.email')).toBe(false)
  expect(f.changed('customer.email')).toBe(false)
})

test('a form made in a store, connected from two islands: one form covered once; fields of both indexed', () => {
  document.body.innerHTML = `<form><cl-island><fieldset data-cl-form="0"><label><input required data-cl-path="name"><small data-cl-error></small></label></fieldset></cl-island><cl-island id="two"><fieldset data-cl-form="0"><label><input required data-cl-path="email"><small data-cl-error></small></label></fieldset></cl-island></form>`
  const store = state({ name: '', email: '' })
  const f = form(store)
  const islands = document.querySelectorAll('cl-island')
  scope(() => connect(islands[0]!, 0, () => f))
  scope(() => connect(islands[1]!, 0, () => f))
  const listen = vi.spyOn(HTMLFormElement.prototype, 'addEventListener')
  scope(() => connect(islands[1]!, 0, () => f)) // connecting again adds nothing
  expect(listen).not.toHaveBeenCalled()
  expect(document.querySelector('form')!.hasAttribute('novalidate')).toBe(true)
  expect(f.valid).toBe(false)
  for (const input of document.querySelectorAll('input')) leave(input)
  expect(f.errors.map((e) => e.path)).toEqual(['name', 'email'])
})

test('on the server (a plain value, as the compiler passes there) a form shows nothing and touches nothing', () => {
  const f = form({ name: '' })
  expect(f.error('name')).toBe('')
  expect(f.errors).toEqual([])
  expect(f.valid).toBe(true)
})
