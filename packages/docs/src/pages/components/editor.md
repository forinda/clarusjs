---
title: "Editor"
group: "Components"
order: 12
description: "A rich text editor in parts you put together: a field that's a textarea until focused, a toolbar, @ / : suggestions, a count, Send and files."
---

# Editor

<p class="lead">A rich text editor in parts you put together: a field that's a textarea until focused, a toolbar, @ / : suggestions, a count, Send and files.</p>

**Styled:** [Editor on ui.clarusjs.com](https://ui.clarusjs.com/components/editor), with whole examples to copy: the [chat composer](https://ui.clarusjs.com/blocks/chat-composer) and the [comment box](https://ui.clarusjs.com/blocks/comment-box).

<composerDemo />

```tscl
@import editorField from '@clarusjs/editor/components/field.tscl'
@import editorToolbar from '@clarusjs/editor/components/toolbar.tscl'
@import editorTool from '@clarusjs/editor/components/tool.tscl'
@import editorSuggestions from '@clarusjs/editor/components/suggestions.tscl'
@import editorCount from '@clarusjs/editor/components/count.tscl'
@import editorSend from '@clarusjs/editor/components/send.tscl'

<editorField attach="interaction" [id]="'msg'" [label]="'Message'" [maxLength]="2000" [(value)]="draft" (send)="post($event.value)" />
<editorToolbar [field]="'msg'">
  <editorTool command="bold" label="Bold">B</editorTool>
  <editorTool command="link" label="Link">🔗</editorTool>
</editorToolbar>
<editorSuggestions [field]="'msg'" char="@" (search)="$event.respond(people($event.query, $event.signal))" />
<editorCount [field]="'msg'" />
<editorSend [field]="'msg'" />
```

Each part is its own small island. The field is the editor; the others name it with `field="its id"` and wire up whenever it runs, before or after them. Use the ones you need, in the layout you want.

<table tabindex="0" aria-label="The parts">
    <thead><tr><th>Part</th><th>Inputs</th><th>Events</th></tr></thead>
    <tbody>
      <tr><td><code>&lt;editor-field&gt;</code></td><td><code>id</code> (required), <code>label</code>, <code>placeholder</code>, <code>format</code> (<code>'json'</code> or <code>'html'</code>), <code>name</code>, <code>maxLength</code>, <code>enterSends</code>, <code>codeBlocks</code>, <code>mentions</code>, <code>rows</code>, <code>[(value)]</code></td><td><code>(send)</code> (<code>$event.value</code>; <code>$info.cancel()</code> keeps the text), <code>(files)</code> (pasted or dropped)</td></tr>
      <tr><td><code>&lt;editor-toolbar&gt;</code></td><td><code>field</code>, <code>label</code></td><td>none</td></tr>
      <tr><td><code>&lt;editor-tool&gt;</code></td><td><code>command</code> (<code>bold</code>, <code>italic</code>, <code>code</code>, <code>link</code>, <code>codeBlock</code>, <code>undo</code>, <code>redo</code>), <code>label</code></td><td>none</td></tr>
      <tr><td><code>&lt;editor-suggestions&gt;</code></td><td><code>field</code>, <code>char</code> (<code>@</code>, <code>/</code> or <code>:</code>), <code>label</code>, <code>commands</code> (for <code>/</code>)</td><td><code>(search)</code> (for <code>@</code>: answer with <code>$event.respond(items)</code>), <code>(command)</code> (for <code>/</code>: its <code>id</code> and the <code>editor</code>)</td></tr>
      <tr><td><code>&lt;editor-count&gt;</code></td><td><code>field</code></td><td>none</td></tr>
      <tr><td><code>&lt;editor-send&gt;</code></td><td><code>field</code>, <code>label</code></td><td>none (the field's <code>(send)</code> fires)</td></tr>
      <tr><td><code>&lt;editor-files&gt;</code></td><td><code>label</code>, <code>accept</code></td><td><code>(files)</code> (picked)</td></tr>
    </tbody>
</table>

- **Without JavaScript** the field is a plain `<textarea>`: people type, and with `[name]` in a form it posts, beside `<name>-format` (`text`, then `json` or `html` once the editor runs). Pass both to `validate()` from `@clarusjs/editor/server`. See the [editor guide](/guide/editor-composer#on-the-server).
- **Keys:** Enter sends and Shift+Enter is a new line (`[enterSends]="false"`: Enter is a new line, Ctrl/⌘+Enter sends). Markdown as you type: `**bold**`, `*italic*`, `` `code` ``, three backticks for a code block.
- **Styling:** parts `editor` (the field's box; its editable is `[role='textbox']`, empty with `data-empty`), `toolbar`, `tool` (`aria-pressed` when active), `suggestions`, `suggestion` (`aria-selected` on the active one), `count` (`data-over` past the limit), `send`, `attach`, `files`; mentions are `[data-mention]`. A `class` on a part's tag lands on its top-level element.

From [`@clarusjs/editor`](/guide/editor-composer) (`pnpm add @clarusjs/editor`), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens. Without it, the parts are unstyled and work the same. To build your own instead, see the [behaviours](/guide/editor-composer#behaviours) they're made of.
