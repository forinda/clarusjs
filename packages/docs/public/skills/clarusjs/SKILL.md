---
name: clarusjs
description: Write and check clarusjs components (.tscl files): template syntax, islands and state, pages and data loading, and the clarusjs check loop. Use when creating or editing .tscl files or a clarusjs app.
---

## clarusjs

This app is built with [clarusjs](https://clarusjs.com): `.tscl` components compiled to HTML on the server, plus small
islands of JavaScript only where a component has a `<script>`. Vite runs it (`vite`, `vite build`).

### Where things go

- `src/pages/`: one `.tscl` (or `.md`) file per route. `index.tscl` is `/`, `guide/intro.tscl` is `/guide/intro`,
  `users/[id].tscl` is `/users/:id`.
- `src/pages/x.load.ts` next to a page: `export async function load({ params, request })` returns the page's inputs;
  `export function entries()` lists a dynamic route's pages for a static build.
- `src/components/`, `src/layouts/`: components. `x.load.ts` next to a component loads its own data the same way.
- `src/stores/`: state shared between islands (`.ts` modules exporting `state()` values).
- How each route renders is set in `vite.config.ts`: `clarusjs({ routes: { '/account/*': 'server' } })`. Routes are
  static (built once) by default.

### A component

```tscl
@import badge from './badge.tscl'
@import { site } from '../site.ts'
@input title: string
@input count: number = 0

<script>
  let n = state(count)
  const double = derived(() => n * 2)
  function add() {
    n++
  }
</script>

<h2>{{ title }} <badge [label]="site.name" /></h2>
<button type="button" (click)="add()">Clicked {{ n }} times ({{ double }})</button>
@if (n > 3) {
  <p>That's a lot.</p>
} @else {
  <p>Keep going.</p>
}
```

- `{{ expr }}` prints a value, escaped. `[attr]="expr"` binds an attribute or a component input;
  `attr="a {{ b }}"` interpolates.
- `(event)="code"` handles an event, with `$event`. `[(value)]` binds a form field two ways (`[(checked)]` for a
  checkbox); a component declares what it may write with `@model name: Type`.
- `@for (item of items; track item.id) { … } @empty { … }`: always `track` a unique key.
- `<slot />` and `<slot name="x">` receive content; `@slot('x') { … }` fills a named one.
- `{{-- … --}}` is a template comment.

### Islands and state

- A component with a `<script>` is an island: it ships JavaScript and runs in the browser. Without one it ships
  nothing. Keep scripts to the components that need them.
- `let x = state(value)` is reactive state; read and write it as a plain variable (`x++`, `x = [...x, y]`).
  `derived(() => …)` computes from it. `shared(store)` gives a local name to a store's state.
- Update objects and arrays by assigning new ones: `items = [...items, item]`, `form = { ...form, name }`.
- `attach="visible"` (or `idle`, `interaction`) on an island's tag loads its JavaScript later.

### Check your work

Run `npx clarusjs check` after editing `.tscl` files, and fix what it reports before calling the work done: it
type-checks templates and scripts (`file.tscl:line:col`) and runs the template lint rules (images without `alt`,
labels without a field, unused inputs…). With the clarusjs MCP server (`npx @clarusjs/ai mcp`), use its `check`,
`compile` and `docs_search` tools.

Docs: https://clarusjs.com/guide/getting-started · syntax: https://clarusjs.com/reference/template-syntax · all of
it for agents: https://clarusjs.com/llms-full.txt

### Common mistakes

These fail to compile, with `file.tscl:line:col` and a message that says what to do:

```tscl wrong
@if loggedIn {<p>Hi</p>}
```

```tscl right
@input loggedIn: boolean = false
@if (loggedIn) {
  <p>Hi</p>
}
```

An `@input` belongs to the parent: it is read-only. Copy it into state to change it.

```tscl wrong
@input count: number = 0
<script>
  function add() {
    count++
  }
</script>
<button type="button" (click)="add()">{{ count }}</button>
```

```tscl right
@input count: number = 0
<script>
  let n = state(count)
  function add() {
    n++
  }
</script>
<button type="button" (click)="add()">{{ n }}</button>
```

An event needs a `<script>`: a component without one is static HTML and ships no JavaScript.

```tscl wrong
<button type="button" (click)="open = !open">Toggle</button>
```

```tscl right
<script>
  let open = state(false)
</script>
<button type="button" (click)="open = !open">{{ open ? 'Hide' : 'Show' }}</button>
```

`[(value)]` binds form fields only (`<input>`, `<select>`, `<textarea>`; `[(checked)]` on a checkbox).

```tscl wrong
<script>
  let text = state('')
</script>
<div [(value)]="text"></div>
```

```tscl right
<script>
  let text = state('')
</script>
<label>Note <input [(value)]="text" /></label>
```

These compile, but are wrong:

- **Changing state in place.** In a script or an event handler, `items.push(x)` or `form.name = 'a'` changes the
  value without telling anyone, so the page doesn't update; the compiler warns. Assign a new value:
  `items = [...items, x]`, `form = { ...form, name: 'a' }`. (Two-way bindings such as `[(value)]="form.name"` do this
  for you.)
- **`@for` without `track`.** Rows are matched by position, so a row's state moves to another item when the list
  changes order. `clarusjs check` warns; use `track item.id` (or another unique key).
- **Other frameworks' habits.** There is no `useState`, `ref()`, `this` or `className`: use `state()`, plain
  variables and `class`. `clarusjs check` reports names that don't exist.
- **Images, labels and buttons without names.** `clarusjs check` lints them: give every `<img>` an `alt` (`alt=""`
  for decoration), every `<label>` a field, every button and link text or `aria-label`.
