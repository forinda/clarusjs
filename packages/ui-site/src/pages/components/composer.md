---
title: "Composer"
group: "Form"
order: 39
description: "A chat or comment box: a textarea with no JavaScript, then an editor with mentions, commands and emoji."
---

# Composer

<p class="lead">A chat or comment box: a textarea with no JavaScript, then an editor with mentions, commands and emoji.</p>

<composerDemo />

## Usage

The component comes from `@clarusjs/editor` (install it); the look is `composer.css`, imported once. Until its code loads (with `attach="interaction"`, on first focus) it's a plain textarea: typing, and posting a form through `[name]`, work with no JavaScript. Then the editor takes over with what was typed.

<<< ../../registry/composer-demo.tscl

- **Enter** sends (`(send)`, then it clears); **Shift+Enter** is a new line. In a code block Enter is a new line and **Ctrl/⌘+Enter** sends.
- **@** asks `(search)` for people: answer with `$event.respond(items)` (or a promise of them). A newer query aborts the older one (`$event.signal`); answers are cached by query.
- **/** lists `[commands]`; choosing one sends `(command)` with its id and the editor, to change the text.
- **:** suggests emoji by name (`:thumbs`, `:smil`).
- Files pasted, dropped or picked with 📎 go to `(files)`: uploading is yours.
- **Markdown** as you type: `**bold**`, `*italic*`, `` `code` ``, three backticks for a code block.

The value is ProseMirror JSON (or HTML with `[format]="'html'"`). Whatever the browser sends, check it on the server with the same extensions before you store it:

```ts
import { composerExtensions } from '@clarusjs/editor'
import { validate } from '@clarusjs/editor/server'

const result = validate(body, composerExtensions(), { maxLength: 500 })
if (!result.ok) return new Response(result.error, { status: 422 })
```

See the [editor guide](https://clarusjs.com/guide/editor-composer) for the behaviours under it, to build your own.

## API

<componentApi name="composer" />

## Source

Copy it into `src/components/ui/` as `composer.css`. It's the same as `@clarusjs/ui`'s rules for the composer, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `composer.tw.css`, imported where Tailwind runs.

<sourceFlavor name="composer">

<<< ../../registry/composer.css

<<< ../../registry/composer.tw.css

</sourceFlavor>

## Styling

- **On the component:** `class`, `style`, `id`, `aria-*` and `data-*` written on `<editor-composer>` land on its root element, merged with its own.
- **Selectors:** `data-part` names `composer`, `field` (the textarea, then the editor's box, whose editable is `[role='textbox']`), `footer`, `toolbar`, `tool`, `attach`, `files`, `count`, `send`, `suggestions`, `suggestion`; mentions are `[data-mention]`, and the placeholder shows on `[data-empty]`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="composer" />
