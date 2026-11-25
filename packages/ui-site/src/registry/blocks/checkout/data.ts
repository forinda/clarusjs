// The checkout block's data: the cart, the prices, the rules and the call it makes. Replace sampleCart with your
// cart and placeOrder with your own (a request() to your API, passing the signal on); keep its answer's shape so
// errors land on their fields. Money is whole cents throughout, so totals never pick up float rounding. The rules
// are Zod schemas, one per step.
import { z } from 'zod'

export type Line = { id: string; name: string; variant?: string; unitCents: number; quantity: number }
export type Order = {
  email: string
  name: string
  address: string
  city: string
  postal: string
  country: string
  card: string
  expiry: string
  cvc: string
}
export type OrderErrors = Partial<Record<keyof Order, string>>

export const currency = 'USD'
export const shippingCents = 500
export const taxRate = 0.08
export const countries = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'KE', label: 'Kenya' },
]

export const sampleCart: Line[] = [
  { id: 'shirt', name: 'Linen shirt', variant: 'Sand, M', unitCents: 4800, quantity: 1 },
  { id: 'tote', name: 'Canvas tote', variant: 'Natural', unitCents: 2200, quantity: 2 },
  { id: 'socks', name: 'Wool socks', variant: 'Grey, 3 pairs', unitCents: 1200, quantity: 3 },
]

/** A line's quantity as typed: a whole number from 0 to 99, anything else 0. */
export function quantityOf(value: unknown): number {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) && n > 0 && value !== '' ? Math.min(n, 99) : 0
}

/** The cart's subtotal, shipping (none for an empty cart), tax (rounded to the cent) and total, in cents. */
export function totals(
  lines: Line[],
  shipping: number,
  rate: number,
): { subtotal: number; shipping: number; tax: number; total: number } {
  const subtotal = lines.reduce((sum, l) => sum + l.unitCents * quantityOf(l.quantity), 0)
  const ship = subtotal > 0 ? shipping : 0
  const tax = Math.round(subtotal * rate)
  return { subtotal, shipping: ship, tax, total: subtotal + ship + tax }
}

export function formatMoney(cents: number, code: string = currency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(cents / 100)
}

/** The Luhn check card numbers carry. */
const luhn = (digits: string) =>
  [...digits]
    .reverse()
    .reduce((sum, d, i) => sum + (i % 2 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][Number(d)]! : Number(d)), 0) %
    10 ===
  0
const filled = (message: string) => z.string().trim().min(1, { error: message })

/** The checkout's steps, in order: each with its fields and the Zod schema they must pass to go on. */
export const steps = [
  {
    title: 'Contact',
    fields: ['email'] as (keyof Order)[],
    schema: () =>
      z.object({
        email: z
          .string()
          .trim()
          .pipe(z.email({ error: 'Enter your email address.' })),
      }),
  },
  {
    title: 'Shipping',
    fields: ['name', 'address', 'city', 'postal', 'country'] as (keyof Order)[],
    schema: () =>
      z.object({
        name: filled('Enter the name to deliver to.'),
        address: filled('Enter the street address.'),
        city: filled('Enter the city.'),
        postal: filled('Enter the postal code.'),
        country: z.string().refine((c) => countries.some((x) => x.value === c), { error: 'Choose a country.' }),
      }),
  },
  {
    title: 'Payment',
    fields: ['card', 'expiry', 'cvc'] as (keyof Order)[],
    schema: (now: Date) =>
      z.object({
        card: z
          .string()
          .transform((v) => v.replace(/[\s-]/g, ''))
          .refine((d) => /^\d{12,19}$/.test(d) && luhn(d), { error: 'Check the card number.' }),
        expiry: z
          .string()
          .trim()
          .regex(/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/, { error: 'Use MM/YY.' })
          .refine((v) => new Date(2000 + Number(v.slice(-2)), Number(v.slice(0, 2)), 1) > now, {
            error: 'This card has expired.',
          }), // valid through its month
        cvc: z
          .string()
          .trim()
          .regex(/^\d{3,4}$/, { error: 'Use the 3 or 4 digits on the card.' }),
      }),
  },
]

/** The step a field is on. */
export const stepOf = (field: string): number => steps.findIndex((s) => s.fields.includes(field as keyof Order))

/** What a step checks before going on: its fields' first errors, an empty object when all is well. */
export function validateStep(step: number, order: Order, now: Date = new Date()): OrderErrors {
  const result = steps[step]!.schema(now).safeParse(order)
  const errors: OrderErrors = {}
  for (const issue of result.error?.issues ?? []) errors[issue.path[0] as keyof Order] ??= issue.message
  return errors
}

/** Every step's errors: what the page checks before calling placeOrder. */
export function validateOrder(order: Order, now: Date = new Date()): OrderErrors {
  return Object.assign({}, ...steps.map((_, i) => validateStep(i, order, now)))
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(timer), reject(signal.reason)), { once: true })
  })

/**
 * Places the order: its id, or errors for their fields. The stub waits a moment, declines the card
 * 4000 0000 0000 0002 (an error on its field) and fails for offline@example.com (a failed call): replace it with
 * your own, for example
 * `request('/api/orders', { method: 'POST', body: order, signal })`.
 */
export async function placeOrder(
  order: Order & { lines: Line[] },
  { signal }: { signal?: AbortSignal } = {},
): Promise<{ id?: string; errors?: OrderErrors }> {
  await wait(300, signal)
  if (order.email.trim() === 'offline@example.com') throw new Error('The server could not be reached.')
  if (order.card.replace(/[\s-]/g, '') === '4000000000000002') return { errors: { card: 'Your card was declined.' } }
  return { id: 'ord_' + Math.random().toString(36).slice(2, 10) }
}
