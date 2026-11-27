---
'@clarusjs/editor': minor
---

The new `@clarusjs/editor`, a rich text editor for clarusjs on ProseMirror, starting with `<editor-composer>`:

- **The composer.** A chat or comment box. From the server it's a plain textarea that types and posts with no JavaScript. With `attach="interaction"` the editor takes over on first focus, keeping what was typed and where the caret was.
  - Enter sends `(send)`.
  - `@` mentions people, answered through `(search)`.
  - `/` lists `[commands]`.
  - `:` suggests emoji: Unicode's, with GitHub's shortcodes.
  - Files go to `(files)`.
  - `[maxLength]` limits the length.
  - `[(value)]` holds ProseMirror JSON or HTML.
- **The behaviours** it's built from, for `[use]`: `editor`, `toolbar` and `suggestion`.
- **The core:** `createEditor()` and plain-object extensions.
- **`@clarusjs/editor/server`:** `validate()` and `renderHTML()`, with no DOM, to check and show what a browser sends.
