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
@import siteBadge from './site-badge.tscl'
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
  <h2>{{ title }} <site-badge [label]="site.name" /></h2>
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

To pick components at runtime (widgets from settings, a generated layout), build them in server code with `h(name,
props, children)` from `clarusjs/views` (a component's path or a tag), return the result from `load()` and put it in
the template with `{{ }}`. It's server only: not in island scripts, not in an island's props.

### Islands and state

- A component with a `<script>` is an island: it ships JavaScript and runs in the browser. Without one it ships
  nothing. Keep scripts to the components that need them.
- `let x = state(value)` is reactive state; read and write it as a plain variable (`x++`, `x = [...x, y]`).
  `derived(() => …)` computes from it. `shared(store)` gives a local name to a store's state.
- Update objects and arrays by assigning new ones: `items = [...items, item]`, `form = { ...form, name }`.
- `attach="visible"` (or `idle`, `interaction`) on an island's tag loads its JavaScript later.

### Navigation and the URL

Islands import from `clarusjs/navigation`:

- `navigate(url, { replace, state, scroll })` and `back()` move like a link and the back button; `abort()` stops one.
  `beforeNavigate((to, nav) => nav.cancel())`, `afterNavigate`, `onNavigateError` hook in.
- `shared(currentUrl)` is the current URL and `shared(searchParams)` its query, as stores (`null` on the server).
- `setSearch({ q: 'shoes', page: null })` changes the query: `null` removes a key, it replaces the history entry and
  keeps the scroll position by default (`{ replace: false }` adds an entry, `{ scroll: true }` goes to the top).
  `navigate(url, { scroll: false })` keeps it too. `navigationState()` reads the `state` a navigation passed.
- `viewTransitions()`, called once from any island, runs page changes as view transitions; style them with
  `::view-transition-old(root)` / `::view-transition-new(root)`.

### Animations

What `@if` and `@for` insert animates in with CSS alone, no JavaScript: give the element a `transition` and its
starting look in `@starting-style`. It also runs for what the server rendered, on page load. To animate leaving too,
wrap an island's `@if` in `@transition ('fade') { @if (open) { … } }`: Vue's classes (`fade-enter-from`,
`fade-enter-active`, `fade-leave-to`…) are added, and the old branch is removed once its transition ends. Options:
`{ mode: 'out-in' | 'in-out', appear, duration, css: false }` and Vue's hooks (`onEnter(el, done)`…). It wraps one
`@if` or one `@for`, in an island only: around a `@for`, rows enter and leave, and rows that move slide into
place with a `-move` class (`.list-move { transition: transform 0.3s }`). Don't confuse it with view transitions (`viewTransitions()` from
`clarusjs/navigation`): those animate the whole page on navigation, `@transition` an element inside it. Under
`prefers-reduced-motion: reduce`, drop the movement and keep fades.

```css
.panel { transition: opacity 0.3s, translate 0.3s; }
@starting-style { .panel { opacity: 0; translate: 0 8px; } }
```

### Rich text

For rich text, put `@clarusjs/editor`'s parts together; don't wrap a React editor in an island. `<editor-field>`
(`@import editorField from '@clarusjs/editor/components/field.tscl'`, with `attach="interaction"` and an `[id]`) is a
textarea until focused, then the editor: bind `[(value)]` (ProseMirror JSON, or HTML with `[format]="'html'"`) and
handle `(send)` and `(files)`. The other parts name it with `[field]="'that id'"`: `<editor-toolbar>` with
`<editor-tool command="bold">`, `<editor-suggestions char="@">` (answer `(search)` with `$event.respond(people)`), `"/"`
with `[commands]`, `":"` for emoji, `<editor-count>`, `<editor-send>`, `<editor-files>`. On the server, check what's
sent before storing it: `validate(body, composerExtensions(), { format: form.get('<name>-format'), maxLength })` from
`@clarusjs/editor/server`; show stored values with `renderHTML()`, or in the browser with the `content` behaviour.

### Tag names

A camelCase or PascalCase import name also works as a kebab-case tag: `@import userCard from './user-card.tscl'` (or
`UserCard`) is `<user-card>`. Give components multi-word names: one-word names (`Button`) have no kebab form, so they
never take an HTML element's place. Files in `src/components/` named in kebab case are used without an import.

### Check your work

Run `npx clarusjs check` after editing `.tscl` files, and fix what it reports before calling the work done: it
type-checks templates and scripts (`file.tscl:line:col`) and runs the template lint rules (images without `alt`,
labels without a field, unused inputs…). With the clarusjs MCP server (`npx @clarusjs/ai mcp`), use its `check`,
`compile` and `docs_search` tools.

Docs: https://clarusjs.com/guide/getting-started · syntax: https://clarusjs.com/reference/template-syntax · all of
it for agents: https://clarusjs.com/llms-full.txt
