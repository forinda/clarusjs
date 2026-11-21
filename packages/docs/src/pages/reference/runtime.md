---
title: "Runtime"
group: "APIs"
order: 1
description: "state, derived, shared, effect, batch, untrack, scope, onDispose and browser: the exact contract of each, with usage."
---

# Runtime

<p class="lead">The functions you use in island scripts and stores, from <code>clarusjs/runtime</code>. For the how-to, see <a href="/guide/state">State</a> and <a href="/guide/events">Events</a>.</p>

```ts
import { state, derived, shared, effect, batch, untrack, scope, onDispose, browser } from 'clarusjs/runtime'
```

In an island's `<script>`, `state`, `derived` and `shared` need no import, and their variables read and write as plain values (`count++`). In a `.ts` module, such as a store, you use `get()` and `set()`.

## state()

```ts
state<T>(initial: T): Signal<T>
```

A reactive value. The template, effects and derived values that read it update when it changes.

### Parameters

- **`initial`**: the starting value. It's also what the server renders.

### Returns

A `Signal<T>`: `get()`, `set(value)`, and `initial`.

### Caveats

- **Setting the same value** (by `Object.is`) does nothing.
- **Objects and arrays aren't deep-reactive.** Replace them (`items = [...items, x]`); don't mutate them in place.
- **A module-level `state()` is a store,** shared by every island that uses it through `shared()`. On the server, each request renders its `initial`.

### Usage

**In an island:**

```tscl
<script>
  let count = state(0)
</script>
<button (click)="count++">Clicked {{ count }} times</button>
```

**A store, in a module:**

```ts
// stores/cart.ts
export const items = state<string[]>([])
export const add = (item: string) => items.set([...items.get(), item])
```

## derived()

```ts
derived<T>(fn: () => T): ReadSignal<T>
```

A value computed from other signals, kept up to date as they change. Read-only.

### Caveats

- **It computes eagerly,** when a signal it reads changes, not when it's read.
- **Keep `fn` free of side effects.** For side effects, use `effect()`.

### Usage

```tscl
<script>
  let price = state(20)
  let quantity = state(3)
  const total = derived(() => price * quantity)
</script>
<p>Total: {{ total }}</p>
```

## shared()

```ts
shared<T>(store: Signal<T>): Signal<T>
```

In an island's script, gives a local name to a store (a module-level `state()`). Reads and writes go to the store, so every island using it stays in sync.

### Caveats

- **On the server** it renders a copy of the store's initial value, never a value another request set.

### Usage

```tscl
<script>
  import { todos } from '../stores/todos.ts'
  let items = shared(todos)
  function add(text) { items = [...items, text] }
</script>
```

## effect()

```ts
effect(fn: () => void): () => void
```

Runs `fn` now, and again whenever a signal it read changes.

### Returns

A function that stops it. In an island it stops by itself when the island leaves the page.

### Caveats

- **Only signals read in its last run count.** A signal read only in a branch that didn't run isn't followed.
- **It runs on the server too,** once, when the script runs. Put browser-only work under `if (browser)`.

### Usage

```ts
effect(() => {
  document.title = `${unread.get()} new messages`
})
```

## batch()

```ts
batch(fn: () => void): void
```

Runs `fn`, then the effects its writes affect, once each. They never see some of its writes without the others.

### Usage

```ts
batch(() => {
  first.set('Ada')
  last.set('Lovelace')
}) // an effect reading both runs once, with both names
```

## untrack()

```ts
untrack<T>(fn: () => T): T
```

Reads signals without making the running effect, or template expression, depend on them.

### Usage

```ts
effect(() => {
  log(query.get(), untrack(() => page.get())) // runs again when query changes, not page
})
```

## scope()

```ts
scope(fn: () => void): () => void
```

Runs `fn`. Everything it creates (effects, `onDispose` cleanups, nested scopes) is undone by the function it returns. An island's script already runs in one, as do each `@if` branch and `@for` row.

### Usage

```ts
const stop = scope(() => {
  effect(() => console.log(count.get()))
})
stop() // the effect stops
```

## onDispose()

```ts
onDispose(fn: () => void): void
```

Runs `fn` when the enclosing scope is disposed: an island leaving the page, or an `@if` branch or `@for` row going away. Outside a scope it does nothing.

### Usage

```ts
if (browser) {
  const timer = setInterval(tick, 1000)
  onDispose(() => clearInterval(timer))
}
```

## browser

```ts
const browser: boolean
```

`true` in the browser, `false` on the server. A component's script runs in both: the server renders it, then the browser attaches it. Code that needs the DOM, timers that keep running, or listeners on `window` goes under `if (browser) { … }`.

### Caveats

- **A runtime that defines `window` without `document`** (some server runtimes do) counts as the server.

## render(name, props)

From `clarusjs/views`, in server code (a `load()`, a script importing the built server): renders any view under `src/` to an HTML string. The name is its path without the extension.

```ts
import { render } from 'clarusjs/views'

const html = await render('components/pill', { text: 'new' })
```

Props are typed against the view's inputs by `.clarusjs/views.d.ts`, which `clarusjs check` writes: an unknown name or a wrong prop is a type error. Add that file to your `tsconfig.json`'s `include` to get the same types in your editor. The built server, `dist/server/index.mjs`, exports `render` too.
