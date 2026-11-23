// The playground's examples: the first opens by default. Each is a whole component, interactive in the preview.
import combobox from '../components/combobox.tscl?raw' // the site's own combobox, as a file to copy

/** A playground example. */
export type Starter = { name: string; source: string }

export const starters: Starter[] = [
  {
    name: 'Counter',
    source: `<script>
  let count = state(0)
  const double = derived(() => count * 2)
</script>

<button type="button" (click)="count++">Clicked {{ count }} times</button>
<p>Double: {{ double }}</p>
`,
  },
  {
    name: 'Todo list',
    source: `<script>
  let items = state([
    { id: 1, text: 'Try the playground' },
    { id: 2, text: 'Read the guide' },
  ])
  let draft = state('')
  let next = state(3)
  function add() {
    if (!draft.trim()) return
    items = [...items, { id: next, text: draft.trim() }]
    next++
    draft = ''
  }
</script>

<form (submit)="$event.preventDefault(); add()">
  <input aria-label="New item" [(value)]="draft" placeholder="Add an item" />
  <button type="submit">Add</button>
</form>
<ul>
  @for (item of items; track item.id) {
    <li>{{ item.text }} <button type="button" (click)="items = items.filter((i) => i !== item)">Remove</button></li>
  } @empty {
    <li>Nothing yet.</li>
  }
</ul>
`,
  },
  {
    name: 'Form',
    source: `<script>
  let form = state({ name: '', plan: 'free', updates: false })
</script>

<label>Name <input [(value)]="form.name" /></label>
<label>
  Plan
  <select [(value)]="form.plan">
    <option value="free">Free</option>
    <option value="pro">Pro</option>
  </select>
</label>
<label><input type="checkbox" [(checked)]="form.updates" /> Send me updates</label>
<p>{{ form.name || 'Someone' }} on {{ form.plan }}{{ form.updates ? ', with updates' : '' }}.</p>
`,
  },
  {
    name: 'Checkout',
    source: `<script>
  import { form } from 'clarusjs/forms'

  // A Standard Schema, written by hand: Zod, Valibot or ArkType plug in the same way. It checks what the fields'
  // own constraints (required, type="email") can't say, and its issues land on their fields by path.
  const schema = {
    '~standard': {
      version: 1,
      vendor: 'playground',
      validate(value) {
        const issues = []
        if (value.postal && !/^\\d{5}$/.test(value.postal)) issues.push({ path: ['postal'], message: 'A postal code has 5 digits.' })
        const digits = value.card.replace(/\\s/g, '')
        if (digits && !luhn(digits)) issues.push({ path: ['card'], message: "That card number isn't valid." })
        const expiry = /^(\\d{2})\\/(\\d{2})$/.exec(value.expiry)
        if (value.expiry && (!expiry || +expiry[1] < 1 || +expiry[1] > 12)) issues.push({ path: ['expiry'], message: 'Use MM/YY.' })
        else if (expiry && new Date(2000 + +expiry[2], +expiry[1]) <= new Date()) issues.push({ path: ['expiry'], message: 'That card has expired.' })
        return issues.length ? { issues } : { value }
      },
    },
  }

  // The card number's check digit (Luhn).
  function luhn(digits) {
    let sum = 0
    for (let i = 0; i < digits.length; i++) {
      let d = +digits[digits.length - 1 - i]
      if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
      sum += d
    }
    return /^\\d{12,19}$/.test(digits) && sum % 10 === 0
  }

  let order = state({ name: '', email: '', postal: '', card: '', expiry: '' })
  let placed = state('')
  const titles = { shipping: 'Shipping', payment: 'Payment', review: 'Review' }
  const f = form(order, {
    schema,
    submit(values) {
      placed = 'Thanks, ' + values.name.split(' ')[0] + '! Your order is placed.'
    },
  })
</script>

<form [engine]="f">
  <ol class="steps">
    @for (s of f.steps; track s.id) {
      <li [aria-current]="s.current ? 'step' : false" [class]="s.errors ? 'bad' : s.done ? 'done' : false">{{ titles[s.id] }}</li>
    }
  </ol>
  <fieldset id="shipping" data-cl-step>
    <h2>Shipping</h2>
    <div data-cl-field>
      <label for="name">Full name</label>
      <input id="name" required autocomplete="name" [(value)]="order.name" />
      <small data-cl-message></small>
    </div>
    <div data-cl-field>
      <label for="email">Email</label>
      <input id="email" type="email" required autocomplete="email" [(value)]="order.email" />
      <small data-cl-message></small>
    </div>
    <div data-cl-field>
      <label for="postal">Postal code</label>
      <input id="postal" required inputmode="numeric" autocomplete="postal-code" [(value)]="order.postal" />
      <small data-cl-message></small>
    </div>
    <div><button type="button" (click)="f.next()">Next</button></div>
  </fieldset>
  <fieldset id="payment" data-cl-step>
    <h2>Payment</h2>
    <div data-cl-field>
      <label for="card">Card number</label>
      <input id="card" required inputmode="numeric" autocomplete="cc-number" [(value)]="order.card" />
      <small data-cl-message></small>
    </div>
    <div data-cl-field>
      <label for="expiry">Expiry (MM/YY)</label>
      <input id="expiry" required autocomplete="cc-exp" placeholder="MM/YY" [(value)]="order.expiry" />
      <small data-cl-message></small>
    </div>
    <div>
      <button type="button" (click)="f.back()">Back</button>
      <button type="button" (click)="f.next()">Next</button>
    </div>
  </fieldset>
  <fieldset id="review" data-cl-step>
    <h2>Review</h2>
    <p>{{ order.name }}, {{ order.postal }}</p>
    <p>{{ order.email }}</p>
    <p>Card •••• {{ order.card.replace(/\\s/g, '').slice(-4) }}</p>
    <div>
      <button type="button" (click)="f.back()">Back</button>
      <button [disabled]="f.submitting">Place order</button>
    </div>
  </fieldset>
  <p role="status">{{ placed }}</p>
</form>

<style scoped>
  /* The step list; fields, messages and buttons come from the preview's default look. */
  .steps { display: flex; gap: 20px; padding: 0; margin: 0 0 4px; list-style: none; color: GrayText; font-size: 14px; }
  .steps [aria-current] { color: CanvasText; font-weight: 600; }
  .steps .done::before { content: '✓ '; color: green; }
  .steps .bad { color: #b3261e; }
</style>
`,
  },
  { name: 'Combobox', source: combobox },
  {
    name: 'Attributes',
    source: `{{-- Attribute bindings, from one attribute to a whole object of them. --}}
<script>
  let selected = state(false)
  let big = state(false)
  let hue = state(200)
  // A spread: every key is an attribute; written ones on the element win.
  const a11y = derived(() => ({ 'aria-pressed': String(selected), title: selected ? 'Selected' : 'Not selected' }))
  // From data: a spread checks URLs like any attribute, and drops event handlers.
  const link = { href: 'javascript:alert(1)', onclick: 'alert(2)', class: 'unsafe' }
</script>

<div
  class="card"
  [class.selected]="selected"
  [class]="{ big }"
  [style.--hue]="hue"
  [...]="a11y"
>
  <p class="title" [style]="{ fontSize: big ? '1.5em' : null, color: selected ? 'white' : null }">A card</p>
  <button type="button" (click)="selected = !selected">{{ selected ? 'Deselect' : 'Select' }}</button>
</div>

<p>
  <label><input type="checkbox" [(checked)]="big" /> Big</label>
  <label>Hue <input type="range" min="0" max="360" [(value)]="hue" /></label>
</p>
<p><a [...]="link">A link from data</a> (look at its href)</p>

<style scoped>
  .card { padding: 16px; border: 2px solid hsl(var(--hue) 60% 45%); border-radius: 12px; }
  .card.selected { background: hsl(var(--hue) 60% 45%); }
  .card.big { padding: 28px; }
  .title { margin: 0 0 8px; font-weight: 700; }
</style>
`,
  },
  {
    name: 'Conditional',
    source: `<script>
  let open = state(false)
</script>

<button type="button" (click)="open = !open" [aria-expanded]="open">
  {{ open ? 'Hide' : 'Show' }} the details
</button>
@if (open) {
  <p>Rendered on the server when open, added and removed in the browser.</p>
} @else {
  <p>Nothing to see yet.</p>
}
`,
  },
]
