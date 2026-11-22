---
title: "Events"
group: "Interactivity"
order: 6
description: "Handle DOM events in islands with (event), use $event, talk to a parent island with custom events, and listen to the window or document."
---

# Events

<p class="lead"><code>(event)="…"</code> runs code when an element in an island gets that event. The handler is a statement, or several separated by <code>;</code>, and <code>$event</code> is the event.</p>

```tscl
<script>
  let count = state(0)
  let note = state('')
</script>
<button (click)="count++">{{ count }}</button>
<input (keydown)="$event.key === 'Enter' && save(note)" (input)="note = $event.target.value">
<form (submit)="$event.preventDefault(); save(note)">…</form>
```

- **Any event:** `(click)`, `(input)`, `(keydown)`, `(submit)`, `(focus)`, `(mouseenter)`, `(toggle)` and custom names like `(rate)`.
- **Typed:** `clarusjs check` types `$event` from the event name, a `KeyboardEvent` for `(keydown)` and a `SubmitEvent` for `(submit)`. `$event.target` is left loose, so `$event.target.value` reads without a cast.
- **No modifiers:** call `$event.preventDefault()` or `$event.stopPropagation()` in the handler, and test keys with `$event.key`.

## How it works

Handlers are delegated: an island listens once per event type on its own element, and finds the handler for the element the event came from. Events that don't bubble, like `focus`, `blur`, `mouseenter` and `toggle`, are caught on the way down. So handlers inside `@if` branches and `@for` rows work as they appear and disappear, at no cost per row.

Because of delegation, `$event.currentTarget` is the island, not the element with the handler. Use `$event.target`, or `$event.target.closest('…')` when the event can start in a child of the element.

Events that happen before an island's code has loaded are not lost. A click, key press or submit on an island that attaches later (`attach="interaction"`, `"idle"` or `"visible"`) is replayed once it's ready.

## From a child island to its parent

Inputs go down; events go up. A child island dispatches a bubbling `CustomEvent`, and the parent handles it on an element around the child:

```tscl
{{-- star-rating.tscl: an island (it has a script), so it can handle events --}}
<script>
  let picked = state(0)
</script>
<button (click)="picked = 4; $event.target.dispatchEvent(new CustomEvent('rate', { bubbles: true, detail: 4 }))">★</button>

{{-- the parent --}}
<div (rate)="rating = $event.detail"><starRating /></div>
```

For a value the child edits, like a form field, bind it two ways with `@model` instead (see [Forms](./forms.md)).

## The window and the document

To listen beyond the island, for a shortcut or a resize, add the listener in the script and remove it when the island goes away:

```tscl
<script>
  import { browser, onDispose } from 'clarusjs/runtime'
  let wide = state(false)
  if (browser) {
    const fit = () => { wide = window.innerWidth > 900 }
    fit()
    window.addEventListener('resize', fit)
    onDispose(() => window.removeEventListener('resize', fit))
  }
</script>
```

The script also runs on the server, where there is no `window`: `browser` (from `clarusjs/runtime`) is true only in the browser. `onDispose` runs when the island is removed, after a navigation for example.

## Timers: a live clock

A timer works the same way: start it in the browser, stop it in `onDispose`.

```tscl
<script>
  import { browser, onDispose } from 'clarusjs/runtime'
  let now = state(Date.now())
  const time = derived(() => new Date(now).toLocaleTimeString())
  if (browser) {
    let timer
    const tick = () => {
      now = Date.now()
      timer = setTimeout(tick, 1000 - (now % 1000))
    }
    tick()
    onDispose(() => clearTimeout(timer))
  }
</script>

<time [datetime]="new Date(now).toISOString()">{{ time }}</time>
```

- **The server renders the time it renders at.** For a built page that can be hours ago, so the first `tick()` catches up as soon as the island attaches.
- **Ticks land on the whole second.** Each one waits for the next second (`1000 - now % 1000`), so the display changes with the clock, and a slow tick doesn't drift.
- **One timer at a time.** Each tick schedules the next, and `onDispose` clears the pending one, so clocks don't pile up across navigations.
- The text is in the browser's own locale and time zone, which can differ from the server's: the first tick puts it right.

The full component is in the repository's example app: `examples/counter/src/components/clock.tscl`.

Try it: hover and click the stars, type a note, press Escape or Enter.

<eventDemo />
