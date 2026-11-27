---
title: "Combobox"
group: "Form"
order: 24
description: "A text field that filters a list of options as you type."
---

# Combobox

<p class="lead">A text field that filters a list of options as you type.</p>

<comboboxDemo />

## Usage

The parts come from `@clarusjs/ui-primitives`; the look is `combobox.css`, imported once.

<<< ../../registry/combobox-demo.tscl

## Examples

### Several values

`[multiple]`: each pick becomes a chip; Backspace in the empty input removes the last.

<comboboxMultipleDemo />

<<< ../../registry/combobox-multiple-demo.tscl

### Options from a function

`(search)`: answer each search yourself, for a source that isn't a URL (an API client, IndexedDB, a worker). The event brings the term (`$event.term`) and an `AbortSignal` (`$event.signal`, aborted by a newer search); `$event.respond()` takes the options or a promise of them. Answers are cached by search, like `[src]`'s. The listener is in an island's script, as here:

<comboboxSearchDemo />

<<< ../../registry/combobox-search-demo.tscl

### Options from a server

`[src]`: typing asks the URL for `?q=<search>`, 200 ms after the last key, and lists what it answers (JSON: `[{ value, label }]`). The newest search wins; answers are cached by search. Here `/api/cities` is a small function on this site:

<comboboxRemoteDemo />

<<< ../../registry/combobox-remote-demo.tscl

```ts
// The endpoint: any server that answers GET ?q= with JSON. A fetch handler, like this site's:
export default function cities(request: Request): Response {
  const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase()
  const found = CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8)
  return Response.json(found.map((c) => ({ value: c.toLowerCase(), label: c })))
}
```

## Source

Copy it into `src/components/ui/` as `combobox.css`. It's the same as `@clarusjs/ui`'s rules for these parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `combobox.tw.css`, imported where Tailwind runs.

<sourceFlavor name="combobox">

<<< ../../registry/combobox.css

<<< ../../registry/combobox.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag (from `@clarusjs/ui-primitives`) land on its root element, merged with its own.
- **Selectors:** `data-part` names `field`, `select`, `label`, `control`, `description`, `error`, `option`, `combobox`, `input`, `chip`, `listbox`, `status`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="combobox" />
