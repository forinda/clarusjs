<!-- clarusjs:start (written by `npx @clarusjs/ai agents`; run it again to update) -->
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

<section>
  <h2>{{ title }} <badge [label]="site.name" /></h2>
  <button type="button" (click)="add()">Clicked {{ n }} times ({{ double }})</button>
  @if (n > 3) {
    <p>That's a lot.</p>
  } @else {
    <p>Keep going.</p>
  }
</section>
```

- `{{ expr }}` prints a value, escaped. `[attr]="expr"` binds an attribute or a component input;
  `attr="a {{ b }}"` interpolates.
- `(event)="code"` handles an event, with `$event`. `[(value)]` binds a form field two ways (`[(checked)]` for a
  checkbox); a component declares what it may write with `@model name: Type`.
- `@for (item of items; track item.id) { … } @empty { … }`: always `track` a unique key.
- `<slot />` and `<slot name="x">` receive content; `@slot('x') { … }` fills a named one.
- `{{-- … --}}` is a template comment.
- A component renders one root element: what a parent passes (attributes, `class`, `(event)`) lands on it. To group
  several without an element, wrap them in `<fragment>` (it renders only its children and takes no attributes). A
  component whose root is a `<fragment>` takes nothing from its parent: `clarusjs check` reports any attribute, `class`
  or `(event)` written on its tag.

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
<!-- clarusjs:end -->
