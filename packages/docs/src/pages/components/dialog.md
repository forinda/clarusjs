---
title: "Dialog"
group: "Components"
order: 1
description: "A modal dialog on the native <dialog>, opened and closed by command invokers: focus kept in it, the page inert, Escape and a click outside close it. No JavaScript."
---

# Dialog

<p class="lead">A modal dialog on the native &lt;dialog&gt;, opened and closed by command invokers: focus kept in it, the page inert, Escape and a click outside close it. No JavaScript.</p>

<uiGallery part="dialog" />

```tscl
@import uiDialog from '@clarusjs/ui-primitives/dialog.tscl'
@import uiDialogTrigger from '@clarusjs/ui-primitives/dialog-trigger.tscl'
@import uiDialogClose from '@clarusjs/ui-primitives/dialog-close.tscl'

<uiDialogTrigger target="confirm">Delete file…</uiDialogTrigger>
<uiDialog id="confirm">
  @slot('title') { Delete this file? }
  <p>It can't be undone.</p>
  <uiDialogClose target="confirm">Cancel</uiDialogClose>
</uiDialog>
```

- **`dismissible`** (default `true`): a click outside closes it too (`closedby="any"`); `false` keeps it to Escape and its own buttons.
- **Styling:** `dialog[open]`, `::backdrop`; its parts are `dialog`, `title`, `trigger` and `close`.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
