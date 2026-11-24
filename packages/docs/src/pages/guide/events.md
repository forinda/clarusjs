---
title: "Events"
group: "Interactivity"
order: 6
description: "Handle DOM events in islands with (event), use $event, send events from a component to its parent with @event and emit(), and listen to the window or document."
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

Inputs go down; events go up. A component declares what it sends with `@event`, and sends it from its script with `emit()`. The parent handles it on the component's tag, like an element's event:

```tscl
{{-- star-rating.tscl --}}
@event rate: number
<script>
  let stars = state(0)
  function pick(n, event) {
    if (emit('rate', n, { reason: 'click', event })) stars = n
  }
</script>
@for (n of [1, 2, 3, 4, 5]; track n) {
  <button (click)="pick(n, $event)">{{ n <= stars ? '★' : '☆' }}</button>
}

{{-- the parent island --}}
<starRating (rate)="rating = $event" />
```

- **`$event` is the value** the child sent (typed by its `@event`), and **`$info`** has the rest: `reason` (why it happened, as the child names it), `event` (the DOM event behind it, if any) and `cancel()`.
- **`$info.cancel()` vetoes it:** the child's `emit()` returns `false`, so the child can skip the change. The parent says no without taking the value over (no two-way binding needed).
- **`@event close`**, without a type, sends no value: `emit('close')`.
- An event goes to the parent island and stops there. It isn't a DOM event the page sees: a child's `(change)` is never confused with an `<input>`'s inside it.
- `clarusjs check` checks both sides: the value `emit()` gets, and what the parent does with `$event`. A misspelled `(chnage)` is an error.
- The parent must be an island (its handler runs in the browser), and the child too (it emits from its script).

The [forms demo](/guide/forms) uses both: the text fields send `(blur)`, and the languages combobox sends `(change)`, which the form cancels past three languages.

## Events on what a component renders

A `(name)` the component doesn't declare with `@event` is the DOM event on what it renders, as in Vue: `(click)` on a button component is a click on its `<button>`, and `$event` is the `MouseEvent`.

```tscl
{{-- components/like-button.tscl: no script, no @event --}}
<button type="button" class="like"><slot /></button>

{{-- the parent island --}}
<likeButton (click)="likes++">Like</likeButton>
```

<fallthroughDemo />

- **Any DOM event:** `(click)`, `(keydown)`, `(focusin)`, `(input)`… It's heard as it bubbles up from what the component renders, so a click on anything inside counts.
- **A declared `@event` wins:** a component that declares `@event click` sends its own `click` (with its value); the DOM click on it doesn't also reach you.
- **Checked:** `clarusjs check` types `$event` as that DOM event and reports a name that is neither an `@event` nor a DOM event (`(clik)`).
- The parent must be an island; the component itself needs no script.

For a value the child edits, like a form field, bind it two ways with `@model` instead (see [Forms](./forms.md)). Use both together when the parent needs the value and to hear what happened.

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
