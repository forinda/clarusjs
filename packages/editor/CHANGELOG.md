# @clarusjs/editor

## 0.1.2

### Patch Changes

- [#664](https://github.com/forinda/clarusjs/pull/664) [`f91e3c7`](https://github.com/forinda/clarusjs/commit/f91e3c7d45cbc7d52ea12ebcaddd05aaff1d7e0d) Thanks [@forinda](https://github.com/forinda)! - No code changes: the same as 0.1.1. This release makes the newest version the one npm installs by default again, since 0.1.0 was published after 0.1.1 and took the `latest` tag.
- Updated dependencies [[`287127f`](https://github.com/forinda/clarusjs/commit/287127fc8d391d734fb379155a79d64e393fb2ce)]:
  - clarusjs@0.19.1

## 0.1.1

### Patch Changes

- Updated dependencies [[`45aed57`](https://github.com/forinda/clarusjs/commit/45aed578d7d0ba4222fc76071dc7d2635d8751f1), [`ce0714b`](https://github.com/forinda/clarusjs/commit/ce0714bb00875a455c532a1ab477d55ce8ea7e8c)]:
  - clarusjs@0.19.0
  - @clarusjs/ui-primitives@0.3.2

## 0.1.0

### Minor Changes

- [#647](https://github.com/forinda/clarusjs/pull/647) [`0306c9c`](https://github.com/forinda/clarusjs/commit/0306c9cabe7d8196d400600367d5506e478769be) Thanks [@forinda](https://github.com/forinda)! - The new `@clarusjs/editor`, a rich text editor for clarusjs on ProseMirror, in pieces you put together:

  - **Parts**, each a small headless island:
    - `<editor-field>`: a plain textarea from the server, so typing and form posts work with no JavaScript. With `attach="interaction"` the editor takes over on first focus, keeping the text and caret. Enter sends `(send)`, files go to `(files)`, and `[(value)]` holds ProseMirror JSON or HTML.
    - The parts that name the field with `field="id"`: `<editor-toolbar>` with `<editor-tool>`, `<editor-suggestions>` (`@` mentions through `(search)`, `/` commands, `:` emoji with GitHub's shortcodes), `<editor-count>`, `<editor-send>` and `<editor-files>`. They load no ProseMirror of their own.
  - **The behaviours** they're made of, for `[use]`: `editor`, `toolbar`, `suggestion`, `content`, and `onEditor()`.
  - **The core:** `createEditor()` and plain-object extensions.
  - **`@clarusjs/editor/server`:** `validate()` and `renderHTML()`, with no DOM, to check and show what a browser sends. This includes the plain text a field posts without JavaScript.

### Patch Changes

- Updated dependencies [[`0306c9c`](https://github.com/forinda/clarusjs/commit/0306c9cabe7d8196d400600367d5506e478769be), [`0306c9c`](https://github.com/forinda/clarusjs/commit/0306c9cabe7d8196d400600367d5506e478769be)]:
  - clarusjs@0.18.0
  - @clarusjs/ui-primitives@0.3.1
