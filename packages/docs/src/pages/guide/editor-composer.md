---
title: "Rich text editor"
group: "Interactivity"
order: 12
description: "@clarusjs/editor: a composer to drop in (a textarea with no JavaScript, then mentions, commands, emoji and Enter to send), behaviours to build your own with [use], and validate and renderHTML on the server."
---

# Rich text editor

<p class="lead"><code>@clarusjs/editor</code> is a rich text editor made for clarusjs: an island whose value is a signal you bind with <code>[(value)]</code>, checked and rendered on the server, built on ProseMirror. It comes in layers: a composer to drop in, the behaviours it's made from, and the core under both.</p>

<composerDemo />

Three kinds of product need rich text: a **composer** (chat and comments), a **rich field** (a CMS body, a form field) and a **document editor**. The composer is here now; the others will be presets of the same core. If plain text, or Markdown typed into a `<textarea>`, is enough, use that: it costs nothing.

```sh
pnpm add @clarusjs/editor
```

## The composer

```tscl
@import editorComposer from '@clarusjs/editor/components/composer.tscl'

<editorComposer attach="interaction" [label]="'Reply'" [maxLength]="2000" [(value)]="draft"
  (send)="post($event.value)" (search)="$event.respond(people($event.query, $event.signal))"
  (files)="upload($event.files)" />
```

- **Enter** sends: `(send)` gets the value, then the composer clears. **Shift+Enter** is a new line. In a code block Enter is a new line and **Ctrl/⌘+Enter** sends. With `[enterSends]="false"` Enter is always a new line and Ctrl/⌘+Enter sends. A `(send)` cancelled with `$info.cancel()` keeps the text.
- **Markdown as you type:** `**bold**`, `*italic*`, `` `code` ``, three backticks for a code block. Or Ctrl/⌘+B, I, E, and the toolbar.
- **Files** pasted, dropped, or picked with 📎 go to `(files)` as `File`s, never into the text: uploading and showing them is yours.
- **Customizing:** `[codeBlocks]`, `[mentions]` and `[emoji]` turn those off (`false`). For anything else, build your own from the [behaviours](#behaviours): the composer is made only of them.
- `@clarusjs/ui` styles it (its `data-part` names are on [its page on ui.clarusjs.com](https://ui.clarusjs.com/components/composer)).

## Loading

From the server the composer is a plain `<textarea>`: people can type, and with `[name]` inside a form, post, all with no JavaScript. With `attach="interaction"` its code loads the first time someone focuses it, and the editor takes over with what they typed and where the caret was: nothing is lost. Its JavaScript (about 80 KB gzip, ProseMirror most of it) only loads on pages that have a composer, when someone uses it.

With JavaScript, a send that isn't cancelled also posts the form, when the composer has a `[name]` and is inside one, so a form handler works either way.

## Format

The value is ProseMirror JSON by default, or HTML with `[format]="'html'"`: chosen when you create it, received and emitted that way, and what you store.

## Mentions

`@` asks `(search)` for people: answer with `$event.respond(items)` (or a promise of them), each `{ id, label }`. A newer query aborts the older one (`$event.signal`), and answers are cached by query. A mention is stored as a node with its `id` and `label`, and renders as `<span data-mention="id">@label</span>`. Whether that id exists is yours to check on the server.

## Suggestions

The lists after `@`, `/` and `:` work like a combobox: the editor keeps focus, ↑ and ↓ move, Enter or Tab picks, Escape closes, and a screen reader hears how many results came.

- **`/`** lists `[commands]` (`{ id, label, keywords? }`); choosing one removes what was typed and sends `(command)` with its `id` and the `editor`, to change the text (`$event.editor.run('bold')`).
- **`:`** suggests emoji (after two characters): GitHub's shortcodes first (`:+1:`, `:tada:`), then words of the name (`:thumbs_up`) and tags (`:happy`). The list (Unicode's emoji, grouped as Unicode groups them) loads the first time someone types `:`.

## Limits

`[maxLength]` shows a count and disables Send past it. Length is counted in graphemes, as people count: a family emoji is one, and a mention counts as its label. The server counts the same way.

## On the server

Whatever the browser sends, check it with the same extensions before you store it. `validate()` parses the value (JSON, or HTML with ProseMirror's own parser over a small DOM), keeps only what the schema allows, refuses any URL that isn't safe, and checks the length:

```ts
import { composerExtensions } from '@clarusjs/editor'
import { renderHTML, validate } from '@clarusjs/editor/server'

const result = validate(body, composerExtensions(), { maxLength: 2000 })
if (!result.ok) return new Response(result.error, { status: 422 })
await db.messages.insert({ body: result.doc })

// A page showing messages ships no editor: their HTML, escaped, with safe links.
const html = renderHTML(message.body, composerExtensions())
```

`@clarusjs/editor/server` imports no view code. `composerExtensions()` with the same options gives the same list, so its schema is built once.

## The core

```ts
import { createEditor, composerExtensions } from '@clarusjs/editor'

const editor = createEditor({ element, extensions: composerExtensions(), format: 'json', onSend: post })
effect(() => console.log(editor.length.get()))
editor.run('bold')
```

`createEditor()` returns `value` (a signal: set it to replace the document), `length`, `state` (the ProseMirror state after every change, for toolbars), `run(name, ...args)`, `can()`, `active()`, `send()`, `clear()`, `focus()` and `destroy()`.

## Extensions

An extension is a plain object: the nodes and marks it adds, its commands by name, keys, input rules and ProseMirror plugins, and the extensions it `requires` or `conflicts` with. A node's or mark's `render` describes its HTML without a DOM, so the server renders with the same specs.

```ts
import { defineExtension } from '@clarusjs/editor'

const highlight = defineExtension({
  name: 'highlight',
  marks: { highlight: { parseDOM: [{ tag: 'mark' }], render: () => ['mark', 0] } },
})
```

The built-in ones: `base` (paragraphs, text, hard breaks), `bold`, `italic`, `code`, `link` (URL-checked), `codeBlock`, `mention`, `markdownShortcuts`, `history`, `placeholder(text)`, and `composerExtensions()`, the composer's list.

## Behaviours

The composer is three behaviours, each `(element, options) → dispose` for `[use]`, so you can build your own:

- **`editor`** makes an editor inside the element; `editorOf(element)` finds it again.
- **`toolbar`** wires buttons named by `data-command` (`bold`, `italic`, `code`, `link`, `codeBlock`) to it, with `aria-pressed`, `disabled` and one tab stop.
- **`suggestion`** opens a list for a trigger character, with your `search` and `pick`.

```tscl
<script>
  import { composerExtensions, editor, suggestion, toolbar } from '@clarusjs/editor'
  let field
  const mount = (el) => editor((field = el), { extensions: composerExtensions(), format: 'json', label: 'Note' })
</script>

<div [use]="mount"></div>
<div aria-label="Formatting" [use]="(el) => toolbar(el, { editor: field })">
  <button type="button" data-command="bold" aria-label="Bold">B</button>
</div>
```
