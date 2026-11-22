// The playground's examples: the first opens by default. Each is a whole component, interactive in the preview.

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
