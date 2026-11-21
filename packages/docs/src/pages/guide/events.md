---
title: "Events"
group: "Interactivity"
order: 6
description: "Handle DOM events in islands with (event), use $event, talk to a parent island with custom events, and listen to the window or document."
---
@import eventDemo from '~/components/event-demo.tscl'

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
{{-- star-rating.tscl --}}
<button (click)="$event.target.dispatchEvent(new CustomEvent('rate', { bubbles: true, detail: 4 }))">★</button>

{{-- the parent --}}
<div (rate)="rating = $event.detail"><starRating /></div>
```

For a value the child edits, like a form field, bind it two ways with `@model` instead (see [Forms](./forms.md)).

## The window and the document

To listen beyond the island, for a shortcut or a resize, add the listener in the script and remove it when the island goes away:

```tscl
<script>
  import { onDispose } from 'clarusjs/runtime'
  let wide = state(false)
  if (typeof window !== 'undefined') {
    const fit = () => { wide = window.innerWidth > 900 }
    fit()
    window.addEventListener('resize', fit)
    onDispose(() => window.removeEventListener('resize', fit))
  }
</script>
```

The script also runs on the server (with no `window`), hence the check. `onDispose` runs when the island is removed, after a navigation for example.

Try it: hover and click the stars, type a note, press Escape or Enter.

<eventDemo />
