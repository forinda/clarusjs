---
'@clarusjs/editor': minor
---

The new `@clarusjs/editor`, a rich text editor for clarusjs on ProseMirror, in pieces you put together:

- **Parts**, each a small headless island:
  - `<editor-field>`: a plain textarea from the server, so typing and form posts work with no JavaScript. With `attach="interaction"` the editor takes over on first focus, keeping the text and caret. Enter sends `(send)`, files go to `(files)`, and `[(value)]` holds ProseMirror JSON or HTML.
  - The parts that name the field with `field="id"`: `<editor-toolbar>` with `<editor-tool>`, `<editor-suggestions>` (`@` mentions through `(search)`, `/` commands, `:` emoji with GitHub's shortcodes), `<editor-count>`, `<editor-send>` and `<editor-files>`. They load no ProseMirror of their own.
- **The behaviours** they're made of, for `[use]`: `editor`, `toolbar`, `suggestion`, `content`, and `onEditor()`.
- **The core:** `createEditor()` and plain-object extensions.
- **`@clarusjs/editor/server`:** `validate()` and `renderHTML()`, with no DOM, to check and show what a browser sends. This includes the plain text a field posts without JavaScript.
