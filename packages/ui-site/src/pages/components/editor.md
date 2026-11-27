---
title: "Editor"
group: "Form"
order: 39
description: "A rich text field in parts you put together: the field, a toolbar, suggestions for @ / and :, a count, Send."
---

# Editor

<p class="lead">A rich text field in parts you put together: the field, a toolbar, suggestions for @ / and :, a count, Send.</p>

<editorDemo />

## Usage

The parts come from `@clarusjs/editor` (install it); the look is `editor.css`, imported once. `<editor-field>` is a plain textarea until its code loads (with `attach="interaction"`, on first focus): typing, and posting a form through `[name]`, work with no JavaScript. Then the editor takes over with what was typed. The other parts name it with `field="its id"`, and wire up when it does.

<<< ../../registry/editor-demo.tscl

- **`<editor-field>`**: Enter sends `(send)` and Shift+Enter is a new line, or with `[enterSends]="false"` Enter is a new line and Ctrl/⌘+Enter sends. Files pasted or dropped go to `(files)`. Markdown as you type: `**bold**`, `*italic*`, `` `code` ``, three backticks for a code block.
- **`<editor-toolbar>`** with **`<editor-tool command="…">`**: `bold`, `italic`, `code`, `link`, `codeBlock`, `undo`, `redo`.
- **`<editor-suggestions char="@">`** asks `(search)` for people (answer with `$event.respond(items)`); **`char="/"`** lists `[commands]` and sends `(command)`; **`char=":"`** suggests emoji by GitHub's shortcodes.
- **`<editor-count>`**, **`<editor-send>`** and **`<editor-files>`**: the length against the field's `[maxLength]`, a submit button that sends, a file picker.

Whole examples built from these, to copy and change: the [chat composer](/blocks/chat-composer) and the [comment box](/blocks/comment-box). Whatever the browser sends, check it on the server with `validate()` from `@clarusjs/editor/server` (the field posts `<name>-format` beside the value: pass it as `format`).

## API

<componentApi name="editor" />

## Source

Copy it into `src/components/ui/` as `editor.css`. It's the same as `@clarusjs/ui`'s rules for the parts, so using both looks the same. Or the Tailwind version (switch below): the same look in Tailwind utilities, `editor.tw.css`, imported where Tailwind runs.

<sourceFlavor name="editor">

<<< ../../registry/editor.css

<<< ../../registry/editor.tw.css

</sourceFlavor>

## Styling

- **On the parts:** `class`, `style`, `id`, `aria-*` and `data-*` written on a part's tag land on its top-level element, merged with its own: on `<editor-field>` that's the box (the textarea, then the editor's `div`), so a page restyles it with a class.
- **Selectors:** `data-part` names `editor` (the field's box; its editable is `[role='textbox']`), `toolbar`, `tool`, `suggestions`, `suggestion`, `count`, `send`, `attach`, `files`; mentions are `[data-mention]`, and the placeholder shows on `[data-empty]`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="editor" />
