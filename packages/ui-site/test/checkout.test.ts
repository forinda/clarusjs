// The checkout block's rules: totals in whole cents, and what an order needs before placeOrder is called.
import { expect, test } from 'vitest'
import {
  formatMoney,
  placeOrder,
  quantityOf,
  sampleCart,
  stepOf,
  steps,
  totals,
  validateOrder,
  validateStep,
  type Order,
} from '../src/registry/blocks/checkout/data.ts'

test('totals: subtotal, shipping, tax rounded to the cent, total; all whole cents', () => {
  expect(totals(sampleCart, 500, 0.08)).toEqual({ subtotal: 12800, shipping: 500, tax: 1024, total: 14324 })
  expect(totals([{ id: 'a', name: 'A', unitCents: 10, quantity: 3 }], 0, 0.075)).toEqual({
    subtotal: 30,
    shipping: 0,
    tax: 2,
    total: 32,
  })
})

test('totals: an empty cart costs nothing, shipping included', () => {
  expect(totals([], 500, 0.08)).toEqual({ subtotal: 0, shipping: 0, tax: 0, total: 0 })
})

test('quantityOf: a whole number from 0 to 99; anything else counts as 0', () => {
  expect([
    quantityOf(2),
    quantityOf('3'),
    quantityOf(2.7),
    quantityOf(-1),
    quantityOf(Number.NaN),
    quantityOf(''),
    quantityOf('x'),
    quantityOf(1000),
  ]).toEqual([2, 3, 2, 0, 0, 0, 0, 99])
  expect(totals([{ id: 'a', name: 'A', unitCents: 100, quantity: -4 }], 500, 0.08).total).toBe(0)
})

test('formatMoney: cents in the currency', () => {
  expect(formatMoney(14324, 'USD')).toBe('$143.24')
  expect(formatMoney(0, 'USD')).toBe('$0.00')
})

const good: Order = {
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  address: '12 St James Sq',
  city: 'London',
  postal: 'SW1Y 4JH',
  country: 'GB',
  card: '4242 4242 4242 4242',
  expiry: '12/30',
  cvc: '123',
}
const now = new Date(2026, 10, 25)

test('validateOrder: a complete order passes', () => {
  expect(validateOrder(good, now)).toEqual({})
})

test('validateOrder: each field says what it needs', () => {
  const empty = Object.fromEntries(Object.keys(good).map((k) => [k, ''])) as Order
  expect(Object.keys(validateOrder(empty, now)).sort()).toEqual(Object.keys(good).sort())
  expect(validateOrder({ ...good, card: '4242 4242 4242 4241' }, now).card).toBe('Check the card number.') // Luhn
  expect(validateOrder({ ...good, card: '4242' }, now).card).toBe('Check the card number.')
  expect(validateOrder({ ...good, expiry: '10/26' }, now).expiry).toBe('This card has expired.')
  expect(validateOrder({ ...good, expiry: '11/26' }, now).expiry).toBeUndefined() // valid through the end of its month
  expect(validateOrder({ ...good, expiry: '13/30' }, now).expiry).toBe('Use MM/YY.')
  expect(validateOrder({ ...good, cvc: '12' }, now).cvc).toBe('Use the 3 or 4 digits on the card.')
})

test('placeOrder (the stub to replace): an order id, a declined card on its field, or a failed call; a signal cancels it', async () => {
  expect(await placeOrder({ ...good, lines: sampleCart })).toEqual({ id: expect.stringMatching(/^ord_/) })
  expect(await placeOrder({ ...good, card: '4000 0000 0000 0002', lines: sampleCart })).toEqual({
    errors: { card: 'Your card was declined.' },
  })
  await expect(placeOrder({ ...good, email: 'offline@example.com', lines: sampleCart })).rejects.toThrow()
  const controller = new AbortController()
  const call = placeOrder({ ...good, lines: sampleCart }, { signal: controller.signal })
  controller.abort()
  await expect(call).rejects.toThrow()
  // A signal already aborted rejects at once, without waiting.
  const early = new AbortController()
  early.abort()
  await expect(placeOrder({ ...good, lines: sampleCart }, { signal: early.signal })).rejects.toThrow()
})

test('steps: contact, shipping, payment; each owns its fields, all of them once', () => {
  expect(steps.map((s) => s.title)).toEqual(['Contact', 'Shipping', 'Payment'])
  expect(steps.flatMap((s) => s.fields).sort()).toEqual(Object.keys(good).sort())
  expect(stepOf('card')).toBe(2)
  expect(stepOf('email')).toBe(0)
})

test("validateStep: only that step's fields, by its Zod schema", () => {
  const blank = Object.fromEntries(Object.keys(good).map((k) => [k, ''])) as Order
  expect(Object.keys(validateStep(0, blank, now))).toEqual(['email'])
  expect(Object.keys(validateStep(1, blank, now)).sort()).toEqual(['address', 'city', 'country', 'name', 'postal'])
  expect(validateStep(1, { ...blank, ...good, card: '' }, now)).toEqual({})
  expect(validateStep(2, { ...good, cvc: 'x' }, now)).toEqual({ cvc: 'Use the 3 or 4 digits on the card.' })
})
