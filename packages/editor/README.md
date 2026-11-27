# @clarusjs/editor

A rich text editor for [clarusjs](https://clarusjs.com), on ProseMirror, in pieces you put together:

- **Parts** (headless `.tscl` islands, prefix `editor`): `<editor-field>` (a plain textarea until it's focused, then the editor), and the parts that name it with `field="id"`: `<editor-toolbar>` with `<editor-tool>`, `<editor-suggestions>` (@ mentions, / commands, : emoji), `<editor-count>`, `<editor-send>`, `<editor-files>`.
- **Behaviours** (`editor`, `toolbar`, `suggestion`, `content`) for `[use]`, to build your own.
- **The core:** `createEditor()` and plain-object extensions.
- **`@clarusjs/editor/server`:** `validate()` and `renderHTML()`, with no DOM.

Full examples to copy (a chat composer, a comment box) are on [ui.clarusjs.com](https://ui.clarusjs.com). See the [editor guide](https://clarusjs.com/guide/editor-composer).
