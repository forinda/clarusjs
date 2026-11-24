---
'@clarusjs/ui-primitives': minor
'clarusjs': minor
---

`@clarusjs/ui-primitives` (#464), a new package: accessible behaviours as small DOM functions, each `(element, options) → stop`: `rovingFocus` (one Tab stop, arrow keys by orientation and RTL, Home/End, disabled items skipped), `typeahead` (a repeated key cycles), `dismiss` (Escape and outside press, stacked layers, a cancelable `cl:dismiss` event), `enter` / `exit` (Base UI's `data-open`, `data-starting-style`, `data-ending-style` for CSS transitions), `focusReturn` and `position` (`data-side` and the `--anchor-width`, `--available-height`, `--transform-origin` variables). Each is its own module, no dependencies, about 2.3 KB gzip for all six.

clarusjs: `[use]="fn"` on an element in an island calls `fn(element)` in the browser when the island attaches, and the function it returns when the element's branch, row or island goes (a list runs several). The server renders a `data-cl-u` marker only; `clarusjs check` types the element by its tag.
